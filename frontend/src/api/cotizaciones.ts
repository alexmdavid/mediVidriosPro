// =============================================================
// API Client para cotizaciones - Comunicación con el backend Go
// =============================================================

import type {
  TipoVidrio,
  CotizacionResponse,
  CrearCotizacionRequest,
} from '../features/cotizaciones/types'

const API_BASE = 'https://medividriospro.onrender.com/api'

// =============================================================
// Función genérica para requests
// =============================================================

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    const message =
      errorData?.error || errorData?.detalle || `Error HTTP ${response.status}`
    throw new Error(message)
  }

  return response.json()
}

// =============================================================
// Endpoints de la API
// =============================================================

/**
 * Obtener todos los tipos de vidrio activos del catálogo.
 */
export async function obtenerTiposVidrio(): Promise<TipoVidrio[]> {
  return apiRequest<TipoVidrio[]>('/tipos-vidrio')
}

/**
 * Crear una cotización completa con sus items.
 * El backend calcula la cubicación y el costo total.
 */
export async function crearCotizacion(
  request: CrearCotizacionRequest
): Promise<CotizacionResponse> {
  return apiRequest<CotizacionResponse>('/cotizaciones', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

/**
 * Obtener una cotización existente por ID.
 */
export async function obtenerCotizacion(
  id: number
): Promise<CotizacionResponse> {
  return apiRequest<CotizacionResponse>(`/cotizaciones/${id}`)
}

/**
 * Filtros para buscar cotizaciones.
 */
export interface FiltrosCotizacion {
  buscar?: string
  estado?: string
  fecha_desde?: string
  fecha_hasta?: string
  ordenar_por?: string
  orden_dir?: string
}

/**
 * Listar cotizaciones paginadas con filtros opcionales.
 */
export async function listarCotizaciones(
  page: number = 1,
  pageSize: number = 20,
  filtros?: FiltrosCotizacion
): Promise<{
  data: Array<{
    id: number
    cliente_id: number
    descripcion_obra: string
    estado: string
    total_cotizado: number
    porcentaje_margen: number
    fecha_creacion: string
    fecha_actualizacion: string
    cliente?: { id: number; nombre: string }
  }>
  total: number
  page: number
  pageSize: number
  totalPages: number
}> {
  const params = new URLSearchParams()
  params.set('page', page.toString())
  params.set('pageSize', pageSize.toString())

  if (filtros) {
    if (filtros.buscar) params.set('buscar', filtros.buscar)
    if (filtros.estado) params.set('estado', filtros.estado)
    if (filtros.fecha_desde) params.set('fecha_desde', filtros.fecha_desde)
    if (filtros.fecha_hasta) params.set('fecha_hasta', filtros.fecha_hasta)
    if (filtros.ordenar_por) params.set('ordenar_por', filtros.ordenar_por)
    if (filtros.orden_dir) params.set('orden_dir', filtros.orden_dir)
  }

  return apiRequest(`/cotizaciones?${params.toString()}`)
}

/**
 * Preview de cotización (calcula sin persistir).
 */
export async function previewCotizacion(
  request: CrearCotizacionRequest
): Promise<CotizacionResponse> {
  return apiRequest<CotizacionResponse>('/cotizaciones/preview', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}