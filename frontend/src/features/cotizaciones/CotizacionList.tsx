// =============================================================
// Componente de lista de cotizaciones con filtros de búsqueda
// =============================================================

import { useState, useEffect, useCallback } from 'react'
import { listarCotizaciones, type FiltrosCotizacion } from '../../api/cotizaciones'
import { formatMoneda } from './types'

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

interface Props {
  onVerDetalle: (id: number) => void
  onCrearNueva: () => void
}

const ESTADOS = ['', 'borrador', 'enviada', 'aprobada', 'rechazada', 'facturada']

const ESTADO_COLORS: Record<string, string> = {
  borrador: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  enviada: 'bg-blue-100 text-blue-800 border-blue-300',
  aprobada: 'bg-green-100 text-green-800 border-green-300',
  rechazada: 'bg-red-100 text-red-800 border-red-300',
  facturada: 'bg-purple-100 text-purple-800 border-purple-300',
}

export default function CotizacionList({ onVerDetalle, onCrearNueva }: Props) {
  // ---- Estado ----
  const [cotizaciones, setCotizaciones] = useState<CotizacionItem[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const pageSize = 10

  // Filtros
  const [buscar, setBuscar] = useState('')
  const [estado, setEstado] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [ordenarPor, setOrdenarPor] = useState('fecha')
  const [ordenDir, setOrdenDir] = useState('DESC')

  // Búsqueda con debounce
  const [buscarDebounce, setBuscarDebounce] = useState('')

  // ---- Efecto de debounce para búsqueda ----
  useEffect(() => {
    const timer = setTimeout(() => {
      setBuscarDebounce(buscar)
      setPage(1) // Resetear a página 1 al buscar
    }, 400)
    return () => clearTimeout(timer)
  }, [buscar])

  // ---- Cargar cotizaciones ----
  const cargarCotizaciones = useCallback(async () => {
    setCargando(true)
    setError(null)

    const filtros: FiltrosCotizacion = {}
    if (buscarDebounce) filtros.buscar = buscarDebounce
    if (estado) filtros.estado = estado
    if (fechaDesde) filtros.fecha_desde = fechaDesde
    if (fechaHasta) filtros.fecha_hasta = fechaHasta
    if (ordenarPor) filtros.ordenar_por = ordenarPor
    if (ordenDir) filtros.orden_dir = ordenDir

    try {
      const response = await listarCotizaciones(page, pageSize, filtros)
      setCotizaciones(response.data || [])
      setTotal(response.total)
      setTotalPages(response.totalPages)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar cotizaciones')
      setCotizaciones([])
    } finally {
      setCargando(false)
    }
  }, [page, buscarDebounce, estado, fechaDesde, fechaHasta, ordenarPor, ordenDir])

  useEffect(() => {
    cargarCotizaciones()
  }, [cargarCotizaciones])

  // ---- Limpiar filtros ----
  const limpiarFiltros = () => {
    setBuscar('')
    setEstado('')
    setFechaDesde('')
    setFechaHasta('')
    setOrdenarPor('fecha')
    setOrdenDir('DESC')
    setPage(1)
  }

  // ---- Alternar orden ----
  const toggleOrden = (campo: string) => {
    if (ordenarPor === campo) {
      setOrdenDir(ordenDir === 'ASC' ? 'DESC' : 'ASC')
    } else {
      setOrdenarPor(campo)
      setOrdenDir('DESC')
    }
    setPage(1)
  }

  // ---- Icono de ordenamiento ----
  const iconoOrden = (campo: string) => {
    if (ordenarPor !== campo) return null
    return ordenDir === 'ASC' ? ' ↑' : ' ↓'
  }

  // ---- Formatear fecha ----
  const formatFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  // ---- Filtros activos ----
  const hayFiltros = buscarDebounce || estado || fechaDesde || fechaHasta

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Cotizaciones</h2>
          <p className="text-sm text-gray-500 mt-1">
            {total} cotización{total !== 1 ? 'es' : ''} encontrada{total !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={onCrearNueva}
          className="btn-primary flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nueva Cotización
        </button>
      </div>

      {/* Filtros */}
      <div className="card p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Búsqueda por texto */}
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Buscar</label>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                value={buscar}
                onChange={(e) => setBuscar(e.target.value)}
                placeholder="Buscar por cliente o descripción..."
                className="input-celda pl-10 w-full"
              />
            </div>
          </div>

          {/* Filtro por estado */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
            <select
              value={estado}
              onChange={(e) => { setEstado(e.target.value); setPage(1) }}
              className="input-celda w-full"
            >
              <option value="">Todos</option>
              {ESTADOS.filter(Boolean).map((est) => (
                <option key={est} value={est}>
                  {est.charAt(0).toUpperCase() + est.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Ordenar por */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Ordenar por</label>
            <select
              value={ordenarPor}
              onChange={(e) => { setOrdenarPor(e.target.value); setPage(1) }}
              className="input-celda w-full"
            >
              <option value="fecha">Fecha</option>
              <option value="cliente">Cliente</option>
              <option value="total">Total</option>
              <option value="estado">Estado</option>
              <option value="descripcion">Descripción</option>
            </select>
          </div>

          {/* Fecha desde */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Fecha desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => { setFechaDesde(e.target.value); setPage(1) }}
              className="input-celda w-full"
            />
          </div>

          {/* Fecha hasta */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Fecha hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => { setFechaHasta(e.target.value); setPage(1) }}
              className="input-celda w-full"
            />
          </div>

          {/* Limpiar filtros */}
          <div className="flex items-end">
            {hayFiltros && (
              <button
                onClick={limpiarFiltros}
                className="text-sm text-primary-600 hover:text-primary-800 font-medium flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Limpiar filtros
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="card p-4 bg-red-50 border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Tabla de resultados */}
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
            <p className="text-gray-500">
              {hayFiltros
                ? 'No se encontraron cotizaciones con los filtros aplicados.'
                : 'No hay cotizaciones registradas aún.'}
            </p>
            {hayFiltros && (
              <button onClick={limpiarFiltros} className="mt-2 text-sm text-primary-600 hover:text-primary-800 font-medium">
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-12">#</th>
                    <th
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none"
                      onClick={() => toggleOrden('cliente')}
                    >
                      Cliente{iconoOrden('cliente')}
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none hidden md:table-cell"
                      onClick={() => toggleOrden('descripcion')}
                    >
                      Descripción{iconoOrden('descripcion')}
                    </th>
                    <th
                      className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none"
                      onClick={() => toggleOrden('estado')}
                    >
                      Estado{iconoOrden('estado')}
                    </th>
                    <th
                      className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none"
                      onClick={() => toggleOrden('total')}
                    >
                      Total{iconoOrden('total')}
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none hidden lg:table-cell"
                      onClick={() => toggleOrden('fecha')}
                    >
                      Fecha{iconoOrden('fecha')}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {cotizaciones.map((cot) => (
                    <tr key={cot.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-500 font-medium">{cot.id}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {cot.cliente?.nombre || 'Sin cliente'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden md:table-cell max-w-xs truncate">
                        {cot.descripcion_obra}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border ${ESTADO_COLORS[cot.estado] || 'bg-gray-100 text-gray-800 border-gray-300'}`}>
                          {cot.estado.charAt(0).toUpperCase() + cot.estado.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-green-700">
                        {formatMoneda(cot.total_cotizado)}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">
                        {formatFecha(cot.fecha_creacion)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => onVerDetalle(cot.id)}
                          className="text-primary-600 hover:text-primary-800 text-sm font-medium hover:underline"
                          title="Ver detalle"
                        >
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Página {page} de {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Anterior
                  </button>
                  {/* Botones de página */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (page <= 3) {
                      pageNum = i + 1
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = page - 2 + i
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          page === pageNum
                            ? 'bg-primary-600 text-white'
                            : 'border border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}