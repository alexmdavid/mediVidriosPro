// =============================================================
// Context de autenticación - Estado global de sesión
// =============================================================

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { Usuario } from './types'
import { obtenerPerfil } from '../../api/auth'

interface AuthContextType {
  usuario: Usuario | null
  token: string | null
  cargando: boolean
  login: (token: string, usuario: Usuario) => void
  logout: () => void
  isAdmin: boolean
  isCliente: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (token) {
      obtenerPerfil()
        .then(setUsuario)
        .catch(() => {
          localStorage.removeItem('token')
          setToken(null)
          setUsuario(null)
        })
        .finally(() => setCargando(false))
    } else {
      setCargando(false)
    }
  }, [token])

  const handleLogin = (newToken: string, newUsuario: Usuario) => {
    localStorage.setItem('token', newToken)
    setToken(newToken)
    setUsuario(newUsuario)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUsuario(null)
  }

  return (
    <AuthContext.Provider
      value={{
        usuario,
        token,
        cargando,
        login: handleLogin,
        logout: handleLogout,
        isAdmin: usuario?.rol === 'admin',
        isCliente: usuario?.rol === 'cliente',
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}