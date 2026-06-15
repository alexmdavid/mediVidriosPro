// =============================================================
// Portal del Cliente - Ver cotizaciones asignadas y responder
// =============================================================

import { useState, useEffect, useCallback } from 'react'
import { misCotizaciones, responderCotizacion } from '../../api/auth'
import { useAuth } from './AuthContext'
import { formatMoneda } from '../cotizaciones/types'
import CotizacionDetalle from '../cotizaciones/CotizacionDetalle'

interface CotizacionItem {
  id: number
  cliente_id: number
  descripcion_obra: string
  estado: string
  total_cotizado: number
  porcentaje_margen: number
  fecha_creacion: string
  fecha_actualizacion: string
  cliente?: { id: number; nombre: string }
}

export default function ClientPortal() {
  const { usuario, logout } = useAuth()
  const [cotizaciones, setCotizaciones] = useState<CotizacionItem[]>([])
  const [cargando, setCargando] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [detalleId, setDetalleId] = useState<number | null>(null)
  const [respondiendo, setRespondiendo] = useState<number | null>(null)

  const cargarCotizaciones = useCallback(async () => {
    setCargando(true)
    try {
      const resp = await misCotizaciones(page, 10)
      setCotizaciones(resp.data || [])
      setTotal(resp.total)
      setTotalPages(resp.totalPages)
    } catch {
      // silently fail
    } finally {
      setCargando(false)
    }
  }, [page])

  useEffect(() => {
    cargarCotizaciones()
  }, [cargarCotizaciones])

  const handleResponder = async (id: number, aceptada: boolean) => {
    setRespondiendo(id)
    try {
      await responderCotizacion(id, aceptada)
      await cargarCotizaciones()
    } catch {
      // silently fail
    } finally {
      setRespondiendo(null)
    }
  }

  if (detalleId) {
    return (
      <div className="space-y-6">
        <CotizacionDetalle cotizacionId={detalleId} onVolver={() => setDetalleId(null)} />
      </div>
    )
  }

  const ESTADO_COLORS: Record<string, string> = {
    borrador: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    enviada: 'bg-blue-100 text-blue-800 border-blue-300',
    aprobada: 'bg-green-100 text-green-800 border-green-300',
    rechazada: 'bg-red-100 text-red-800 border-red-300',
    facturada: 'bg-purple-100 text-purple-800 border-purple-300',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Mis Cotizaciones</h2>
          <p className="text-sm text-gray-500 mt-1">
            Bienvenido, {usuario?.nombre} — {total} cotización{total !== 1 ? 'es' : ''}
          </p>
        </div>
        <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700 font-medium">
          Cerrar sesión
        </button>
      </div>

      {/* Lista */}
      <div className="card overflow-hidden">
        {cargando ? (
          <div className="p-8 text-center">
            <svg className="animate-spin h-8 w-8 text-primary-600 mx-auto" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-gray-500 mt-3">Cargando cotizaciones...</p>
          </div>
        ) : cotizaciones.length === 0 ? (
          <div className="p-8 text-center">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <p className="text-gray-500">No tienes cotizaciones asignadas aún.</p>
            <p className="text-sm text-gray-400 mt-1">El administrador te asignará cotizaciones cuando las tengas listas.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {cotizaciones.map((cot) => (
              <div key={cot.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium text-gray-900">Cotización #{cot.id}</h3>
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border ${ESTADO_COLORS[cot.estado] || 'bg-gray-100 text-gray-800'}`}>
                        {cot.estado.charAt(0).toUpperCase() + cot.estado.slice(1)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{cot.descripcion_obra}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>{formatMoneda(cot.total_cotizado)}</span>
                      <span>{new Date(cot.fecha_creacion).toLocaleDateString('es-CO')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => setDetalleId(cot.id)}
                      className="text-sm text-primary-600 hover:text-primary-800 font-medium"
                    >
                      Ver
                    </button>
                    {cot.estado === 'enviada' && (
                      <>
                        <button
                          onClick={() => handleResponder(cot.id, true)}
                          disabled={respondiendo === cot.id}
                          className="px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 border border-green-300 rounded-lg hover:bg-green-100 disabled:opacity-50"
                        >
                          Aceptar
                        </button>
                        <button
                          onClick={() => handleResponder(cot.id, false)}
                          disabled={respondiendo === cot.id}
                          className="px-3 py-1.5 text-xs font-medium bg-red-50 text-red-700 border border-red-300 rounded-lg hover:bg-red-100 disabled:opacity-50"
                        >
                          Rechazar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">Página {page} de {totalPages}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}