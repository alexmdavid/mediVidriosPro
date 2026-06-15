package main

import (
	"fmt"

	"golang.org/x/crypto/bcrypt"
)

func main() {
	hash, err := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
	if err != nil {
		fmt.Println("Error:", err)
		return
	}
	fmt.Println("Hash for 'admin123':", string(hash))

	existing := "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"
	err = bcrypt.CompareHashAndPassword([]byte(existing), []byte("admin123"))
	if err != nil {
		fmt.Println("Existing hash does NOT match 'admin123':", err)
	} else {
		fmt.Println("Existing hash matches 'admin123': true")
	}
}
