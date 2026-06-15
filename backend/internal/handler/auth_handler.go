package handler

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/mux"
	"golang.org/x/crypto/bcrypt"

	"github.com/mediVidrios/backend/internal/domain"
	"github.com/mediVidrios/backend/internal/service"
)

// =============================================================
// Auth Handler - Login, Registro, Gestión de usuarios
// =============================================================

var jwtSecret []byte

func init() {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "mediVidrios-secret-key-2024-change-in-production"
	}
	jwtSecret = []byte(secret)
}

// AuthClaims es el payload del JWT.
type AuthClaims struct {
	UsuarioID int    `json:"usuario_id"`
	Email     string `json:"email"`
	Rol       string `json:"rol"`
	jwt.RegisteredClaims
}

// AuthHandler maneja autenticación y usuarios.
type AuthHandler struct {
	service *service.CotizacionService
}

// NewAuthHandler crea una nueva instancia.
func NewAuthHandler(svc *service.CotizacionService) *AuthHandler {
	return &AuthHandler{service: svc}
}

// RegisterRoutes registra rutas de auth.
func (h *AuthHandler) RegisterRoutes(r *mux.Router) {
	api := r.PathPrefix("/api").Subrouter()

	// Públicas
	api.HandleFunc("/auth/registro", h.Registro).Methods("POST")
	api.HandleFunc("/auth/login", h.Login).Methods("POST")
	api.HandleFunc("/auth/google", h.GoogleLogin).Methods("POST")

	// Protegidas (requieren token)
	api.HandleFunc("/auth/perfil", AuthMiddleware(h.Perfil)).Methods("GET")

	// Admin
	api.HandleFunc("/auth/usuarios", AuthMiddleware(AdminMiddleware(h.ListarUsuarios))).Methods("GET")
	api.HandleFunc("/auth/usuarios/{id:[0-9]+}", AuthMiddleware(AdminMiddleware(h.EliminarUsuario))).Methods("DELETE")

	// Admin: CRUD cotizaciones
	api.HandleFunc("/cotizaciones/{id:[0-9]+}", AuthMiddleware(AdminMiddleware(h.ActualizarCotizacion))).Methods("PUT")
	api.HandleFunc("/cotizaciones/{id:[0-9]+}", AuthMiddleware(AdminMiddleware(h.EliminarCotizacion))).Methods("DELETE")
	api.HandleFunc("/cotizaciones/{id:[0-9]+}/asignar", AuthMiddleware(AdminMiddleware(h.AsignarCotizacion))).Methods("PUT")

	// Cliente: sus cotizaciones
	api.HandleFunc("/mis-cotizaciones", AuthMiddleware(h.MisCotizaciones)).Methods("GET")
	api.HandleFunc("/cotizaciones/{id:[0-9]+}/responder", AuthMiddleware(h.ResponderCotizacion)).Methods("PUT")
}

// =============================================================
// Registro de usuario
// =============================================================

func (h *AuthHandler) Registro(w http.ResponseWriter, r *http.Request) {
	var req domain.RegistroRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "JSON inválido", err.Error())
		return
	}

	if strings.TrimSpace(req.Nombre) == "" || strings.TrimSpace(req.Email) == "" || req.Password == "" {
		sendError(w, http.StatusBadRequest, "Nombre, email y contraseña son obligatorios", "")
		return
	}

	if len(req.Password) < 6 {
		sendError(w, http.StatusBadRequest, "La contraseña debe tener al menos 6 caracteres", "")
		return
	}

	// Verificar si el email ya existe
	existente, _ := h.service.ObtenerUsuarioPorEmail(strings.TrimSpace(req.Email))
	if existente != nil {
		sendError(w, http.StatusConflict, "El email ya está registrado", "")
		return
	}

	// Hash de contraseña
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Error al procesar contraseña", err.Error())
		return
	}

	usuario := &domain.Usuario{
		Nombre:       strings.TrimSpace(req.Nombre),
		Email:        strings.TrimSpace(strings.ToLower(req.Email)),
		PasswordHash: strPtr(string(hash)),
		Rol:          "cliente",
		Telefono:     strPtr(req.Telefono),
		Activo:       true,
	}

	id, err := h.service.CrearUsuario(usuario)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Error al crear usuario", err.Error())
		return
	}
	usuario.ID = id

	// Generar token
	token, err := generarToken(usuario)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Error al generar token", err.Error())
		return
	}

	sendJSON(w, http.StatusCreated, domain.AuthResponse{
		Token:   token,
		Usuario: *usuario,
	})
}

