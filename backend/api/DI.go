package api

import (
	"database/sql"

	"github.com/redis/go-redis/v9"
)

type Handler struct {
	Postgres *sql.DB

	Redis *redis.Client
}

func DependInjection(postgres *sql.DB, redis *redis.Client) *Handler {
	return &Handler{
		Postgres: postgres,
		Redis:    redis,
	}
}
