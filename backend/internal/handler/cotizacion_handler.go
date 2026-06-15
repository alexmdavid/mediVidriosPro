package handler

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

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

	// Clientes
	api.HandleFunc("/clientes", AuthMiddleware(h.ListarClientes)).Methods("GET")
	api.HandleFunc("/clientes", AuthMiddleware(h.CrearCliente)).Methods("POST")
	api.HandleFunc("/clientes/{id:[0-9]+}", AuthMiddleware(AdminMiddleware(h.ObtenerCliente))).Methods("GET")
	api.HandleFunc("/clientes/{id:[0-9]+}", AuthMiddleware(AdminMiddleware(h.ActualizarClienteHandler))).Methods("PUT")
	api.HandleFunc("/clientes/{id:[0-9]+}", AuthMiddleware(AdminMiddleware(h.EliminarClienteHandler))).Methods("DELETE")

	// Cotizaciones
	api.HandleFunc("/cotizaciones", AuthMiddleware(h.CrearCotizacion)).Methods("POST")
	api.HandleFunc("/cotizaciones", AuthMiddleware(h.ListarCotizaciones)).Methods("GET")
	api.HandleFunc("/cotizaciones/{id:[0-9]+}", AuthMiddleware(h.ObtenerCotizacion)).Methods("GET")
	// Rutas de administración de cotizaciones (movidas de auth_handler)
	api.HandleFunc("/cotizaciones/{id:[0-9]+}", AuthMiddleware(AdminMiddleware(h.ActualizarCotizacion))).Methods("PUT")
	api.HandleFunc("/cotizaciones/{id:[0-9]+}", AuthMiddleware(AdminMiddleware(h.EliminarCotizacion))).Methods("DELETE")
	api.HandleFunc("/cotizaciones/{id:[0-9]+}/asignar", AuthMiddleware(AdminMiddleware(h.AsignarCotizacion))).Methods("PUT")

	// Estado
	api.HandleFunc("/cotizaciones/{id:[0-9]+}/estado", AuthMiddleware(AdminMiddleware(h.CambiarEstadoHandler))).Methods("PUT")
	// Exportación
	api.HandleFunc("/cotizaciones/{id:[0-9]+}/export", AuthMiddleware(h.ExportarCotizacion)).Methods("GET")

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

// ListarClientes retorna los clientes para el selector.
func (h *CotizacionHandler) ListarClientes(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	page, _ := strconv.Atoi(query.Get("page"))
	limit, _ := strconv.Atoi(query.Get("limit"))
	buscar := strings.TrimSpace(query.Get("search"))

	if limit == 0 {
		limit = 30
	}

	clientes, total, err := h.service.ListarClientes(page, limit, buscar)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Error al listar clientes", err.Error())
		return
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"data":        clientes,
		"total":       total,
		"page":        page,
		"limit":       limit,
		"total_pages": (total + limit - 1) / limit,
	})
}

// CrearCliente permite el registro rápido de clientes.
func (h *CotizacionHandler) CrearCliente(w http.ResponseWriter, r *http.Request) {
	var c domain.Cliente
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		sendError(w, http.StatusBadRequest, "JSON inválido", "")
		return
	}
	id, err := h.service.CrearCliente(&c)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Error al crear cliente", err.Error())
		return
	}
	c.ID = id
	sendJSON(w, http.StatusCreated, c)
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
// Admin: Cambiar estado de cotización
// =============================================================

func (h *CotizacionHandler) CambiarEstadoHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		sendError(w, http.StatusBadRequest, "ID inválido", "")
		return
	}

	var req domain.CambiarEstadoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "JSON inválido", err.Error())
		return
	}

	// Validar estado permitido
	estadosValidos := map[string]bool{"Borrador": true, "Enviada": true, "Aprobada": true, "Rechazada": true, "Facturada": true}
	if !estadosValidos[req.Estado] {
		sendError(w, http.StatusBadRequest, "Estado inválido. Estados permitidos: Borrador, Enviada, Aprobada, Rechazada, Facturada", "")
		return
	}

	updateReq := &domain.ActualizarCotizacionRequest{Estado: req.Estado}
	if err := h.service.ActualizarCotizacion(id, updateReq); err != nil {
		sendError(w, http.StatusInternalServerError, "Error al cambiar estado", err.Error())
		return
	}

	log.Printf("🔄 Estado de cotización %d actualizado a %s", id, req.Estado)

	// Si el estado es "enviada", enviar notificación por correo
	if strings.ToLower(req.Estado) == "enviada" {
		if sendErr := h.service.NotificarCotizacionEnviada(id); sendErr != nil {
			log.Printf("⚠️ HANDLER: Error al notificar cotización #%d: %v", id, sendErr)
		}
	}

	sendJSON(w, http.StatusOK, map[string]string{"message": "Estado actualizado correctamente"})
}

