import { useState } from 'react'
import { AuthProvider, useAuth } from './features/auth/AuthContext'
import LoginPage from './features/auth/LoginPage'
import ClientPortal from './features/auth/ClientPortal'
import CotizacionForm from './features/cotizaciones/CotizacionForm'
import CotizacionList from './features/cotizaciones/CotizacionList'
import CotizacionDetalle from './features/cotizaciones/CotizacionDetalle'
import ClientesList from './features/clientes/ClientesList'

// =============================================================
// Tipos de vista
// =============================================================
type VistaAdmin = 'lista' | 'nueva' | 'detalle' | 'clientes'

// =============================================================
// App con autenticación
// =============================================================

function AppContent() {
  const { usuario, cargando, isAdmin, logout } = useAuth()

  // ---- Estado del admin ----
  const [vistaAdmin, setVistaAdmin] = useState<VistaAdmin>('lista')
  const [detalleId, setDetalleId] = useState<number | null>(null)

  // ---- Loading ----
  if (cargando) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-10 w-10 text-primary-600 mx-auto" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-gray-500 mt-3">Cargando...</p>
        </div>
      </div>
    )
  }

  // ---- Sin sesión: Login ----
  if (!usuario) {
    return <LoginPage />
  }

  // ---- Vista del cliente ----
  if (usuario.rol === 'cliente') {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">mediVidrios</h1>
                  <p className="text-xs text-gray-500 -mt-0.5">Portal del Cliente</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-500">{usuario.nombre}</span>
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ClientPortal />
        </main>
      </div>
    )
  }

  // ---- Vista del admin ----
  const irALista = () => { setVistaAdmin('lista'); setDetalleId(null) }
  const irANueva = () => { setVistaAdmin('nueva'); setDetalleId(null) }
  const irADetalle = (id: number) => { setVistaAdmin('detalle'); setDetalleId(id) }
  const irAClientes = () => { setVistaAdmin('clientes'); setDetalleId(null) }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">mediVidrios</h1>
                <p className="text-xs text-gray-500 -mt-0.5">Panel Administrativo</p>
              </div>
            </div>

            {/* Navegación admin */}
            <nav className="flex items-center gap-1">
              <button
                onClick={irALista}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  vistaAdmin === 'lista' ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                  Cotizaciones
                </span>
              </button>
              <button
                onClick={irANueva}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  vistaAdmin === 'nueva' ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Nueva
                </span>
              </button>
              <button
                onClick={irAClientes}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  vistaAdmin === 'clientes' ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                  Clientes
                </span>
              </button>
            </nav>

            <div className="hidden md:flex items-center gap-4">
              <span className="text-sm text-gray-500">{usuario.nombre}</span>
              <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700 font-medium">
                Salir
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {vistaAdmin === 'lista' && (
          <CotizacionList onVerDetalle={irADetalle} onCrearNueva={irANueva} />
        )}
        {vistaAdmin === 'nueva' && <CotizacionForm />}
        {vistaAdmin === 'detalle' && detalleId !== null && (
          <CotizacionDetalle cotizacionId={detalleId} onVolver={irALista} />
        )}
        {vistaAdmin === 'clientes' && (
          <ClientesList onVolver={irALista} />
        )}
      </main>
    </div>
  )
}

// =============================================================
// Wrapper con AuthProvider
// =============================================================

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App