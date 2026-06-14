package domain

// =============================================================
// Interfaces de repositorio - Contratos para persistencia
// =============================================================

// TipoVidrioRepository define las operaciones de acceso a datos para tipos de vidrio.
type TipoVidrioRepository interface {
	// ObtenerTodos retorna todos los tipos de vidrio activos.
	ObtenerTodos() ([]TipoVidrio, error)
	// ObtenerPorID retorna un tipo de vidrio por su identificador.
	ObtenerPorID(id int) (*TipoVidrio, error)
}

// ClienteRepository define las operaciones de acceso a datos para clientes.
type ClienteRepository interface {
	// Crear inserting un nuevo cliente y retorna su ID generado.
	Crear(cliente *Cliente) (int, error)
	// ObtenerPorID retorna un cliente por su identificador.
	ObtenerPorID(id int) (*Cliente, error)
}

// CotizacionRepository define las operaciones de acceso a datos para cotizaciones.
type CotizacionRepository interface {
	// Crear inserta una cotización con sus items en una transacción.
	Crear(cotizacion *Cotizacion, items []ItemCotizacion) (int, error)
	// ObtenerPorID retorna una cotización completa con items y cliente.
	ObtenerPorID(id int) (*Cotizacion, error)
	// Listar retorna todas las cotizaciones (paginado).
	Listar(page, pageSize int) ([]Cotizacion, int, error)
}
