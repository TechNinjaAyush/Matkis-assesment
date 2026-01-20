package api

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

func addPrefixes(pipe redis.Pipeliner, ctx context.Context, username string) {
	// Store prefixes in lowercase for case-insensitive search
	usernameLower := strings.ToLower(username)
	for i := 1; i <= len(usernameLower); i++ {
		prefix := usernameLower[:i]
		pipe.SAdd(ctx, "user_prefix:"+prefix, username)
	}
}

func (h *Handler) InsertUser(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	const batchSize = 1000
	var lastUserID int64 = 0

	for {
		select {
		case <-ctx.Done():
			c.JSON(http.StatusRequestTimeout, gin.H{"error": "request cancelled"})
			return
		default:
		}

		rows, err := h.Postgres.QueryContext(
			ctx,
			`SELECT user_id, username, rating
			 FROM leadboard
			 WHERE user_id > $1
			 ORDER BY user_id
			 LIMIT $2`,
			lastUserID, batchSize,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		pipe := h.Redis.Pipeline()
		count := 0

		for rows.Next() {
			var userID int64
			var username string
			var rating int

			if err := rows.Scan(&userID, &username, &rating); err != nil {
				rows.Close()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			pipe.ZAdd(ctx, "leaderboard", redis.Z{
				Score:  float64(rating),
				Member: username,
			})
			addPrefixes(pipe, ctx, username)

			lastUserID = userID
			count++
		}
		rows.Close()

		if count > 0 {
			if _, err := pipe.Exec(ctx); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
		}

		if count < batchSize {
			break
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Redis bootstrap completed"})
}
