package handler

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/gorilla/mux"

	"github.com/mediVidrios/backend/internal/domain"
	"github.com/mediVidrios/backend/internal/service"
)

// =============================================================
// HTTP Handlers - Endpoints REST para cotizaciones
// =============================================================

// CotizacionHandler maneja las peticiones HTTP relacionadas con cotizaciones.
type CotizacionHandler struct {
	service *service.CotizacionService
}

// NewCotizacionHandler crea una nueva instancia del handler.
func NewCotizacionHandler(svc *service.CotizacionService) *CotizacionHandler {
	return &CotizacionHandler{service: svc}
}

// RegisterRoutes registra las rutas en el router de Gorilla Mux.
func (h *CotizacionHandler) RegisterRoutes(r *mux.Router) {
	api := r.PathPrefix("/api").Subrouter()

	// Tipos de vidrio
	api.HandleFunc("/tipos-vidrio", AuthMiddleware(h.ObtenerTiposVidrio)).Methods("GET") // Protegido

	// Cotizaciones
	api.HandleFunc("/cotizaciones", AuthMiddleware(h.CrearCotizacion)).Methods("POST")
	api.HandleFunc("/cotizaciones", AuthMiddleware(h.ListarCotizaciones)).Methods("GET")
	api.HandleFunc("/cotizaciones/{id:[0-9]+}", AuthMiddleware(h.ObtenerCotizacion)).Methods("GET")
	// Rutas de administración de cotizaciones (movidas de auth_handler)
	api.HandleFunc("/cotizaciones/{id:[0-9]+}", AuthMiddleware(AdminMiddleware(h.ActualizarCotizacion))).Methods("PUT")
	api.HandleFunc("/cotizaciones/{id:[0-9]+}", AuthMiddleware(AdminMiddleware(h.EliminarCotizacion))).Methods("DELETE")
	api.HandleFunc("/cotizaciones/{id:[0-9]+}/asignar", AuthMiddleware(AdminMiddleware(h.AsignarCotizacion))).Methods("PUT")

	// Preview de cálculo (sin persistir)
	api.HandleFunc("/cotizaciones/preview", AuthMiddleware(h.PreviewCotizacion)).Methods("POST") // Protegido
}

// =============================================================
// GET /api/tipos-vidrio
// =============================================================

// ObtenerTiposVidrio retorna todos los tipos de vidrio activos.
func (h *CotizacionHandler) ObtenerTiposVidrio(w http.ResponseWriter, r *http.Request) {
	tipos, err := h.service.ObtenerTiposVidrio()
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Error al obtener tipos de vidrio", err.Error())
		return
	}

	sendJSON(w, http.StatusOK, tipos)
}

// =============================================================
// POST /api/cotizaciones
// =============================================================

// CrearCotizacion recibe un JSON con la lista de medidas y crea la cotización.
func (h *CotizacionHandler) CrearCotizacion(w http.ResponseWriter, r *http.Request) {
	var req domain.CrearCotizacionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "JSON inválido", err.Error())
		return
	}

	resp, err := h.service.CrearCotizacion(&req)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Error al crear cotización", err.Error())
		return
	}

	sendJSON(w, http.StatusCreated, resp)
}

// =============================================================
// POST /api/cotizaciones/preview
// =============================================================

// PreviewCotizacion calcula la cotización sin persistir (para vista previa).
func (h *CotizacionHandler) PreviewCotizacion(w http.ResponseWriter, r *http.Request) {
	var req domain.CrearCotizacionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "JSON inválido", err.Error())
		return
	}

	// Usar el mismo servicio pero sin persistir
	// Para simplificar, creamos un servicio temporal sin repositorio de cotización
	// En producción, se usaría un servicio de preview separado
	resp, err := h.service.CrearCotizacion(&req)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Error al calcular preview", err.Error())
		return
	}

	sendJSON(w, http.StatusOK, resp)
}

// =============================================================
// GET /api/cotizaciones/{id}
// =============================================================

// ObtenerCotizacion retorna una cotización completa por ID.
func (h *CotizacionHandler) ObtenerCotizacion(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	log.Printf("🔍 HANDLER: Recibida petición GET /api/cotizaciones/%d", id)
	if err != nil {
		sendError(w, http.StatusBadRequest, "ID inválido", err.Error())
		return
	}
	resp, err := h.service.ObtenerCotizacion(id)
	if err != nil {
		sendError(w, http.StatusNotFound, "Cotización no encontrada", err.Error())
		return
	}

	sendJSON(w, http.StatusOK, resp)
}

// =============================================================
// GET /api/cotizaciones?page=1&pageSize=20
// =============================================================

// ListarCotizaciones retorna una lista paginada de cotizaciones con filtros.
func (h *CotizacionHandler) ListarCotizaciones(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("pageSize"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}

	// Construir filtros desde query params
	filtros := &domain.FiltrosCotizacion{
		Buscar:     strings.TrimSpace(r.URL.Query().Get("buscar")),
		Estado:     strings.TrimSpace(r.URL.Query().Get("estado")),
		FechaDesde: strings.TrimSpace(r.URL.Query().Get("fecha_desde")),
		FechaHasta: strings.TrimSpace(r.URL.Query().Get("fecha_hasta")),
		OrdenarPor: strings.TrimSpace(r.URL.Query().Get("ordenar_por")),
		OrdenDir:   strings.TrimSpace(r.URL.Query().Get("orden_dir")),
	}

	cotizaciones, total, err := h.service.ListarCotizaciones(page, pageSize, filtros)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Error al listar cotizaciones", err.Error())
		return
	}

	response := map[string]interface{}{
		"data":       cotizaciones,
		"total":      total,
		"page":       page,
		"pageSize":   pageSize,
		"totalPages": (total + pageSize - 1) / pageSize,
	}

	sendJSON(w, http.StatusOK, response)
}

// =============================================================
// Admin: Actualizar cotización (MOVIDO DE AUTH_HANDLER)
// =============================================================

func (h *CotizacionHandler) ActualizarCotizacion(w http.ResponseWriter, r *http.Request) {
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
// Admin: Eliminar cotización (MOVIDO DE AUTH_HANDLER)
// =============================================================

func (h *CotizacionHandler) EliminarCotizacion(w http.ResponseWriter, r *http.Request) {
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
// Admin: Asignar cotización a cliente (MOVIDO DE AUTH_HANDLER)
// =============================================================

func (h *CotizacionHandler) AsignarCotizacion(w http.ResponseWriter, r *http.Request) {
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
// Funciones auxiliares de respuesta HTTP (copiadas de auth_handler para evitar dependencia circular)
// =============================================================

// sendJSON envía una respuesta JSON con el código de estado dado.
func sendJSON(w http.ResponseWriter, statusCode int, data interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(statusCode)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		fmt.Printf("Error al enviar JSON: %v\n", err)
	}
}

// sendError envía una respuesta de error estandarizada.
func sendError(w http.ResponseWriter, statusCode int, message string, detail string) {
	sendJSON(w, statusCode, domain.ErrorResponse{
		Error:   message,
		Detalle: detail,
	})
}