// =============================================================
// CRUD de Clientes
// =============================================================

func (h *CotizacionHandler) ObtenerCliente(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		sendError(w, http.StatusBadRequest, "ID inválido", "")
		return
	}
	cliente, err := h.service.ObtenerCliente(id)
	if err != nil || cliente == nil {
		sendError(w, http.StatusNotFound, "Cliente no encontrado", "")
		return
	}
	sendJSON(w, http.StatusOK, cliente)
}

func (h *CotizacionHandler) ActualizarClienteHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		sendError(w, http.StatusBadRequest, "ID inválido", "")
		return
	}
	var c domain.Cliente
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		sendError(w, http.StatusBadRequest, "JSON inválido", "")
		return
	}
	if err := h.service.ActualizarCliente(id, &c); err != nil {
		sendError(w, http.StatusInternalServerError, "Error al actualizar cliente", err.Error())
		return
	}
	c.ID = id
	sendJSON(w, http.StatusOK, c)
}

func (h *CotizacionHandler) EliminarClienteHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		sendError(w, http.StatusBadRequest, "ID inválido", "")
		return
	}
	if err := h.service.EliminarCliente(id); err != nil {
		sendError(w, http.StatusInternalServerError, "Error al eliminar cliente", err.Error())
		return
	}
	sendJSON(w, http.StatusOK, map[string]string{"mensaje": "Cliente eliminado"})
}

// =============================================================
// Exportación de cotizaciones: PDF, CSV, DOCX
// =============================================================

func (h *CotizacionHandler) ExportarCotizacion(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		sendError(w, http.StatusBadRequest, "ID inválido", "")
		return
	}

	format := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("format")))
	if format == "" {
		format = "pdf"
	}

	resp, err := h.service.ObtenerCotizacion(id)
	if err != nil || resp == nil {
		sendError(w, http.StatusNotFound, "Cotización no encontrada", "")
		return
	}

	switch format {
	case "csv":
		exportarCSV(w, resp)
	case "docx":
		exportarDOCX(w, resp)
	default:
		exportarPDF(w, resp)
	}
}

// =============================================================
// Exportar CSV
// =============================================================

func exportarCSV(w http.ResponseWriter, resp *domain.CotizacionResponse) {
	cot := resp.Cotizacion
	filename := fmt.Sprintf("Cotizacion_%d.csv", cot.ID)
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))

	// BOM para Excel UTF-8
	w.Write([]byte("\ufeff"))

	// Escribir encabezado
	csv := fmt.Sprintf("Cotización #%d\n", cot.ID)
	csv += fmt.Sprintf("Cliente,%s\n", cot.Cliente.Nombre)
	csv += fmt.Sprintf("Fecha,%s\n", cot.FechaCreacion.Format("2006-01-02"))
	csv += fmt.Sprintf("Descripción,%s\n", cot.DescripcionObra)
	csv += fmt.Sprintf("Estado,%s\n", cot.Estado)
	csv += "\nITEMS,DETALLE,AREA EN M²,VALOR TOTAL\n"

	for i, item := range cot.Items {
		detalle := fmt.Sprintf("%s %dx%d", item.TipoItem, int(item.AnchoMT*100), int(item.AltoMT*100))
		csv += fmt.Sprintf("%d,%s,%.4f,%.2f\n", i+1, detalle, item.AreaTotalM2, item.PrecioCalculado)
	}

	csv += fmt.Sprintf("\nTotal,%.4f,%.2f\n", resp.Resumen.AreaTotalM2, cot.TotalCotizado)
	w.Write([]byte(csv))
}

// =============================================================
// Exportar DOCX (Word HTML format)
// =============================================================

