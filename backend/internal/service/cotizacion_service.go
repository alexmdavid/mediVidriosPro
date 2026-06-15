package service

import (
	"fmt"
	"log"
	"math"
	"strings"

	"github.com/mediVidrios/backend/internal/domain"
)

// =============================================================
// Servicio de cotizaciones - Lógica de negocio y cubicación
// =============================================================

// CotizacionService encapsula la lógica de cálculo de cotizaciones.
type CotizacionService struct {
	tipoVidrioRepo domain.TipoVidrioRepository
	clienteRepo    domain.ClienteRepository
	cotizacionRepo domain.CotizacionRepository
	usuarioRepo    domain.UsuarioRepository
}

// NewCotizacionService crea una nueva instancia del servicio.
func NewCotizacionService(
	tvRepo domain.TipoVidrioRepository,
	cliRepo domain.ClienteRepository,
	cotRepo domain.CotizacionRepository,
	usrRepo domain.UsuarioRepository,
) *CotizacionService {
	return &CotizacionService{
		tipoVidrioRepo: tvRepo,
		clienteRepo:    cliRepo,
		cotizacionRepo: cotRepo,
		usuarioRepo:    usrRepo,
	}
}

// ObtenerTiposVidrio retorna todos los tipos de vidrio activos.
func (s *CotizacionService) ObtenerTiposVidrio() ([]domain.TipoVidrio, error) {
	return s.tipoVidrioRepo.ObtenerTodos()
}

// ListarClientes retorna la lista de clientes registrados.
func (s *CotizacionService) ListarClientes(buscar string) ([]domain.Cliente, error) {
	return s.clienteRepo.Listar(buscar)
}

// CrearCliente registra un nuevo cliente (Lazy Creation).
func (s *CotizacionService) CrearCliente(c *domain.Cliente) (int, error) {
	return s.clienteRepo.Crear(c)
}

// =============================================================
// Motor de cubicación y cálculo de costos
// =============================================================

// CalcularAreaTotal calcula el área total en m² de un ítem individual.
// Fórmula: ancho_mt * alto_mt * cantidad
// Valida que ninguna medida sea cero o negativa.
func CalcularAreaTotal(anchoMT, altoMT float64, cantidad int) (float64, error) {
	if anchoMT <= 0 {
		return 0, fmt.Errorf("el ancho debe ser mayor a 0, recibido: %.4f", anchoMT)
	}
	if altoMT <= 0 {
		return 0, fmt.Errorf("el alto debe ser mayor a 0, recibido: %.4f", altoMT)
	}
	if cantidad <= 0 {
		return 0, fmt.Errorf("la cantidad debe ser mayor a 0, recibido: %d", cantidad)
	}

	area := anchoMT * altoMT * float64(cantidad)
	// Redondear a 4 decimales para precisión monetaria
	area = math.Round(area*10000) / 10000
	return area, nil
}

// CalcularPrecioItem calcula el precio de un ítem con margen.
// Fórmula: (Area_Total_M2 * Precio_M2_Vidrio) * (1 + Porcentaje_Margen/100)
func CalcularPrecioItem(areaTotalM2, precioM2 float64, porcentajeMargen float64) float64 {
	if porcentajeMargen < 0 {
		porcentajeMargen = 0
	}
	costoBase := areaTotalM2 * precioM2
	conMargen := costoBase * (1 + porcentajeMargen/100)
	return math.Round(conMargen*100) / 100
}

// ValidarItemInput valida los datos de entrada de un ítem.
func ValidarItemInput(item *domain.ItemCotizacionInput) error {
	if strings.TrimSpace(item.TipoItem) == "" {
		return fmt.Errorf("el tipo de ítem es obligatorio")
	}
	if item.AnchoMT <= 0 {
		return fmt.Errorf("el ancho del ítem '%s' debe ser mayor a 0", item.TipoItem)
	}
	if item.AltoMT <= 0 {
		return fmt.Errorf("el alto del ítem '%s' debe ser mayor a 0", item.TipoItem)
	}
	if item.Cantidad <= 0 {
		return fmt.Errorf("la cantidad del ítem '%s' debe ser mayor a 0", item.TipoItem)
	}
	if item.TipoVidrioID <= 0 {
		return fmt.Errorf("el tipo de vidrio del ítem '%s' es obligatorio", item.TipoItem)
	}
	return nil
}

