package main

import (
	"fmt"
	"log"
	"os"

	"matkis/backend/api"
	"matkis/backend/db"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {

	if err := godotenv.Load(); err != nil {
		log.Println(".env file not found, using system env")
	}

	postgresURL := os.Getenv("POSTGRES_URL")
	if postgresURL == "" {
		log.Fatal("POSTGRES_URL not set")
	}

	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		log.Fatal("REDIS_URL not set")
	}

	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		log.Fatal("FRONTEND_URL not set")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dbConn, err := db.ConnectDB(postgresURL)
	if err != nil {
		log.Fatal("failed to connect to postgres:", err)
	}
	defer dbConn.Close()
	fmt.Println("Connected to Postgres")

	redisClient, err := db.ConnectRedis(redisURL)
	if err != nil {
		log.Fatal("failed to connect to redis:", err)
	}
	defer redisClient.Close()
	fmt.Println("Connected to Redis")

	r := gin.Default()

	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", frontendURL)
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set(
			"Access-Control-Allow-Headers",
			"Content-Type, Authorization",
		)
		c.Writer.Header().Set(
			"Access-Control-Allow-Methods",
			"GET, POST, PUT, DELETE, OPTIONS",
		)

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	h := api.DependInjection(dbConn, redisClient)
	api.StartDBWorkers(dbConn, 8)

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	r.POST("/api/users", h.InsertUser)
	r.GET("/api/leadboard", h.FetchUser)
	r.GET("/api/username", h.SearchUser)
	r.POST("/api/simulate", h.SimulateMultiUserUpdates)

	if err := r.Run(":" + port); err != nil {
		log.Fatal("server failed:", err)
	}
}
