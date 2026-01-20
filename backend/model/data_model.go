package model

type User struct {
	UserId   int    `json:"user_id"`
	UserName string `json:"username"`
	Rating   int    `json:"rating"`
}