// =============================================================
// Crear cotización completa
// =============================================================

// CrearCotizacion procesa la creación completa de una cotización.
// 1. Valida el cliente
// 2. Obtiene el precio de cada tipo de vidrio
// 3. Calcula cubicación de cada ítem
// 4. Aplica fórmula de costo con margen
// 5. Persiste todo en la base de datos
// 6. Retorna la cotización con resumen formateado
func (s *CotizacionService) CrearCotizacion(req *domain.CrearCotizacionRequest) (*domain.CotizacionResponse, error) {
	// ---- Validar request ----
	if req.ClienteID <= 0 && strings.TrimSpace(req.ClienteNombre) == "" {
		return nil, fmt.Errorf("se requiere cliente_id o cliente_nombre")
	}
	if strings.TrimSpace(req.DescripcionObra) == "" {
		return nil, fmt.Errorf("la descripción de la obra es obligatoria")
	}
	if len(req.Items) == 0 {
		return nil, fmt.Errorf("debe incluir al menos un ítem de medida")
	}
	if req.PorcentajeMargen < 0 {
		req.PorcentajeMargen = 0
	}

	// ---- Validar o crear cliente ----
	clienteID := req.ClienteID
	if clienteID <= 0 {
		cliente := &domain.Cliente{
			Nombre: strings.TrimSpace(req.ClienteNombre),
		}
		var err error
		clienteID, err = s.clienteRepo.Crear(cliente)
		if err != nil {
			return nil, fmt.Errorf("error al crear cliente: %w", err)
		}
	} else {
		existe, err := s.clienteRepo.ObtenerPorID(clienteID)
		if err != nil || existe == nil {
			return nil, fmt.Errorf("el cliente con ID %d no existe", clienteID)
		}
	}

	// ---- Precargar tipos de vidrio para obtener precios ----
	tiposVidrio, err := s.tipoVidrioRepo.ObtenerTodos()
	if err != nil {
		return nil, fmt.Errorf("error al obtener tipos de vidrio: %w", err)
	}
	// Mapa para acceso rápido por ID
	precioMap := make(map[int]*domain.TipoVidrio)
	for i := range tiposVidrio {
		precioMap[tiposVidrio[i].ID] = &tiposVidrio[i]
	}

	// ---- Procesar cada ítem: cubicación + costos ----
	itemsCalculados := make([]domain.ItemCotizacion, 0, len(req.Items))
	var totalCotizado float64
	var areaTotalGlobal float64
	cantidadTotalItems := 0

	for idx, itemInput := range req.Items {
		// Validar cada ítem
		if err := ValidarItemInput(&itemInput); err != nil {
			return nil, fmt.Errorf("ítem #%d: %w", idx+1, err)
		}

		// Obtener precio del vidrio
		tipoVidrio, ok := precioMap[itemInput.TipoVidrioID]
		if !ok {
			return nil, fmt.Errorf("el tipo de vidrio con ID %d no existe o está inactivo", itemInput.TipoVidrioID)
		}

		// Calcular área total
		areaTotal, err := CalcularAreaTotal(itemInput.AnchoMT, itemInput.AltoMT, itemInput.Cantidad)
		if err != nil {
			return nil, fmt.Errorf("ítem #%d (%s): %w", idx+1, itemInput.TipoItem, err)
		}

		// Calcular precio con margen
		precioCalculado := CalcularPrecioItem(areaTotal, tipoVidrio.PrecioM2, req.PorcentajeMargen)

		item := domain.ItemCotizacion{
			TipoItem:         strings.TrimSpace(itemInput.TipoItem),
			AnchoMT:          itemInput.AnchoMT,
			AltoMT:           itemInput.AltoMT,
			Cantidad:         itemInput.Cantidad,
			TipoVidrioID:     itemInput.TipoVidrioID,
			AreaTotalM2:      areaTotal,
			PrecioUnitarioM2: tipoVidrio.PrecioM2,
			PrecioCalculado:  precioCalculado,
			NotasDiseno:      itemInput.NotasDiseno,
			TipoVidrio:       tipoVidrio,
		}

		itemsCalculados = append(itemsCalculados, item)
		totalCotizado += precioCalculado
		areaTotalGlobal += areaTotal
		cantidadTotalItems += itemInput.Cantidad
	}

	// Redondear total
	totalCotizado = math.Round(totalCotizado*100) / 100

	// ---- Construir encabezado de cotización ----
	cotizacion := &domain.Cotizacion{
		ClienteID:        clienteID,
		DescripcionObra:  strings.TrimSpace(req.DescripcionObra),
		Estado:           "borrador",
		TotalCotizado:    totalCotizado,
		PorcentajeMargen: req.PorcentajeMargen,
	}

	// ---- Persistir en base de datos ----
	cotizacionID, err := s.cotizacionRepo.Crear(cotizacion, itemsCalculados)
	if err != nil {
		return nil, fmt.Errorf("error al guardar cotización: %w", err)
	}
	cotizacion.ID = cotizacionID

	// Asignar IDs generados a los items
	for i := range itemsCalculados {
		itemsCalculados[i].CotizacionID = cotizacionID
	}

	// ---- Construir resumen ----
	// Recalcular subtotal sin margen para el desglose
	var subtotalSinMargen float64
	for _, item := range itemsCalculados {
		subtotalSinMargen += item.AreaTotalM2 * item.PrecioUnitarioM2
	}
	subtotalSinMargen = math.Round(subtotalSinMargen*100) / 100

	resumen := domain.ResumenCotizacion{
		CantidadTotalItems: cantidadTotalItems,
		AreaTotalM2:        math.Round(areaTotalGlobal*10000) / 10000,
		SubtotalCosto:      subtotalSinMargen,
		PorcentajeMargen:   req.PorcentajeMargen,
		TotalConMargen:     totalCotizado,
		TotalFormateado:    formatearMoneda(totalCotizado),
	}

	return &domain.CotizacionResponse{
		Cotizacion: *cotizacion,
		Resumen:    resumen,
	}, nil
}

