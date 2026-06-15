// =============================================================
// API Client para autenticación
// =============================================================

import type { Usuario, AuthResponse, LoginRequest, RegistroRequest } from '../features/auth/types'

const API_BASE = 'https://medividriospro.onrender.com/api'

async function authRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`
  const token = localStorage.getItem('token')

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(url, {
    ...options,
    headers: { ...headers, ...options.headers as Record<string, string> },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    const message = errorData?.error || `Error HTTP ${response.status}`
    throw new Error(message)
  }

  return response.json()
}

export async function login(data: LoginRequest): Promise<AuthResponse> {
  return authRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function registro(data: RegistroRequest): Promise<AuthResponse> {
  return authRequest<AuthResponse>('/auth/registro', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function googleLogin(data: {
  google_id: string
  email: string
  nombre: string
}): Promise<AuthResponse> {
  return authRequest<AuthResponse>('/auth/google', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function obtenerPerfil(): Promise<Usuario> {
  return authRequest<Usuario>('/auth/perfil')
}

export async function eliminarUsuario(id: number): Promise<{ mensaje: string }> {
  return authRequest<{ mensaje: string }>(`/auth/usuarios/${id}`, {
    method: 'DELETE',
  })
}

export async function actualizarCotizacion(
  id: number,
  data: { estado?: string; total_cotizado?: number; porcentaje_margen?: number; usuario_cliente_id?: number }
): Promise<{ mensaje: string }> {
  return authRequest<{ mensaje: string }>(`/cotizaciones/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function eliminarCotizacion(id: number): Promise<{ mensaje: string }> {
  return authRequest<{ mensaje: string }>(`/cotizaciones/${id}`, {
    method: 'DELETE',
  })
}

export async function asignarCotizacion(
  id: number,
  usuarioClienteId: number
): Promise<{ mensaje: string }> {
  return authRequest<{ mensaje: string }>(`/cotizaciones/${id}/asignar`, {
    method: 'PUT',
    body: JSON.stringify({ usuario_cliente_id: usuarioClienteId }),
  })
}

export async function listarUsuarios(
  page = 1,
  pageSize = 50
): Promise<{ data: Usuario[]; total: number }> {
  return authRequest(`/auth/usuarios?page=${page}&pageSize=${pageSize}`)
}

export async function misCotizaciones(
  page = 1,
  pageSize = 20
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
  return authRequest(`/mis-cotizaciones?page=${page}&pageSize=${pageSize}`)
}

export async function responderCotizacion(
  id: number,
  aceptada: boolean,
  notas?: string
): Promise<{ mensaje: string }> {
  return authRequest<{ mensaje: string }>(`/cotizaciones/${id}/responder`, {
    method: 'PUT',
    body: JSON.stringify({ aceptada, notas }),
  })
}