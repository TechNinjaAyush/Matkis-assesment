package api

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

func (h *Handler) FetchUser(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	if page < 1 {
		page = 1
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	start := int64((page - 1) * limit)
	end := start + int64(limit) - 1

	users, err := h.Redis.ZRevRangeWithScores(ctx, "leaderboard", start, end).Result()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	type Resp struct {
		Username string `json:"username"`
		Rating   int    `json:"rating"`
		Rank     int64  `json:"rank"`
	}

	result := make([]Resp, 0, len(users))

	for _, u := range users {
		if ctx.Err() != nil {
			c.JSON(http.StatusRequestTimeout, gin.H{"error": "request cancelled"})
			return
		}

		username := u.Member.(string)
		rating := int(u.Score)

		higherCount, err := h.Redis.ZCount(
			ctx,
			"leaderboard",
			fmt.Sprintf("(%d", rating),
			"+inf",
		).Result()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		result = append(result, Resp{
			Username: username,
			Rating:   rating,
			Rank:     higherCount + 1,
		})
	}

	c.JSON(http.StatusOK, result)
}
