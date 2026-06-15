-- =============================================================
-- Migración 002: Sistema de autenticación y usuarios
-- =============================================================

BEGIN;

-- Tabla: usuarios
-- Soporta admin, clientes registrados con email/password o Google
CREATE TABLE IF NOT EXISTS usuarios (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(200) NOT NULL,
    email           VARCHAR(200) NOT NULL UNIQUE,
    password_hash   VARCHAR(255),              -- NULL si se registró con Google
    google_id       VARCHAR(100),              -- NULL si se registró con email
    rol             VARCHAR(20) NOT NULL DEFAULT 'cliente'
                    CHECK (rol IN ('admin', 'cliente')),
    telefono        VARCHAR(30),
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE usuarios IS 'Usuarios del sistema: admin y clientes';
COMMENT ON COLUMN usuarios.rol IS 'Rol: admin (dueño) o cliente';
COMMENT ON COLUMN usuarios.google_id IS 'ID de Google OAuth, NULL si registro con email';

-- Relacionar cotizaciones con usuario cliente
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS usuario_cliente_id INTEGER
    REFERENCES usuarios(id) ON DELETE SET NULL;

-- Estado de aceptación del cliente
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS aceptada_cliente BOOLEAN DEFAULT NULL;
-- NULL = pendiente, TRUE = aceptada, FALSE = rechazada

ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS notas_cliente TEXT;

-- Índices
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_usuario_cliente ON cotizaciones(usuario_cliente_id);

-- Trigger para updated_at
CREATE TRIGGER trigger_usuarios_updated
    BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================
-- Crear usuario admin por defecto
-- Contraseña: 1234 (hash bcrypt)
-- =============================================================
INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES
    ('Administrador', 'admin', '$2a$10$vI8aWBnW3fID.92DG3Syeut.fN7dVqNI/qVmZCnOZyS8R/y7V.9K2', 'admin')
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;

COMMIT;