package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	_ "github.com/lib/pq"
)

func main() {
	databaseURL := "host=ep-ancient-bread-atmgyfei-pooler.c-9.us-east-1.aws.neon.tech port=5432 user=neondb_owner password=npg_rYm5u2NFKfUl dbname=neondb sslmode=require"
	// Allow override via env
	if envURL := os.Getenv("DATABASE_URL"); envURL != "" {
		databaseURL = envURL
	}

	// Read migration file
	migrationFile := "migrations/001_initial.sql"
	if len(os.Args) > 1 {
		migrationFile = os.Args[1]
	}

	sqlContent, err := os.ReadFile(migrationFile)
	if err != nil {
		log.Fatalf("Error reading migration file %s: %v", migrationFile, err)
	}

	log.Printf("🔌 Connecting to database...")
	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		log.Fatalf("Error connecting: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatalf("Error pinging database: %v", err)
	}

	log.Printf("✅ Connected. Executing migration...")
	log.Printf("📄 File: %s (%d bytes)", migrationFile, len(sqlContent))

	_, err = db.Exec(string(sqlContent))
	if err != nil {
		log.Fatalf("Error executing migration: %v", err)
	}

	fmt.Println("✅ Migration executed successfully!")
}