// =============================================================
// Obtener cotización existente
// =============================================================

// ObtenerCotizacion retorna una cotización completa por ID.
func (s *CotizacionService) ObtenerCotizacion(id int) (*domain.CotizacionResponse, error) {
	log.Printf("🔍 SERVICE: Intentando obtener cotización con ID: %d", id)
	if id <= 0 {
		return nil, fmt.Errorf("ID de cotización inválido: %d", id)
	}

	cotizacion, err := s.cotizacionRepo.ObtenerPorID(id)
	if err != nil {
		log.Printf("❌ SERVICE: Error del repositorio al obtener cotización %d: %v", id, err)
		return nil, fmt.Errorf("error al obtener cotización: %w", err)
	}
	if cotizacion == nil {
		log.Printf("⚠️ SERVICE: Cotización con ID %d no encontrada en el repositorio", id)
		return nil, fmt.Errorf("la cotización con ID %d no existe", id)
	}

	// Recalcular resumen
	var areaTotal float64
	var subtotalSinMargen float64
	cantidadTotalItems := 0
	for _, item := range cotizacion.Items {
		areaTotal += item.AreaTotalM2
		subtotalSinMargen += item.AreaTotalM2 * item.PrecioUnitarioM2
		cantidadTotalItems += item.Cantidad
	}

	resumen := domain.ResumenCotizacion{
		CantidadTotalItems: cantidadTotalItems,
		AreaTotalM2:        math.Round(areaTotal*10000) / 10000,
		SubtotalCosto:      math.Round(subtotalSinMargen*100) / 100,
		PorcentajeMargen:   cotizacion.PorcentajeMargen,
		TotalConMargen:     cotizacion.TotalCotizado,
		TotalFormateado:    formatearMoneda(cotizacion.TotalCotizado),
	}

	return &domain.CotizacionResponse{
		Cotizacion: *cotizacion,
		Resumen:    resumen,
	}, nil
}

