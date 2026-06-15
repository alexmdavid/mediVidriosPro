// =============================================================
// Tipos para el sistema de autenticación
// =============================================================

export interface Usuario {
  id: number
  nombre: string
  email: string
  rol: 'admin' | 'cliente'
  telefono?: string
  activo: boolean
  created_at: string
}

export interface AuthResponse {
  token: string
  usuario: Usuario
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegistroRequest {
  nombre: string
  email: string
  password: string
  telefono?: string
}