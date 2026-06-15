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

// keyType es un tipo interno para las llaves del contexto, evitando colisiones.
type keyType string

const claimsKey keyType = "claims"

var jwtSecret []byte

func init() {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "mediVidrios-secret-key-2024-change-in-production"
	}
	jwtSecret = []byte(secret)
}

// AuthClaims es el payload del JWT.
// Soporta tanto usuarios administrativos (UsuarioID > 0) como clientes (ClienteID > 0).
type AuthClaims struct {
	UsuarioID int    `json:"usuario_id"`
	ClienteID int    `json:"cliente_id,omitempty"`
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

	// Sincronizar: auto-crear registro en tabla clientes si no existe
	clienteEmail := strings.TrimSpace(strings.ToLower(req.Email))
	clienteTelefono := strings.TrimSpace(req.Telefono)
	h.service.SincronizarClienteDesdeUsuario(usuario.Nombre, clienteEmail, clienteTelefono)

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
// Login con Google - SOLO tabla clientes para nuevos registros
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

	email := strings.ToLower(req.Email)

	// 1. Buscar primero en usuarios (para admins/vendedores que ya tienen Google vinculado)
	usuario, _ := h.service.ObtenerUsuarioPorEmail(email)
	if usuario != nil {
		log.Printf("🔐 Google Login: usuario encontrado en tabla usuarios (ID=%d, Rol=%s)", usuario.ID, usuario.Rol)

		// Vincular/actualizar Google ID si es necesario
		if usuario.GoogleID == nil || *usuario.GoogleID != req.GoogleID {
			usuario.GoogleID = strPtr(req.GoogleID)
			// Actualizar Google ID en DB (no tenemos método directo, pero service lo manejará)
		}

		// Sincronizar cliente automáticamente
		h.service.SincronizarClienteDesdeUsuario(usuario.Nombre, email, "")

		// Generar token de usuario (con usuario_id)
		token, err := generarToken(usuario)
		if err != nil {
			sendError(w, http.StatusInternalServerError, "Error al generar token", err.Error())
			return
		}

		sendJSON(w, http.StatusOK, domain.AuthResponse{
			Token:   token,
			Usuario: *usuario,
		})
		return
	}

	// 2. Buscar en clientes (para clientes que usan Google como único medio de auth)
	cliente, _, err := h.service.CrearClienteConGoogle(req.Nombre, email, req.GoogleID)
	if err != nil {
		log.Printf("❌ Google Login: error al procesar cliente: %v", err)
		sendError(w, http.StatusInternalServerError, "Error al procesar autenticación", err.Error())
		return
	}

	log.Printf("🔐 Google Login: cliente autenticado/creado ID=%d", cliente.ID)

	// Generar token con ClienteID en lugar de UsuarioID
	token, err := generarTokenCliente(cliente)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Error al generar token", err.Error())
		return
	}

	// Construir AuthResponse con datos del cliente convertidos a Usuario
	resp := domain.AuthResponse{
		Token: token,
		Usuario: domain.Usuario{
			ID:     0, // No es un usuario interno
			Nombre: cliente.Nombre,
			Email:  email,
			Rol:    "cliente",
			Activo: true,
		},
	}

	sendJSON(w, http.StatusOK, resp)
}