// =============================================================
// Login con email/password
// =============================================================

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req domain.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("❌ LOGIN: Error decodificando JSON: %v", err)
		sendError(w, http.StatusBadRequest, "JSON inválido", err.Error())
		return
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Password = strings.TrimSpace(req.Password)

	log.Printf("🔍 Intentando login para: [%s] (Pass len: %d)", req.Email, len(req.Password))

	if req.Email == "" || req.Password == "" {
		log.Printf("⚠️ Login rechazado: campos vacíos")
		sendError(w, http.StatusBadRequest, "Email y contraseña son obligatorios", "")
		return
	}

	usuario, err := h.service.ObtenerUsuarioPorEmail(req.Email)
	if err != nil {
		log.Printf("❌ LOGIN DB ERROR para %s: %v", req.Email, err)
		sendError(w, http.StatusInternalServerError, "Error interno del servidor", "")
		return
	}

	if usuario == nil {
		log.Printf("⚠️ LOGIN FALLIDO: Usuario [%s] no existe en la base de datos", req.Email)
		sendError(w, http.StatusUnauthorized, "Credenciales inválidas", "")
		return
	}

	if usuario.PasswordHash == nil {
		log.Printf("⚠️ Login fallido: El usuario %s no tiene hash de password (usa Google Login)", req.Email)
		sendError(w, http.StatusUnauthorized, "Esta cuenta usa login con Google", "")
		return
	}

	log.Printf("🔑 Comparando hashes para %s. Hash en DB empieza por: %s...", req.Email, (*usuario.PasswordHash)[:10])
	err = bcrypt.CompareHashAndPassword([]byte(*usuario.PasswordHash), []byte(req.Password))
	if err != nil {
		hashLen := len(*usuario.PasswordHash)
		log.Printf("⚠️ LOGIN FALLIDO: Password mismatch para %s (Bcrypt err: %v, HashLen: %d, InputLen: %d)", req.Email, err, hashLen, len(req.Password))
		sendError(w, http.StatusUnauthorized, "Credenciales inválidas", "")
		return
	}

	log.Printf("✅ LOGIN EXITOSO: Usuario %s autenticado correctamente", req.Email)

	token, err := generarToken(usuario)
	if err != nil {
		log.Printf("❌ ERROR generando token para %s: %v", req.Email, err)
		sendError(w, http.StatusInternalServerError, "Error al generar token", err.Error())
		return
	}

	sendJSON(w, http.StatusOK, domain.AuthResponse{
		Token:   token,
		Usuario: *usuario,
	})
}

// =============================================================
// Login con Google (simplificado - en producción verificar token de Google)
// =============================================================