func exportarDOCX(w http.ResponseWriter, resp *domain.CotizacionResponse) {
	cot := resp.Cotizacion
	filename := fmt.Sprintf("Cotizacion_%d.doc", cot.ID)
	w.Header().Set("Content-Type", "application/msword")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))

	fecha := time.Now().Format("02 de enero de 2006")
	var itemsHTML string
	for i, item := range cot.Items {
		itemsHTML += fmt.Sprintf(`
			<tr>
				<td style="border: 1px solid black; padding: 6px; text-align: center;">%d</td>
				<td style="border: 1px solid black; padding: 6px;">%s - MEDIDAS: %v X %v MT</td>
				<td style="border: 1px solid black; padding: 6px; text-align: center;">%.4f</td>
				<td style="border: 1px solid black; padding: 6px; text-align: right;">$ %s</td>
			</tr>`,
			i+1,
			strings.ToUpper(item.TipoItem),
			item.AnchoMT,
			item.AltoMT,
			item.AreaTotalM2,
			fmt.Sprintf("%.2f", item.PrecioCalculado))
	}

	html := fmt.Sprintf(`<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
<head><meta charset="utf-8"><style>
body{font-family:'Arial',sans-serif; margin: 20mm;}
.header{font-size: 10pt; text-align: left; line-height: 1.2;}
.destinatario{font-size: 11pt; margin-top: 20pt; line-height: 1.3;}
.titulo{font-size: 14pt; font-weight: bold; text-align: center; margin: 25pt 0;}
table{width: 100%%; border-collapse: collapse; font-size: 10pt;}
th{border: 1px solid black; background-color: #f2f2f2; padding: 8px; font-weight: bold;}
.footer{font-size: 10pt; margin-top: 30pt;}
</style></head>
<body>
	<div class="header">
		<strong>RUBIEL ANTONIO RUIDIAZ COMAS</strong><br>
		RUT: 85165741<br>
		Correo: rubanruic@gmail.com - Celular: 3103233594<br>
		CALLE 20 #28-21 DUITAMA
	</div>

	<div class="destinatario">
		Duitama, %s<br><br>
		Señor(a):<br>
		<strong>%s</strong><br>
		Ciudad
	</div>

	<div class="titulo">COTIZACION</div>

	<table>
		<thead>
			<tr>
				<th>ITEMS</th>
				<th>DETALLE</th>
				<th>ÁREA EN M²</th>
				<th>VALOR TOTAL</th>
			</tr>
		</thead>
		<tbody>%s</tbody>
		<tfoot>
			<tr>
				<td colspan="3" style="border: 1px solid black; padding: 6px; text-align: right; font-weight: bold;">TOTAL</td>
				<td style="border: 1px solid black; padding: 6px; text-align: right; font-weight: bold;">$ %s</td>
			</tr>
		</tfoot>
	</table>

	<div class="footer">
		<strong>CONDICIONES ECONÓMICAS:</strong> 60%% de anticipo al aceptar esta cotizaci&oacute;n y 40%% contra entrega.<br>
		<strong>NO INCLUYE:</strong> obras de albañiler&iacute;a.<br>
		<strong>TIEMPO DE ENTREGA:</strong> A acordar con el cliente.<br>
		<strong>VALIDEZ OFERTA:</strong> 10 d&iacute;as calendario.<br><br><br>
		Cordialmente,<br><br><br>
		___________________________<br>
		<strong>RUBIEL ANTONIO RUIDIAZ COMAS</strong><br>
		CC. 85165741
	</div>
</body></html>`,
		fecha,
		strings.ToUpper(cot.Cliente.Nombre),
		itemsHTML,
		fmt.Sprintf("%.2f", cot.TotalCotizado))

	w.Write([]byte("\ufeff" + html))
}

// =============================================================
// Exportar PDF (server-side usando HTML to PDF conversion)
// =============================================================

func exportarPDF(w http.ResponseWriter, resp *domain.CotizacionResponse) {
	// Server-side PDF generation - note that the primary PDF generation
	// happens client-side via jspdf. This endpoint returns the data as JSON
	// so the frontend can generate the PDF with the exact format.
	sendJSON(w, http.StatusOK, resp)
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
