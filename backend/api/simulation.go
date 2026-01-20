package api

import (
	"context"
	"database/sql"
	"fmt"
	"math/rand"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

type RatingUpdate struct {
	UserID   int64
	Username string
	Rating   int
}

var UpdateQueue = make(chan RatingUpdate, 100_000)

func (h *Handler) SimulateMultiUserUpdates(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	updates := 500
	pipe := h.Redis.Pipeline()

	count, err := h.Redis.ZCard(ctx, "leaderboard").Result()
	if err != nil || count == 0 {
		c.JSON(500, gin.H{"error": "leaderboard empty"})
		return
	}

	for i := 0; i < updates; i++ {
		randIndex := rand.Int63n(count)

		users, err := h.Redis.ZRange(ctx, "leaderboard", randIndex, randIndex).Result()
		if err != nil || len(users) == 0 {
			continue
		}
		username := users[0]
		fmt.Printf("username is %s", username)

		newRating := rand.Intn(5000)

		fmt.Printf("new rating is %d", newRating)

		pipe.ZAdd(ctx, "leaderboard", redis.Z{
			Score:  float64(newRating),
			Member: username,
		})

		UpdateQueue <- RatingUpdate{
			Username: username,
			Rating:   newRating,
		}

	}

	if _, err := pipe.Exec(ctx); err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	c.JSON(200, gin.H{
		"message": "multi-user simulation completed",
		"updates": updates,
	})
}

func StartDBWorkers(db *sql.DB, workers int) {
	for i := 0; i < workers; i++ {
		go dbWorker(db)
	}
}

func dbWorker(db *sql.DB) {
	batch := make([]RatingUpdate, 0, 1000)
	ticker := time.NewTicker(1 * time.Second)

	for {
		select {
		case u := <-UpdateQueue:
			batch = append(batch, u)
			if len(batch) >= 1000 {
				flushBatch(db, batch)
				batch = batch[:0]
			}

		case <-ticker.C:
			if len(batch) > 0 {
				flushBatch(db, batch)
				batch = batch[:0]
			}
		}
	}
}

func flushBatch(db *sql.DB, batch []RatingUpdate) {
	tx, err := db.Begin()
	if err != nil {
		return
	}

	stmt, err := tx.Prepare(`
		UPDATE leadboard
		SET rating = $1
		WHERE username = $2
	`)
	if err != nil {
		tx.Rollback()
		return
	}

	for _, u := range batch {
		_, _ = stmt.Exec(u.Rating, u.Username)
	}

	stmt.Close()
	tx.Commit()
}