func (h *AuthHandler) GoogleLogin(w http.ResponseWriter, r *http.Request) {
	log.Printf("🔐 Google Login: recibido request desde %s", r.RemoteAddr)

	var req domain.GoogleLoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("❌ Google Login: JSON inválido: %v", err)
		sendError(w, http.StatusBadRequest, "JSON inválido", err.Error())
		return
	}

	log.Printf("🔐 Google Login: email=%s, google_id=%s, nombre=%s", req.Email, req.GoogleID, req.Nombre)

	if req.GoogleID == "" || req.Email == "" {
		log.Printf("❌ Google Login: campos obligatorios faltantes")
		sendError(w, http.StatusBadRequest, "Google ID y email son obligatorios", "")
		return
	}

	// Buscar usuario existente por Google ID
	usuario, err := h.service.ObtenerUsuarioPorGoogleID(req.GoogleID)
	if err != nil {
		log.Printf("⚠️ Google Login: error al buscar por Google ID: %v", err)
	}
	if usuario == nil {
		// Buscar por email
		usuario, err = h.service.ObtenerUsuarioPorEmail(req.Email)
		if err != nil {
			log.Printf("⚠️ Google Login: error al buscar por email: %v", err)
		}
		if usuario == nil {
			log.Printf("🔐 Google Login: creando nuevo usuario para %s", req.Email)
			// Crear nuevo usuario
			nuevoUsuario := &domain.Usuario{
				Nombre:   req.Nombre,
				Email:    strings.ToLower(req.Email),
				GoogleID: strPtr(req.GoogleID),
				Rol:      "cliente",
				Activo:   true,
			}
			id, err := h.service.CrearUsuario(nuevoUsuario)
			if err != nil {
				log.Printf("❌ Google Login: error al crear usuario: %v", err)
				sendError(w, http.StatusInternalServerError, "Error al crear usuario", err.Error())
				return
			}
			nuevoUsuario.ID = id
			usuario = nuevoUsuario
			log.Printf("✅ Google Login: usuario creado con ID %d", id)
		} else {
			log.Printf("🔐 Google Login: vinculando Google ID a usuario existente %d", usuario.ID)
			// Vincular Google ID
			usuario.GoogleID = strPtr(req.GoogleID)
		}
	} else {
		log.Printf("🔐 Google Login: usuario encontrado ID=%d", usuario.ID)
	}

	token, err := generarToken(usuario)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Error al generar token", err.Error())
		return
	}

	sendJSON(w, http.StatusOK, domain.AuthResponse{
		Token:   token,
		Usuario: *usuario,
	})
}

// =============================================================
// Perfil del usuario autenticado
// =============================================================

func (h *AuthHandler) Perfil(w http.ResponseWriter, r *http.Request) {
	claims := ObtenerClaims(r)
	if claims == nil {
		sendError(w, http.StatusUnauthorized, "No autenticado", "")
		return
	}

	usuario, err := h.service.ObtenerUsuarioPorID(claims.UsuarioID)
	if err != nil || usuario == nil {
		sendError(w, http.StatusNotFound, "Usuario no encontrado", "")
		return
	}

	sendJSON(w, http.StatusOK, usuario)
}

// =============================================================
// Listar usuarios (admin)
// =============================================================

func (h *AuthHandler) ListarUsuarios(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("pageSize"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 50
	}

	usuarios, total, err := h.service.ListarUsuarios(page, pageSize)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Error al listar usuarios", err.Error())
		return
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"data":  usuarios,
		"total": total,
		"page":  page,
	})
}

// =============================================================
// Eliminar usuario (admin)
// =============================================================

func (h *AuthHandler) EliminarUsuario(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		sendError(w, http.StatusBadRequest, "ID inválido", "")
		return
	}

	if err := h.service.EliminarUsuario(id); err != nil {
		sendError(w, http.StatusInternalServerError, "Error al eliminar usuario", err.Error())
		return
	}

	sendJSON(w, http.StatusOK, map[string]string{"mensaje": "Usuario eliminado"})
}

// =============================================================
// Admin: Actualizar cotización
// =============================================================

func (h *AuthHandler) ActualizarCotizacion(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		sendError(w, http.StatusBadRequest, "ID inválido", "")
		return
	}

	var req domain.ActualizarCotizacionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "JSON inválido", err.Error())
		return
	}

	if err := h.service.ActualizarCotizacion(id, &req); err != nil {
		sendError(w, http.StatusInternalServerError, "Error al actualizar cotización", err.Error())
		return
	}

	sendJSON(w, http.StatusOK, map[string]string{"mensaje": "Cotización actualizada"})
}

// =============================================================
// Admin: Eliminar cotización
// =============================================================

func (h *AuthHandler) EliminarCotizacion(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		sendError(w, http.StatusBadRequest, "ID inválido", "")
		return
	}

	if err := h.service.EliminarCotizacion(id); err != nil {
		sendError(w, http.StatusInternalServerError, "Error al eliminar cotización", err.Error())
		return
	}

	sendJSON(w, http.StatusOK, map[string]string{"mensaje": "Cotización eliminada"})
}

// =============================================================
// Admin: Asignar cotización a cliente
// =============================================================

