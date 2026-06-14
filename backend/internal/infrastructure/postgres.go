package infrastructure

import (
	"context"
	"database/sql"
	"fmt"
	"net"
	"regexp"
	"strings"
	"time"

	_ "github.com/lib/pq"

	"github.com/mediVidrios/backend/internal/domain"
)

// =============================================================
// Implementación PostgreSQL de los repositorios
// =============================================================

// PostgresDB agrupa las conexiones y repositorios de PostgreSQL.
type PostgresDB struct {
	DB             *sql.DB
	TipoVidrioRepo *TipoVidrioRepository
	ClienteRepo    *ClienteRepository
	CotizacionRepo *CotizacionRepository
}

// NewPostgresDB crea la conexión y los repositorios.
func NewPostgresDB(databaseURL string) (*PostgresDB, error) {
	// Resolver hostname a IPv6 si es necesario (Windows DNS issue)
	databaseURL = resolverIPv6SiNecesario(databaseURL)

	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		return nil, fmt.Errorf("error al abrir conexión a PostgreSQL: %w", err)
	}

	// Configurar pool de conexiones
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("error al conectar con PostgreSQL: %w", err)
	}

	return &PostgresDB{
		DB:             db,
		TipoVidrioRepo: &TipoVidrioRepository{db: db},
		ClienteRepo:    &ClienteRepository{db: db},
		CotizacionRepo: &CotizacionRepository{db: db},
	}, nil
}

// hostRegex extrae el hostname de una URL de conexión PostgreSQL.
var hostRegex = regexp.MustCompile(`@([^/:]+)`)

// resolverIPv6SiNecesario intenta resolver el hostname a IPv6 si no hay A record.
// Esto soluciona el problema de DNS en Windows cuando solo hay registros AAAA.
func resolverIPv6SiNecesario(dbURL string) string {
	// Extraer hostname de la URL
	matches := hostRegex.FindStringSubmatch(dbURL)
	if len(matches) < 2 {
		return dbURL
	}
	hostname := matches[1]

	// Si ya es un bracket IPv6, no hacer nada
	if strings.HasPrefix(hostname, "[") {
		return dbURL
	}

	// Intentar resolver con el resolver del sistema
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	r := &net.Resolver{}
	addrs, err := r.LookupHost(ctx, hostname)
	if err != nil || len(addrs) == 0 {
		// Si falla, intentar con DNS de Google directamente
		customResolver := &net.Resolver{
			PreferGo: true,
			Dial: func(ctx context.Context, network, address string) (net.Conn, error) {
				d := net.Dialer{Timeout: 3 * time.Second}
				return d.DialContext(ctx, "udp", "8.8.8.8:53")
			},
		}
		addrs, err = customResolver.LookupHost(ctx, hostname)
		if err != nil || len(addrs) == 0 {
			return dbURL // No resolver, dejar que falle después
		}
	}

	// Buscar una dirección IPv6
	for _, addr := range addrs {
		if strings.Contains(addr, ":") {
			// Es IPv6, reemplazar hostname con dirección entre brackets
			// Nota: en la URL el hostname viene como @host:port, no @host@
			newURL := strings.Replace(dbURL, "@"+hostname, "@"+"["+addr+"]", 1)
			fmt.Printf("📡 IPv6 resuelto: %s -> [%s]\n", hostname, addr)
			return newURL
		}
	}

	// Buscar IPv4
	for _, addr := range addrs {
		if !strings.Contains(addr, ":") {
			// IPv4 found, no need to change
			return dbURL
		}
	}

	return dbURL
}

// Close cierra la conexión a la base de datos.
func (p *PostgresDB) Close() error {
	return p.DB.Close()
}

// =============================================================
// TipoVidrioRepository - Implementación PostgreSQL
// =============================================================

// TipoVidrioRepository implementa domain.TipoVidrioRepository para PostgreSQL.
type TipoVidrioRepository struct {
	db *sql.DB
}

// ObtenerTodos retorna todos los tipos de vidrio activos.
func (r *TipoVidrioRepository) ObtenerTodos() ([]domain.TipoVidrio, error) {
	query := `
		SELECT id, nombre, espesor_mm, precio_m2, activo, created_at, updated_at
		FROM tipos_vidrio
		WHERE activo = TRUE
		ORDER BY nombre ASC
	`

	rows, err := r.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("error al consultar tipos de vidrio: %w", err)
	}
	defer rows.Close()

	var tipos []domain.TipoVidrio
	for rows.Next() {
		var tv domain.TipoVidrio
		if err := rows.Scan(
			&tv.ID, &tv.Nombre, &tv.EspesorMM, &tv.PrecioM2,
			&tv.Activo, &tv.CreatedAt, &tv.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("error al escanear tipo de vidrio: %w", err)
		}
		tipos = append(tipos, tv)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error al iterar tipos de vidrio: %w", err)
	}

	return tipos, nil
}