// ListarCotizaciones retorna una lista paginada de cotizaciones con filtros.
func (s *CotizacionService) ListarCotizaciones(page, pageSize int, filtros *domain.FiltrosCotizacion) ([]domain.Cotizacion, int, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	return s.cotizacionRepo.Listar(page, pageSize, filtros)
}

// =============================================================
// Gestión de usuarios
// =============================================================

// CrearUsuario inserta un nuevo usuario.
func (s *CotizacionService) CrearUsuario(usuario *domain.Usuario) (int, error) {
	return s.usuarioRepo.Crear(usuario)
}

// ObtenerUsuarioPorID retorna un usuario por ID.
func (s *CotizacionService) ObtenerUsuarioPorID(id int) (*domain.Usuario, error) {
	return s.usuarioRepo.ObtenerPorID(id)
}

// ObtenerUsuarioPorEmail retorna un usuario por email.
func (s *CotizacionService) ObtenerUsuarioPorEmail(email string) (*domain.Usuario, error) {
	return s.usuarioRepo.ObtenerPorEmail(email)
}

// ObtenerUsuarioPorGoogleID retorna un usuario por Google ID.
func (s *CotizacionService) ObtenerUsuarioPorGoogleID(googleID string) (*domain.Usuario, error) {
	return s.usuarioRepo.ObtenerPorGoogleID(googleID)
}

// ListarUsuarios retorna una lista paginada de usuarios.
func (s *CotizacionService) ListarUsuarios(page, pageSize int) ([]domain.Usuario, int, error) {
	return s.usuarioRepo.Listar(page, pageSize)
}

// EliminarUsuario elimina un usuario por ID.
func (s *CotizacionService) EliminarUsuario(id int) error {
	return s.usuarioRepo.Eliminar(id)
}

// =============================================================
// Gestión de cotizaciones (admin + cliente)
// =============================================================

// ActualizarCotizacion actualiza campos de una cotización.
func (s *CotizacionService) ActualizarCotizacion(id int, req *domain.ActualizarCotizacionRequest) error {
	return s.cotizacionRepo.Actualizar(id, req)
}

// EliminarCotizacion elimina una cotización.
func (s *CotizacionService) EliminarCotizacion(id int) error {
	return s.cotizacionRepo.Eliminar(id)
}

// ListarCotizacionesPorCliente retorna cotizaciones asignadas a un cliente.
func (s *CotizacionService) ListarCotizacionesPorCliente(usuarioID, page, pageSize int) ([]domain.Cotizacion, int, error) {
	return s.cotizacionRepo.ListarPorCliente(usuarioID, page, pageSize)
}

// ResponderCotizacion permite al cliente aceptar/rechazar una cotización.
func (s *CotizacionService) ResponderCotizacion(cotizacionID int, aceptada bool, notas string) error {
	return s.cotizacionRepo.ResponderCotizacion(cotizacionID, aceptada, notas)
}

// =============================================================
// Funciones auxiliares
// =============================================================

// formatearMoneda formatea un valor numérico como moneda local.
func formatearMoneda(valor float64) string {
	// Formato: $ 1,234,567.89
	entero := int64(valor)
	decimal := int64(math.Round((valor-float64(entero))*100)) % 100
	if decimal < 0 {
		decimal = -decimal
	}

	// Separar miles
	s := fmt.Sprintf("%d", entero)
	n := len(s)
	if n > 3 {
		var resultado []byte
		for i, c := range s {
			if i > 0 && (n-i)%3 == 0 {
				resultado = append(resultado, ',')
			}
			resultado = append(resultado, byte(c))
		}
		s = string(resultado)
	}

	return fmt.Sprintf("$ %s.%02d", s, decimal)
}
