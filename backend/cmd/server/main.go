package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gorilla/mux"
	"github.com/lib/pq"
	"github.com/rs/cors"

	"github.com/mediVidrios/backend/internal/handler"
	"github.com/mediVidrios/backend/internal/infrastructure"
	"github.com/mediVidrios/backend/internal/service"
)

// =============================================================
// mediVidrios API - Servidor principal
// =============================================================

func main() {
	// ---- Configuración desde variables de entorno ----
	port := getEnv("PORT", "8080")
	databaseURL := getEnv("DATABASE_URL", "")

	// Si no hay URL configurada, usar Neon PostgreSQL (IPv4 compatible)
	if databaseURL == "" {
		databaseURL = "postgresql://neondb_owner:npg_rYm5u2NFKfUl@ep-ancient-bread-atmgyfei-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require"
	}

	// Asegurar sslmode si no está especificado
	// Para conexiones locales usar disable, para remote usar require
	if !containsSSLMode(databaseURL) {
		if containsQuerySeparator(databaseURL) {
			databaseURL += "&sslmode=disable"
		} else {
			databaseURL += "?sslmode=disable"
		}
	}

	log.Printf("📡 URL de conexión (host): %s", extractHost(databaseURL))

	// ---- Conectar a PostgreSQL ----
	log.Printf("🔌 Conectando a base de datos...")

	// TRUCO MAESTRO: Traducimos la URL a formato DSN plano (key=value)
	// Esto desarma la URL y evita que el driver se confunda con el IPv6 de Render
	// Asegúrate de que no esté solo como _ "github.com/lib/pq" si usas pq.ParseURL

	dsnPlano, err := pq.ParseURL(databaseURL)
	if err != nil {
		log.Printf("⚠️ Advertencia al parsear URL (posiblemente ya es DSN): %v", err)
		dsnPlano = databaseURL // Fallback por si ya venía formateado
	}

	// Le pasamos el dsnPlano corregido a tu infraestructura
	db, err := infrastructure.NewPostgresDB(dsnPlano)
	if err != nil {
		log.Fatalf("❌ Error al conectar a la base de datos: %v", err)
	}
	defer db.Close()
	log.Printf("✅ Conexión a PostgreSQL establecida")

	// ---- Inicializar capas de arquitectura ----
	cotizacionService := service.NewCotizacionService(
		db.TipoVidrioRepo,
		db.ClienteRepo,
		db.CotizacionRepo,
		db.UsuarioRepo,
	)

	cotizacionHandler := handler.NewCotizacionHandler(cotizacionService)
	authHandler := handler.NewAuthHandler(cotizacionService)

	// ---- Configurar router ----
	router := mux.NewRouter()

	// Health check
	router.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{"status":"ok","service":"mediVidrios-api","timestamp":"%s"}`, time.Now().UTC().Format(time.RFC3339))
	}).Methods("GET")

	// Registrar rutas de la API
	cotizacionHandler.RegisterRoutes(router)
	authHandler.RegisterRoutes(router)

	// ---- Configurar CORS ----
	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"http://localhost:5173", "http://localhost:3000", "http://localhost:5174", "https://medividriospro-1.onrender.com"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization", "Accept"},
		AllowCredentials: true,
		MaxAge:           43200, // 12 hours in seconds
	})

	// Middleware para agregar headers COOP/COEP (necesario para Google Identity Services)
	coOpHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cross-Origin-Opener-Policy", "same-origin-allow-popups")
		w.Header().Set("Cross-Origin-Embedder-Policy", "unsafe-none")
		c.Handler(router).ServeHTTP(w, r)
	})

	handler := coOpHandler

	// ---- Iniciar servidor ----
	serverAddr := fmt.Sprintf(":%s", port)
	log.Printf("🚀 mediVidrios API iniciada en http://localhost%s", serverAddr)
	log.Printf("📋 Endpoints disponibles:")
	log.Printf("   GET  /health")
	log.Printf("   GET  /api/tipos-vidrio")
	log.Printf("   POST /api/cotizaciones")
	log.Printf("   GET  /api/cotizaciones")
	log.Printf("   GET  /api/cotizaciones/{id}")
	log.Printf("   POST /api/cotizaciones/preview")

	// Graceful shutdown
	go func() {
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
		<-sigChan
		log.Println("🛑 Cerrando servidor...")
		os.Exit(0)
	}()

	if err := http.ListenAndServe(serverAddr, handler); err != nil {
		log.Fatalf("❌ Error al iniciar servidor: %v", err)
	}
}

// getEnv obtiene una variable de entorno con un valor por defecto.
func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}

// containsSSLMode verifica si la URL ya contiene un parámetro sslmode.
func containsSSLMode(dbURL string) bool {
	for _, param := range []string{"sslmode=require", "sslmode=prefer", "sslmode=disable", "sslmode=allow"} {
		if len(dbURL) >= len(param) {
			for i := 0; i <= len(dbURL)-len(param); i++ {
				if dbURL[i:i+len(param)] == param {
					return true
				}
			}
		}
	}
	return false
}

// containsQuerySeparator verifica si la URL ya tiene un ? o &
func containsQuerySeparator(dbURL string) bool {
	for i := len(dbURL) - 1; i >= 0; i-- {
		if dbURL[i] == '@' {
			break
		}
		if dbURL[i] == '?' || dbURL[i] == '&' {
			return true
		}
	}
	return false
}

// extractHost extrae solo el host de la URL para logging seguro.
func extractHost(dbURL string) string {
	// Buscar entre @ y / (o fin de string)
	atIdx := -1
	for i := 0; i < len(dbURL); i++ {
		if dbURL[i] == '@' {
			atIdx = i
			break
		}
	}
	if atIdx == -1 {
		return "(sin host)"
	}
	rest := dbURL[atIdx+1:]
	slashIdx := -1
	for i := 0; i < len(rest); i++ {
		if rest[i] == '/' {
			slashIdx = i
			break
		}
	}
	if slashIdx == -1 {
		return rest
	}
	return rest[:slashIdx]
}