// ObtenerPorID retorna un tipo de vidrio por su ID.
func (r *TipoVidrioRepository) ObtenerPorID(id int) (*domain.TipoVidrio, error) {
	query := `
		SELECT id, nombre, espesor_mm, precio_m2, activo, created_at, updated_at
		FROM tipos_vidrio
		WHERE id = $1 AND activo = TRUE
	`

	var tv domain.TipoVidrio
	err := r.db.QueryRow(query, id).Scan(
		&tv.ID, &tv.Nombre, &tv.EspesorMM, &tv.PrecioM2,
		&tv.Activo, &tv.CreatedAt, &tv.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("error al obtener tipo de vidrio %d: %w", id, err)
	}

	return &tv, nil
}

// =============================================================
// ClienteRepository - Implementación PostgreSQL
// =============================================================

// ClienteRepository implementa domain.ClienteRepository para PostgreSQL.
type ClienteRepository struct {
	db *sql.DB
}

// Crear inserta un nuevo cliente y retorna su ID.
func (r *ClienteRepository) Crear(cliente *domain.Cliente) (int, error) {
	query := `
		INSERT INTO clientes (nombre, telefono, email, direccion, notas)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`

	var id int
	err := r.db.QueryRow(query,
		cliente.Nombre,
		cliente.Telefono,
		cliente.Email,
		cliente.Direccion,
		cliente.Notas,
	).Scan(&id)

	if err != nil {
		return 0, fmt.Errorf("error al crear cliente: %w", err)
	}

	return id, nil
}

// ObtenerPorID retorna un cliente por su ID.
func (r *ClienteRepository) ObtenerPorID(id int) (*domain.Cliente, error) {
	query := `
		SELECT id, nombre, telefono, email, direccion, notas, created_at, updated_at
		FROM clientes
		WHERE id = $1
	`

	var c domain.Cliente
	err := r.db.QueryRow(query, id).Scan(
		&c.ID, &c.Nombre, &c.Telefono, &c.Email,
		&c.Direccion, &c.Notas, &c.CreatedAt, &c.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("error al obtener cliente %d: %w", id, err)
	}

	return &c, nil
}

// =============================================================
// CotizacionRepository - Implementación PostgreSQL
// =============================================================

// CotizacionRepository implementa domain.CotizacionRepository para PostgreSQL.
type CotizacionRepository struct {
	db *sql.DB
}

