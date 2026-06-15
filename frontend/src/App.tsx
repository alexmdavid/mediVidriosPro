import { useState } from 'react'
import CotizacionForm from './features/cotizaciones/CotizacionForm'
import CotizacionList from './features/cotizaciones/CotizacionList'
import CotizacionDetalle from './features/cotizaciones/CotizacionDetalle'

// =============================================================
// Tipos de vista
// =============================================================
type VistaApp = 'lista' | 'nueva' | 'detalle'

function App() {
  const [vista, setVista] = useState<VistaApp>('lista')
  const [cotizacionDetalleId, setCotizacionDetalleId] = useState<number | null>(null)

  // ---- Navegación ----
  const irALista = () => {
    setVista('lista')
    setCotizacionDetalleId(null)
  }

  const irANueva = () => {
    setVista('nueva')
    setCotizacionDetalleId(null)
  }

  const irADetalle = (id: number) => {
    setVista('detalle')
    setCotizacionDetalleId(id)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              {/* Logo / Icono */}
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">mediVidrios</h1>
                <p className="text-xs text-gray-500 -mt-0.5">Sistema de Cotizaciones</p>
              </div>
            </div>

            {/* Navegación */}
            <nav className="flex items-center gap-1">
              <button
                onClick={irALista}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  vista === 'lista'
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
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
                  vista === 'nueva'
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Nueva
                </span>
              </button>
            </nav>

            <div className="hidden md:flex items-center gap-4">
              <span className="text-sm text-gray-500">
                {new Date().toLocaleDateString('es-CO', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {vista === 'lista' && (
          <CotizacionList
            onVerDetalle={irADetalle}
            onCrearNueva={irANueva}
          />
        )}
        {vista === 'nueva' && <CotizacionForm />}
        {vista === 'detalle' && cotizacionDetalleId !== null && (
          <CotizacionDetalle
            cotizacionId={cotizacionDetalleId}
            onVolver={irALista}
          />
        )}
      </main>
    </div>
  )
}

export default App