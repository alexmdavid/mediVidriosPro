// =============================================================
// Tipos TypeScript para el dominio de cotizaciones
// =============================================================

// Tipo de vidrio del catálogo
export interface TipoVidrio {
  id: number
  nombre: string
  espesor_mm: number
  precio_m2: number
  activo: boolean
  created_at: string
  updated_at: string
}

// Cliente
export interface Cliente {
  id: number
  nombre: string
  telefono?: string
  email?: string
  direccion?: string
  notas?: string
  created_at: string
  updated_at: string
}

// Item de cotización (respuesta del backend)
export interface ItemCotizacion {
  id: number
  cotizacion_id: number
  tipo_item: string
  ancho_mt: number
  alto_mt: number
  cantidad: number
  tipo_vidrio_id: number
  area_total_m2: number
  precio_unitario_m2: number
  precio_calculado: number
  notas_diseno?: string
  created_at: string
  updated_at: string
  tipo_vidrio?: TipoVidrio
}

// Cotización (respuesta del backend)
export interface Cotizacion {
  id: number
  cliente_id: number
  descripcion_obra: string
  estado: string
  total_cotizado: number
  porcentaje_margen: number
  fecha_creacion: string
  fecha_actualizacion: string
  cliente?: Cliente
  items?: ItemCotizacion[]
}

// Resumen de cotización
export interface ResumenCotizacion {
  cantidad_total_items: number
  area_total_m2: number
  subtotal_costo: number
  porcentaje_margen: number
  total_con_margen: number
  total_formateado: string
}

// Respuesta completa de cotización
export interface CotizacionResponse {
  cotizacion: Cotizacion
  resumen: ResumenCotizacion
}

// =============================================================
// Tipos para el formulario (input del usuario)
// =============================================================

// Fila de medida en el formulario (antes de enviar al backend)
export interface FilaMedida {
  id: string // ID temporal para React keys
  tipo_item: string
  ancho_mt: string  // String para el input, se convierte a number al enviar
  alto_mt: string
  cantidad: string
  tipo_vidrio_id: string
  notas_diseno: string
}

// Request para crear cotización
export interface CrearCotizacionRequest {
  cliente_id: number
  cliente_nombre?: string
  descripcion_obra: string
  porcentaje_margen: number
  items: ItemCotizacionInput[]
}

// Item de input para el request
export interface ItemCotizacionInput {
  tipo_item: string
  ancho_mt: number
  alto_mt: number
  cantidad: number
  tipo_vidrio_id: number
  notas_diseno?: string
}

// =============================================================
// Tipos auxiliares
// =============================================================

// Opciones predefinidas para tipo de ítem
export const TIPOS_ITEM = [
  'Ventana',
  'Espejo',
  'División Baño',
  'Puerta',
  'Mampara',
  'Vidrio Temperado',
  'Vidrio Laminado',
  'Otro',
] as const

export type TipoItem = typeof TIPOS_ITEM[number]

// Utilidad para calcular área en el frontend
export function calcularAreaFrontend(
  ancho: string,
  alto: string,
  cantidad: string
): number {
  const a = parseFloat(ancho)
  const h = parseFloat(alto)
  const c = parseInt(cantidad, 10)

  if (isNaN(a) || isNaN(h) || isNaN(c) || a <= 0 || h <= 0 || c <= 0) {
    return 0
  }

  return Math.round(a * h * c * 10000) / 10000
}

// Utilidad para calcular precio con margen en el frontend
export function calcularPrecioFrontend(
  areaM2: number,
  precioM2: number,
  porcentajeMargen: number
): number {
  if (areaM2 <= 0 || precioM2 <= 0) return 0
  const costo = areaM2 * precioM2
  const conMargen = costo * (1 + porcentajeMargen / 100)
  return Math.round(conMargen * 100) / 100
}

// Formatear como moneda colombiana
export function formatMoneda(valor: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor)
}