// Crear inserta una cotización y sus items dentro de una transacción.
func (r *CotizacionRepository) Crear(cotizacion *domain.Cotizacion, items []domain.ItemCotizacion) (int, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return 0, fmt.Errorf("error al iniciar transacción: %w", err)
	}
	defer tx.Rollback()

	// Insertar encabezado de cotización
	queryCot := `
		INSERT INTO cotizaciones (cliente_id, descripcion_obra, estado, total_cotizado, porcentaje_margen)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`

	var cotizacionID int
	err = tx.QueryRow(queryCot,
		cotizacion.ClienteID,
		cotizacion.DescripcionObra,
		cotizacion.Estado,
		cotizacion.TotalCotizado,
		cotizacion.PorcentajeMargen,
	).Scan(&cotizacionID)

	if err != nil {
		return 0, fmt.Errorf("error al insertar cotización: %w", err)
	}

	// Insertar items usando COPY para mayor rendimiento
	if len(items) > 0 {
		queryItems := `
			INSERT INTO items_cotizacion 
				(cotizacion_id, tipo_item, ancho_mt, alto_mt, cantidad, 
				 tipo_vidrio_id, area_total_m2, precio_unitario_m2, precio_calculado, notas_diseno)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		`

		for _, item := range items {
			_, err = tx.Exec(queryItems,
				cotizacionID,
				item.TipoItem,
				item.AnchoMT,
				item.AltoMT,
				item.Cantidad,
				item.TipoVidrioID,
				item.AreaTotalM2,
				item.PrecioUnitarioM2,
				item.PrecioCalculado,
				item.NotasDiseno,
			)
			if err != nil {
				return 0, fmt.Errorf("error al insertar item '%s': %w", item.TipoItem, err)
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return 0, fmt.Errorf("error al confirmar transacción: %w", err)
	}

	return cotizacionID, nil
}

// ObtenerPorID retorna una cotización completa con items y datos del cliente.
func (r *CotizacionRepository) ObtenerPorID(id int) (*domain.Cotizacion, error) {
	// Consultar encabezado con datos del cliente
	queryCot := `
		SELECT c.id, c.cliente_id, c.descripcion_obra, c.estado, c.total_cotizado,
		       c.porcentaje_margen, c.fecha_creacion, c.fecha_actualizacion,
		       cl.nombre, cl.telefono, cl.email, cl.direccion, cl.notas
		FROM cotizaciones c
		JOIN clientes cl ON cl.id = c.cliente_id
		WHERE c.id = $1
	`

	var cot domain.Cotizacion
	cot.Cliente = &domain.Cliente{}

	err := r.db.QueryRow(queryCot, id).Scan(
		&cot.ID, &cot.ClienteID, &cot.DescripcionObra, &cot.Estado,
		&cot.TotalCotizado, &cot.PorcentajeMargen,
		&cot.FechaCreacion, &cot.FechaActualizacion,
		&cot.Cliente.ID, &cot.Cliente.Nombre, &cot.Cliente.Telefono,
		&cot.Cliente.Email, &cot.Cliente.Direccion, &cot.Cliente.Notas,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("error al obtener cotización %d: %w", id, err)
	}

	// Consultar items con tipo de vidrio
	queryItems := `
		SELECT i.id, i.cotizacion_id, i.tipo_item, i.ancho_mt, i.alto_mt,
		       i.cantidad, i.tipo_vidrio_id, i.area_total_m2, i.precio_unitario_m2,
		       i.precio_calculado, i.notas_diseno, i.created_at, i.updated_at,
		       tv.id, tv.nombre, tv.espesor_mm, tv.precio_m2
		FROM items_cotizacion i
		JOIN tipos_vidrio tv ON tv.id = i.tipo_vidrio_id
		WHERE i.cotizacion_id = $1
		ORDER BY i.id ASC
	`

	rows, err := r.db.Query(queryItems, id)
	if err != nil {
		return nil, fmt.Errorf("error al consultar items de cotización %d: %w", id, err)
	}
	defer rows.Close()

	for rows.Next() {
		var item domain.ItemCotizacion
		item.TipoVidrio = &domain.TipoVidrio{}
		if err := rows.Scan(
			&item.ID, &item.CotizacionID, &item.TipoItem,
			&item.AnchoMT, &item.AltoMT, &item.Cantidad,
			&item.TipoVidrioID, &item.AreaTotalM2,
			&item.PrecioUnitarioM2, &item.PrecioCalculado,
			&item.NotasDiseno, &item.CreatedAt, &item.UpdatedAt,
			&item.TipoVidrio.ID, &item.TipoVidrio.Nombre,
			&item.TipoVidrio.EspesorMM, &item.TipoVidrio.PrecioM2,
		); err != nil {
			return nil, fmt.Errorf("error al escanear item: %w", err)
		}
		cot.Items = append(cot.Items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error al iterar items: %w", err)
	}

	return &cot, nil
}

// Listar retorna cotizaciones paginadas con datos del cliente.
func (r *CotizacionRepository) Listar(page, pageSize int) ([]domain.Cotizacion, int, error) {
	// Contar total
	var total int
	err := r.db.QueryRow("SELECT COUNT(*) FROM cotizaciones").Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("error al contar cotizaciones: %w", err)
	}

	offset := (page - 1) * pageSize
	query := `
		SELECT c.id, c.cliente_id, c.descripcion_obra, c.estado, c.total_cotizado,
		       c.porcentaje_margen, c.fecha_creacion, c.fecha_actualizacion,
		       cl.nombre
		FROM cotizaciones c
		JOIN clientes cl ON cl.id = c.cliente_id
		ORDER BY c.fecha_creacion DESC
		LIMIT $1 OFFSET $2
	`

	rows, err := r.db.Query(query, pageSize, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("error al listar cotizaciones: %w", err)
	}
	defer rows.Close()

	var cotizaciones []domain.Cotizacion
	for rows.Next() {
		var cot domain.Cotizacion
		var nombreCliente string
		if err := rows.Scan(
			&cot.ID, &cot.ClienteID, &cot.DescripcionObra, &cot.Estado,
			&cot.TotalCotizado, &cot.PorcentajeMargen,
			&cot.FechaCreacion, &cot.FechaActualizacion,
			&nombreCliente,
		); err != nil {
			return nil, 0, fmt.Errorf("error al escanear cotización: %w", err)
		}
		cot.Cliente = &domain.Cliente{ID: cot.ClienteID, Nombre: nombreCliente}
		cotizaciones = append(cotizaciones, cot)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("error al iterar cotizaciones: %w", err)
	}

	return cotizaciones, total, nil
}

// =============================================================
// Utilidad para construir IN clause dinámica
// =============================================================

// BuildPlaceholders genera placeholders $1, $2, ... para queries dinámicas.
func BuildPlaceholders(n int) string {
	if n <= 0 {
		return ""
	}
	ph := make([]string, n)
	for i := range ph {
		ph[i] = fmt.Sprintf("$%d", i+1)
	}
	return strings.Join(ph, ", ")
}
