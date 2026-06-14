package domain

import (
	"time"
)

// =============================================================
// Modelos de dominio - Entidades del sistema mediVidrios
// =============================================================

// TipoVidrio representa un tipo de vidrio disponible en catálogo.
type TipoVidrio struct {
	ID        int       `json:"id"`
	Nombre    string    `json:"nombre"`
	EspesorMM float64   `json:"espesor_mm"`
	PrecioM2  float64   `json:"precio_m2"`
	Activo    bool      `json:"activo"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Cliente representa un cliente del negocio.
type Cliente struct {
	ID        int       `json:"id"`
	Nombre    string    `json:"nombre"`
	Telefono  *string   `json:"telefono,omitempty"`
	Email     *string   `json:"email,omitempty"`
	Direccion *string   `json:"direccion,omitempty"`
	Notas     *string   `json:"notas,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Cotizacion representa el encabezado de una cotización.
type Cotizacion struct {
	ID                 int       `json:"id"`
	ClienteID          int       `json:"cliente_id"`
	DescripcionObra    string    `json:"descripcion_obra"`
	Estado             string    `json:"estado"`
	TotalCotizado      float64   `json:"total_cotizado"`
	PorcentajeMargen   float64   `json:"porcentaje_margen"`
	FechaCreacion      time.Time `json:"fecha_creacion"`
	FechaActualizacion time.Time `json:"fecha_actualizacion"`
	// Campos de navegación (no se persisten directamente)
	Cliente *Cliente         `json:"cliente,omitempty"`
	Items   []ItemCotizacion `json:"items,omitempty"`
}

// ItemCotizacion representa una línea de medida individual (ventana, espejo, etc.).
type ItemCotizacion struct {
	ID               int       `json:"id"`
	CotizacionID     int       `json:"cotizacion_id"`
	TipoItem         string    `json:"tipo_item"`
	AnchoMT          float64   `json:"ancho_mt"`
	AltoMT           float64   `json:"alto_mt"`
	Cantidad         int       `json:"cantidad"`
	TipoVidrioID     int       `json:"tipo_vidrio_id"`
	AreaTotalM2      float64   `json:"area_total_m2"`
	PrecioUnitarioM2 float64   `json:"precio_unitario_m2"`
	PrecioCalculado  float64   `json:"precio_calculado"`
	NotasDiseno      *string   `json:"notas_diseno,omitempty"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
	// Campo de navegación (se llena al consultar)
	TipoVidrio *TipoVidrio `json:"tipo_vidrio,omitempty"`
}

// =============================================================
// DTOs (Data Transfer Objects) para requests y responses
// =============================================================

// CrearCotizacionRequest es el payload para crear una cotización completa.
type CrearCotizacionRequest struct {
	ClienteID        int                   `json:"cliente_id"`
	ClienteNombre    string                `json:"cliente_nombre,omitempty"` // Se usa si no existe el cliente
	DescripcionObra  string                `json:"descripcion_obra"`
	PorcentajeMargen float64               `json:"porcentaje_margen"`
	Items            []ItemCotizacionInput `json:"items"`
}

// ItemCotizacionInput representa una fila del formulario de medidas.
type ItemCotizacionInput struct {
	TipoItem     string  `json:"tipo_item"`
	AnchoMT      float64 `json:"ancho_mt"`
	AltoMT       float64 `json:"alto_mt"`
	Cantidad     int     `json:"cantidad"`
	TipoVidrioID int     `json:"tipo_vidrio_id"`
	NotasDiseno  *string `json:"notas_diseno,omitempty"`
}

// CotizacionResponse es la respuesta completa de una cotización calculada.
type CotizacionResponse struct {
	Cotizacion Cotizacion        `json:"cotizacion"`
	Resumen    ResumenCotizacion `json:"resumen"`
}

// ResumenCotizacion contiene el desglose total para facturar.
type ResumenCotizacion struct {
	CantidadTotalItems int     `json:"cantidad_total_items"`
	AreaTotalM2        float64 `json:"area_total_m2"`
	SubtotalCosto      float64 `json:"subtotal_costo"`
	PorcentajeMargen   float64 `json:"porcentaje_margen"`
	TotalConMargen     float64 `json:"total_con_margen"`
	TotalFormateado    string  `json:"total_formateado"` // "$ 1,234,567.89"
}

// CalcularItemResult resultado del cálculo de un solo ítem.
type CalcularItemResult struct {
	Item        ItemCotizacion `json:"item"`
	CostoVidrio float64        `json:"costo_vidrio"`
	ConMargen   float64        `json:"con_margen"`
}

// ErrorResponse estandariza los errores de la API.
type ErrorResponse struct {
	Error   string `json:"error"`
	Detalle string `json:"detalle,omitempty"`
}
