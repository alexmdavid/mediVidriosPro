// =============================================================
// Página de Login / Registro con Google
// =============================================================

import { useState, useEffect, useRef } from 'react'
import { login, registro, googleLogin } from '../../api/auth'
import { useAuth } from './AuthContext'

// Declarar tipo global para Google Identity Services
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential: string }) => void
          }) => void
          renderButton: (element: HTMLElement, config: {
            theme?: string
            size?: string
            text?: string
            shape?: string
            width?: number
          }) => void
        }
      }
    }
  }
}

export default function LoginPage() {
  const { login: authLogin } = useAuth()
  const [modo, setModo] = useState<'login' | 'registro'>('login')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [telefono, setTelefono] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const googleBtnRef = useRef<HTMLDivElement>(null)

  // Inicializar Google Identity Services
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) return

    const checkGoogle = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(checkGoogle)
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleCredential,
          auto_select: false,
        } as any)
        if (googleBtnRef.current) {
          window.google.accounts.id.renderButton(googleBtnRef.current, {
            theme: 'outline',
            size: 'large',
            text: 'continue_with',
            shape: 'rectangular',
            width: 300,
          })
        }
      }
    }, 200)

    return () => clearInterval(checkGoogle)
  }, [])

  const handleGoogleCredential = async (response: { credential: string }) => {
    setError(null)
    setCargando(true)
    try {
      // Decodificar JWT de Google para obtener datos del usuario
      const payload = JSON.parse(atob(response.credential.split('.')[1]))
      const resp = await googleLogin({
        google_id: payload.sub,
        email: payload.email,
        nombre: payload.name || payload.email,
      })
      authLogin(resp.token, resp.usuario)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al autenticar con Google')
    } finally {
      setCargando(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setCargando(true)

    console.log('🚀 Iniciando login...', { email, passwordLength: password.length });

    try {
      if (modo === 'login') {
        const resp = await login({ email, password })
        console.log('✅ Login exitoso:', resp.usuario.email);
        authLogin(resp.token, resp.usuario)
      } else {
        const resp = await registro({ nombre, email, password, telefono })
        authLogin(resp.token, resp.usuario)
      }
    } catch (err) {
      console.error('❌ Error en el proceso de login:', err);
      setError(err instanceof Error ? err.message : 'Error al autenticar')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">mediVidrios</h1>
          <p className="text-sm text-gray-500">Sistema de Cotizaciones</p>
        </div>

        {/* Card */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            {modo === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Google Login Button */}
          <div className="mb-4">
            <div ref={googleBtnRef} className="flex justify-center"></div>
          </div>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">o continúa con email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {modo === 'registro' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input
                    type="text"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    required
                    className="input-celda w-full"
                    placeholder="Tu nombre completo"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input
                    type="tel"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    className="input-celda w-full"
                    placeholder="Opcional"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input-celda w-full"
                placeholder="tu@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="input-celda w-full"
                placeholder="Mínimo 6 caracteres"
              />
            </div>

            <button
              type="submit"
              disabled={cargando}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {cargando ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Procesando...
                </>
              ) : (
                modo === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'
              )}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => { setModo(modo === 'login' ? 'registro' : 'login'); setError(null) }}
              className="text-sm text-primary-600 hover:text-primary-800 font-medium"
            >
              {modo === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}