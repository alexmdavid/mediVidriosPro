-- =============================================================
-- mediVidrios - Migración inicial: Modelo de datos PostgreSQL
-- =============================================================

BEGIN;

-- Tabla: tipos_vidrio
-- Catálogo de tipos de vidrio disponibles con su espesor y precio base por m²
CREATE TABLE IF NOT EXISTS tipos_vidrio (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(100) NOT NULL UNIQUE,
    espesor_mm  DECIMAL(5,2) NOT NULL CHECK (espesor_mm > 0),
    precio_m2   DECIMAL(12,2) NOT NULL CHECK (precio_m2 >= 0),
    activo      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE tipos_vidrio IS 'Catálogo de tipos de vidrio con espesor y precio por metro cuadrado';
COMMENT ON COLUMN tipos_vidrio.espesor_mm IS 'Espesor del vidrio en milímetros';
COMMENT ON COLUMN tipos_vidrio.precio_m2 IS 'Costo base del proveedor por metro cuadrado en moneda local';

-- Tabla: clientes
-- Información básica del cliente para asociar cotizaciones
CREATE TABLE IF NOT EXISTS clientes (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(200) NOT NULL,
    telefono    VARCHAR(30),
    email       VARCHAR(200),
    direccion   TEXT,
    notas       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE clientes IS 'Clientes del negocio de vidrios';

-- Tabla: cotizaciones
-- Encabezado de cada cotización con estado y totales
CREATE TABLE IF NOT EXISTS cotizaciones (
    id                 SERIAL PRIMARY KEY,
    cliente_id         INTEGER NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    descripcion_obra   TEXT NOT NULL,
    estado             VARCHAR(30) NOT NULL DEFAULT 'borrador'
                       CHECK (estado IN ('borrador', 'enviada', 'aprobada', 'rechazada', 'facturada')),
    total_cotizado     DECIMAL(14,2) NOT NULL DEFAULT 0.00 CHECK (total_cotizado >= 0),
    porcentaje_margen  DECIMAL(5,2) NOT NULL DEFAULT 30.00 CHECK (porcentaje_margen >= 0),
    fecha_creacion     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE cotizaciones IS 'Encabezado de cotizaciones para proyectos de vidrios';
COMMENT ON COLUMN cotizaciones.estado IS 'Estado del flujo: borrador → enviada → aprobada/rechazada → facturada';
COMMENT ON COLUMN cotizaciones.total_cotizado IS 'Suma total de precio_calculado de todos los items_cotizacion';
COMMENT ON COLUMN cotizaciones.porcentaje_margen IS 'Porcentaje de margen/ganancia aplicado a toda la cotización (ej. 30 = 30%)';

-- Tabla: items_cotizacion
-- Líneas de medida: cada ítem es una ventana, espejo, división, etc.
CREATE TABLE IF NOT EXISTS items_cotizacion (
    id                  SERIAL PRIMARY KEY,
    cotizacion_id       INTEGER NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
    tipo_item           VARCHAR(80) NOT NULL CHECK (LENGTH(tipo_item) > 0),
    ancho_mt            DECIMAL(8,4) NOT NULL CHECK (ancho_mt > 0),
    alto_mt             DECIMAL(8,4) NOT NULL CHECK (alto_mt > 0),
    cantidad            INTEGER NOT NULL CHECK (cantidad > 0),
    tipo_vidrio_id      INTEGER NOT NULL REFERENCES tipos_vidrio(id) ON DELETE RESTRICT,
    area_total_m2       DECIMAL(12,4) NOT NULL CHECK (area_total_m2 > 0),
    precio_unitario_m2  DECIMAL(12,2) NOT NULL CHECK (precio_unitario_m2 >= 0),
    precio_calculado    DECIMAL(14,2) NOT NULL CHECK (precio_calculado >= 0),
    notas_diseno        TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE items_cotizacion IS 'Detalle de medidas y vidrios de cada cotización (reemplaza las libretas manuales)';
COMMENT ON COLUMN items_cotizacion.tipo_item IS 'Categoría: Ventana, Espejo, División Baño, Puerta, Mampara, etc.';
COMMENT ON COLUMN items_cotizacion.ancho_mt IS 'Ancho del vidrio en metros';
COMMENT ON COLUMN items_cotizacion.alto_mt IS 'Alto del vidrio en metros';
COMMENT ON COLUMN items_cotizacion.area_total_m2 IS 'Calculado: ancho_mt * alto_mt * cantidad';
COMMENT ON COLUMN items_cotizacion.precio_calculado IS 'Calculado: area_total_m2 * precio_unitario_m2 * (1 + margen/100)';
COMMENT ON COLUMN items_cotizacion.notas_diseno IS 'Notas de diseño que reemplazan los dibujos de la libreta';

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_cotizaciones_cliente ON cotizaciones(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_estado ON cotizaciones(estado);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_fecha ON cotizaciones(fecha_creacion DESC);
CREATE INDEX IF NOT EXISTS idx_items_cotizacion_cotizacion ON items_cotizacion(cotizacion_id);
CREATE INDEX IF NOT EXISTS idx_items_cotizacion_tipo_vidrio ON items_cotizacion(tipo_vidrio_id);

-- =============================================================
-- Datos iniciales: Tipos de vidrio comunes
-- =============================================================
INSERT INTO tipos_vidrio (nombre, espesor_mm, precio_m2) VALUES
    ('Claro 4mm',       4,    18000.00),
    ('Claro 6mm',       6,    25000.00),
    ('Claro 8mm',       8,    35000.00),
    ('Claro 10mm',     10,    48000.00),
    ('Bronce 4mm',      4,    22000.00),
    ('Bronce 6mm',      6,    30000.00),
    ('Bronce 8mm',      8,    42000.00),
    ('Reflectivo 4mm',  4,    35000.00),
    ('Reflectivo 6mm',  6,    45000.00),
    ('Reflectivo 8mm',  8,    58000.00),
    ('Templado 6mm',    6,    55000.00),
    ('Templado 8mm',    8,    70000.00),
    ('Templado 10mm',  10,    85000.00),
    ('Laminado 6mm',    6,    60000.00),
    ('Laminado 8mm',    8,    78000.00),
    ('Laminado 10mm',  10,    95000.00)
ON CONFLICT (nombre) DO NOTHING;

-- =============================================================
-- Función trigger para actualizar updated_at automáticamente
-- =============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_tipos_vidrio_updated ON tipos_vidrio;
CREATE TRIGGER trigger_tipos_vidrio_updated
    BEFORE UPDATE ON tipos_vidrio
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_clientes_updated ON clientes;
CREATE TRIGGER trigger_clientes_updated
    BEFORE UPDATE ON clientes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_cotizaciones_updated ON cotizaciones;
CREATE TRIGGER trigger_cotizaciones_updated
    BEFORE UPDATE ON cotizaciones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_items_cotizacion_updated ON items_cotizacion;
CREATE TRIGGER trigger_items_cotizacion_updated
    BEFORE UPDATE ON items_cotizacion
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;