// generarTokenCliente genera un JWT para un cliente autenticado con Google
// (sin registro en la tabla usuarios).
func generarTokenCliente(cliente *domain.Cliente) (string, error) {
	email := ""
	if cliente.Email != nil {
		email = *cliente.Email
	}

	claims := AuthClaims{
		ClienteID: cliente.ID,
		Email:     email,
		Rol:       "cliente",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(72 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

// =============================================================
// Perfil del usuario autenticado
// =============================================================

func (h *AuthHandler) Perfil(w http.ResponseWriter, r *http.Request) {
	claims := ObtenerClaims(r)
	if claims == nil {
		log.Printf("⚠️ PERFIL: Intento de acceso sin claims en el contexto")
		sendError(w, http.StatusUnauthorized, "No autenticado", "")
		return
	}

	// Si es un cliente (sin usuario_id), devolver datos del cliente
	if claims.ClienteID > 0 {
		log.Printf("🔍 PERFIL CLIENTE: Consultando datos para ClienteID=%d", claims.ClienteID)
		cliente, err := h.service.ObtenerCliente(claims.ClienteID)
		if err != nil || cliente == nil {
			sendError(w, http.StatusNotFound, "Cliente no encontrado", "")
			return
		}
		usuario := &domain.Usuario{
			ID:     0,
			Nombre: cliente.Nombre,
			Email:  *cliente.Email,
			Rol:    "cliente",
			Activo: true,
		}
		if cliente.Email != nil {
			usuario.Email = *cliente.Email
		} else {
			usuario.Email = ""
		}
		sendJSON(w, http.StatusOK, usuario)
		return
	}

	log.Printf("🔍 PERFIL: Consultando datos para UsuarioID=%d (Email: %s)", claims.UsuarioID, claims.Email)
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
// Cliente: Ver mis cotizaciones
// =============================================================

func (h *AuthHandler) MisCotizaciones(w http.ResponseWriter, r *http.Request) {
	claims := ObtenerClaims(r)
	if claims == nil {
		sendError(w, http.StatusUnauthorized, "No autenticado", "")
		return
	}

	// Usar cliente_id o usuario_id según corresponda
	clienteID := claims.ClienteID
	if clienteID <= 0 {
		// Usuario de la tabla usuarios: buscar si tiene un cliente asociado
		usuario, err := h.service.ObtenerUsuarioPorID(claims.UsuarioID)
		if err != nil || usuario == nil {
			sendError(w, http.StatusNotFound, "Usuario no encontrado", "")
			return
		}
		// Buscar cliente por email
		cliente, _ := h.service.ObtenerClientePorEmail(usuario.Email)
		if cliente != nil {
			clienteID = cliente.ID
		} else {
			sendError(w, http.StatusNotFound, "Cliente no encontrado para este usuario", "")
			return
		}
	}

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("pageSize"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}

	// Configurar filtros explícitos
	filtros := &domain.FiltrosCotizacion{}
	if claims.ClienteID > 0 {
		filtros.ClienteID = claims.ClienteID
	} else {
		filtros.UsuarioID = claims.UsuarioID
	}

	cotizaciones, total, err := h.service.ListarCotizaciones(page, pageSize, filtros)
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
			log.Printf("⚠️ AUTH: Falta header de Authorization en %s", r.URL.Path)
			sendJSON(w, http.StatusUnauthorized, domain.ErrorResponse{Error: "Token de autenticación requerido"})
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			log.Printf("⚠️ AUTH: Formato de token inválido")
			sendJSON(w, http.StatusUnauthorized, domain.ErrorResponse{Error: "Formato de token inválido"})
			return
		}

		token, err := jwt.ParseWithClaims(parts[1], &AuthClaims{}, func(token *jwt.Token) (interface{}, error) {
			return jwtSecret, nil
		})

		if err != nil || !token.Valid {
			log.Printf("⚠️ AUTH: Token inválido o expirado: %v", err)
			sendJSON(w, http.StatusUnauthorized, domain.ErrorResponse{Error: "Token inválido o expirado"})
			return
		}

		claims, ok := token.Claims.(*AuthClaims)
		if !ok {
			log.Printf("⚠️ AUTH: No se pudieron extraer claims del token")
			sendJSON(w, http.StatusUnauthorized, domain.ErrorResponse{Error: "Claims inválidos"})
			return
		}

		ctx := context.WithValue(r.Context(), claimsKey, claims)
		next(w, r.WithContext(ctx))
	}
}

// AdminMiddleware verifica que el usuario sea admin.
func AdminMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims := ObtenerClaims(r)
		if claims == nil {
			log.Printf("🚫 ADMIN: Acceso denegado, no hay claims en la petición %s", r.URL.Path)
			sendJSON(w, http.StatusForbidden, domain.ErrorResponse{Error: "Acceso restringido a administradores"})
			return
		}
		if claims.Rol != "admin" || claims.UsuarioID <= 0 {
			log.Printf("🚫 ADMIN: Acceso denegado. UsuarioID=%d, ClienteID=%d, Rol='%s' - requiere rol 'admin' y usuario_id > 0", claims.UsuarioID, claims.ClienteID, claims.Rol)
			sendJSON(w, http.StatusForbidden, domain.ErrorResponse{Error: "Acceso restringido a administradores"})
			return
		}
		next(w, r)
	}
}

// ObtenerClaims extrae los claims del contexto.
func ObtenerClaims(r *http.Request) *AuthClaims {
	claims, ok := r.Context().Value(claimsKey).(*AuthClaims)
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
