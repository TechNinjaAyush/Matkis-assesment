package api

import (
	"context"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

func (h *Handler) SearchUser(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	query := c.Query("username")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "username required"})
		return
	}

	queryLower := strings.ToLower(query)
	queryUpper := strings.ToUpper(query)

	var usernames []string
	var err error

	usernames, err = h.Redis.SMembers(ctx, "user_prefix:"+queryLower).Result()

	fmt.Printf("usernames are %s", usernames)
	if err != nil || len(usernames) == 0 {
		usernames, err = h.Redis.SMembers(ctx, "user_prefix:"+query).Result()
		if err != nil || len(usernames) == 0 {
			usernames, err = h.Redis.SMembers(ctx, "user_prefix:"+queryUpper).Result()
			if err != nil || len(usernames) == 0 {
				c.JSON(http.StatusOK, []gin.H{})
				return
			}
		}
	}

	type Resp struct {
		Rank     int64  `json:"rank"`
		Username string `json:"username"`
		Rating   int    `json:"rating"`
	}

	result := make([]Resp, 0, len(usernames))

	for _, username := range usernames {
		if ctx.Err() != nil {
			// Context cancelled, return what we have so far
			break
		}

		rating, err := h.Redis.ZScore(ctx, "leaderboard", username).Result()
		if err != nil {
			continue
		}

		higherCount, _ := h.Redis.ZCount(
			ctx,
			"leaderboard",
			fmt.Sprintf("(%d", int(rating)),
			"+inf",
		).Result()

		result = append(result, Resp{
			Rank:     higherCount + 1,
			Username: username,
			Rating:   int(rating),
		})
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].Rank < result[j].Rank
	})

	c.JSON(http.StatusOK, result)
}