func (h *AuthHandler) AsignarCotizacion(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		sendError(w, http.StatusBadRequest, "ID inválido", "")
		return
	}

	var req struct {
		UsuarioClienteID int `json:"usuario_cliente_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "JSON inválido", err.Error())
		return
	}

	updateReq := &domain.ActualizarCotizacionRequest{
		UsuarioClienteID: &req.UsuarioClienteID,
	}

	if err := h.service.ActualizarCotizacion(id, updateReq); err != nil {
		sendError(w, http.StatusInternalServerError, "Error al asignar cotización", err.Error())
		return
	}

	sendJSON(w, http.StatusOK, map[string]string{"mensaje": "Cotización asignada al cliente"})
}

// =============================================================
// Cliente: Ver mis cotizaciones
// =============================================================

func (h *AuthHandler) MisCotizaciones(w http.ResponseWriter, r *http.Request) {
	claims := ObtenerClaims(r)
	if claims == nil {
		sendError(w, http.StatusUnauthorized, "No autenticado", "")
		return
	}

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("pageSize"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}

	cotizaciones, total, err := h.service.ListarCotizacionesPorCliente(claims.UsuarioID, page, pageSize)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Error al listar cotizaciones", err.Error())
		return
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"data":       cotizaciones,
		"total":      total,
		"page":       page,
		"pageSize":   pageSize,
		"totalPages": (total + pageSize - 1) / pageSize,
	})
}

// =============================================================
// Cliente: Aceptar/rechazar cotización
// =============================================================

func (h *AuthHandler) ResponderCotizacion(w http.ResponseWriter, r *http.Request) {
	claims := ObtenerClaims(r)
	if claims == nil {
		sendError(w, http.StatusUnauthorized, "No autenticado", "")
		return
	}

	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		sendError(w, http.StatusBadRequest, "ID inválido", "")
		return
	}

	var req domain.ResponderCotizacionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "JSON inválido", err.Error())
		return
	}

	if err := h.service.ResponderCotizacion(id, req.Aceptada, req.Notas); err != nil {
		sendError(w, http.StatusInternalServerError, "Error al responder cotización", err.Error())
		return
	}

	sendJSON(w, http.StatusOK, map[string]string{"mensaje": "Respuesta registrada"})
}

// =============================================================
// JWT Helpers
// =============================================================

func generarToken(usuario *domain.Usuario) (string, error) {
	claims := AuthClaims{
		UsuarioID: usuario.ID,
		Email:     usuario.Email,
		Rol:       usuario.Rol,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(72 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

// AuthMiddleware verifica el token JWT.
func AuthMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			sendJSON(w, http.StatusUnauthorized, domain.ErrorResponse{Error: "Token de autenticación requerido"})
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			sendJSON(w, http.StatusUnauthorized, domain.ErrorResponse{Error: "Formato de token inválido"})
			return
		}

		token, err := jwt.ParseWithClaims(parts[1], &AuthClaims{}, func(token *jwt.Token) (interface{}, error) {
			return jwtSecret, nil
		})

		if err != nil || !token.Valid {
			sendJSON(w, http.StatusUnauthorized, domain.ErrorResponse{Error: "Token inválido o expirado"})
			return
		}

		claims, ok := token.Claims.(*AuthClaims)
		if !ok {
			sendJSON(w, http.StatusUnauthorized, domain.ErrorResponse{Error: "Claims inválidos"})
			return
		}

		// Guardar claims en el contexto (usando URL para simplificar)
		ctx := r.Context()
		ctx = context.WithValue(ctx, "claims", claims)
		next(w, r.WithContext(ctx))
	}
}

// AdminMiddleware verifica que el usuario sea admin.
func AdminMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims := ObtenerClaims(r)
		if claims == nil || claims.Rol != "admin" {
			sendJSON(w, http.StatusForbidden, domain.ErrorResponse{Error: "Acceso restringido a administradores"})
			return
		}
		next(w, r)
	}
}

// ObtenerClaims extrae los claims del contexto.
func ObtenerClaims(r *http.Request) *AuthClaims {
	claims, ok := r.Context().Value("claims").(*AuthClaims)
	if !ok {
		return nil
	}
	return claims
}

// =============================================================
// Helpers
// =============================================================

func strPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
