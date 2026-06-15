-- =============================================================
-- Migración 003: Google ID en clientes (auth separado de usuarios)
-- =============================================================

BEGIN;

-- Agregar columna google_id a la tabla clientes
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS google_id VARCHAR(100) UNIQUE;

COMMENT ON COLUMN clientes.google_id IS 'ID de Google OAuth para autenticación de clientes sin crear registro en usuarios';

-- Índice para búsqueda rápida por Google ID
CREATE INDEX IF NOT EXISTS idx_clientes_google_id ON clientes(google_id);

COMMIT;