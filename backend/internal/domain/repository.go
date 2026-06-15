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
	// Listar retorna cotizaciones filtradas y paginadas.
	Listar(page, pageSize int, filtros *FiltrosCotizacion) ([]Cotizacion, int, error)
	// Actualizar actualiza campos de una cotización existente.
	Actualizar(id int, req *ActualizarCotizacionRequest) error
	// Eliminar elimina una cotización y sus items.
	Eliminar(id int) error
	// ListarPorCliente retorna cotizaciones asignadas a un usuario cliente.
	ListarPorCliente(usuarioID int, page, pageSize int) ([]Cotizacion, int, error)
	// ResponderCotizacion permite al cliente aceptar o rechazar una cotización.
	ResponderCotizacion(cotizacionID int, aceptada bool, notas string) error
}

// UsuarioRepository define las operaciones de acceso a datos para usuarios.
type UsuarioRepository interface {
	// Crear inserta un nuevo usuario y retorna su ID.
	Crear(usuario *Usuario) (int, error)
	// ObtenerPorID retorna un usuario por su ID.
	ObtenerPorID(id int) (*Usuario, error)
	// ObtenerPorEmail retorna un usuario por su email.
	ObtenerPorEmail(email string) (*Usuario, error)
	// ObtenerPorGoogleID retorna un usuario por su Google ID.
	ObtenerPorGoogleID(googleID string) (*Usuario, error)
	// Listar retorna todos los usuarios.
	Listar(page, pageSize int) ([]Usuario, int, error)
	// Eliminar elimina un usuario.
	Eliminar(id int) error
}
