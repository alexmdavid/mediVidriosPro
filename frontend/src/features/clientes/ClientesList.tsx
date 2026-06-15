// =============================================================
// Panel de Administración de Clientes
// Diseño idéntico al panel de cotizaciones con tabla, búsqueda y acciones
// =============================================================

import { useState, useEffect, useCallback } from 'react'
import { listarClientes, eliminarCliente, actualizarCliente, crearCliente, type Cliente } from '../../api/cotizaciones'

interface Props {
  onVolver?: () => void
}

export default function ClientesList({ onVolver }: Props) {
  // ---- Estado ----
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const pageSize = 10

  // Búsqueda con debounce
  const [buscar, setBuscar] = useState('')
  const [buscarDebounce, setBuscarDebounce] = useState('')

  // Modal de confirmación
  const [eliminarId, setEliminarId] = useState<number | null>(null)
  const [editando, setEditando] = useState<Cliente | null>(null)
  const [creando, setCreando] = useState(false)
  const [nuevoCliente, setNuevoCliente] = useState<Partial<Cliente>>({ nombre: '' })

  const [guardando, setGuardando] = useState(false)

  // ---- Efecto de debounce para búsqueda ----
  useEffect(() => {
    const timer = setTimeout(() => {
      setBuscarDebounce(buscar)
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [buscar])

  // ---- Cargar clientes ----
  const cargarClientes = useCallback(async () => {
    setCargando(true)
    setError(null)

    try {
      const response = await listarClientes(page, pageSize, buscarDebounce)
      setClientes(response.data || [])
      setTotal(response.total)
      setTotalPages(response.total_pages)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar clientes')
      setClientes([])
    } finally {
      setCargando(false)
    }
  }, [page, buscarDebounce])

  useEffect(() => {
    cargarClientes()
  }, [cargarClientes])

  // ---- Eliminar cliente ----
  const handleEliminar = async () => {
    if (eliminarId === null) return
    setGuardando(true)
    try {
      await eliminarCliente(eliminarId)
      setEliminarId(null)
      cargarClientes()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar cliente')
    } finally {
      setGuardando(false)
    }
  }

  // ---- Guardar edición ----
  const handleGuardarEdicion = async () => {
    if (!editando || !editando.nombre.trim()) return
    setGuardando(true)
    try {
      await actualizarCliente(editando.id, {
        nombre: editando.nombre,
        telefono: editando.telefono,
        email: editando.email,
        direccion: editando.direccion,
        notas: editando.notas,
      })
      setEditando(null)
      cargarClientes()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar cliente')
    } finally {
      setGuardando(false)
    }
  }

  // ---- Crear nuevo cliente ----
  const handleCrear = async () => {
    if (!nuevoCliente.nombre?.trim()) return
    setGuardando(true)
    try {
      await crearCliente({
        nombre: nuevoCliente.nombre.trim(),
        telefono: nuevoCliente.telefono,
        email: nuevoCliente.email,
        direccion: nuevoCliente.direccion,
        notas: nuevoCliente.notas,
      })
      setCreando(false)
      setNuevoCliente({ nombre: '' })
      setPage(1)
      cargarClientes()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear cliente')
    } finally {
      setGuardando(false)
    }
  }

  // ---- Limpiar filtros ----
  const hayFiltros = buscarDebounce !== ''

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onVolver && (
            <button
              onClick={onVolver}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Volver"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </button>
          )}
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Clientes</h2>
            <p className="text-sm text-gray-500 mt-1">
              {total} cliente{total !== 1 ? 's' : ''} registrado{total !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={() => setCreando(true)}
          className="btn-primary flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nuevo Cliente
        </button>
      </div>

      {/* Filtros */}
      <div className="card p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                placeholder="Buscar por nombre, email o teléfono..."
                className="input-celda pl-10 w-full"
              />
            </div>
          </div>
          <div className="flex items-end justify-end">
            {hayFiltros && (
              <button
                onClick={() => { setBuscar(''); setBuscarDebounce(''); setPage(1) }}
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

      {/* Modal Crear Cliente */}
      {creando && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setCreando(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Nuevo Cliente</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={nuevoCliente.nombre || ''}
                  onChange={(e) => setNuevoCliente({ ...nuevoCliente, nombre: e.target.value })}
                  className="input-celda w-full"
                  placeholder="Nombre completo"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input
                  type="text"
                  value={nuevoCliente.telefono || ''}
                  onChange={(e) => setNuevoCliente({ ...nuevoCliente, telefono: e.target.value })}
                  className="input-celda w-full"
                  placeholder="Opcional"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={nuevoCliente.email || ''}
                  onChange={(e) => setNuevoCliente({ ...nuevoCliente, email: e.target.value })}
                  className="input-celda w-full"
                  placeholder="Opcional"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setCreando(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleCrear} disabled={guardando || !nuevoCliente.nombre?.trim()} className="btn-primary">
                {guardando ? 'Guardando...' : 'Crear Cliente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Cliente */}
      {editando && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setEditando(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Editar Cliente</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={editando.nombre}
                  onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
                  className="input-celda w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input
                  type="text"
                  value={editando.telefono || ''}
                  onChange={(e) => setEditando({ ...editando, telefono: e.target.value })}
                  className="input-celda w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editando.email || ''}
                  onChange={(e) => setEditando({ ...editando, email: e.target.value })}
                  className="input-celda w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                <input
                  type="text"
                  value={editando.direccion || ''}
                  onChange={(e) => setEditando({ ...editando, direccion: e.target.value })}
                  className="input-celda w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea
                  value={editando.notas || ''}
                  onChange={(e) => setEditando({ ...editando, notas: e.target.value })}
                  className="input-celda w-full"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setEditando(null)} className="btn-secondary">Cancelar</button>
              <button onClick={handleGuardarEdicion} disabled={guardando || !editando.nombre.trim()} className="btn-primary">
                {guardando ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminación */}
      {eliminarId !== null && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setEliminarId(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Confirmar eliminación</h3>
            <p className="text-sm text-gray-600 mb-6">
              ¿Estás seguro de eliminar este cliente? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setEliminarId(null)} className="btn-secondary">Cancelar</button>
              <button onClick={handleEliminar} disabled={guardando} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium">
                {guardando ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="card overflow-hidden">
        {cargando ? (
          <div className="p-8 text-center">
            <svg className="animate-spin h-8 w-8 text-primary-600 mx-auto" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-gray-500 mt-3">Cargando clientes...</p>
          </div>
        ) : clientes.length === 0 ? (
          <div className="p-8 text-center">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            <p className="text-gray-500">
              {hayFiltros
                ? 'No se encontraron clientes con los filtros aplicados.'
                : 'No hay clientes registrados aún.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-12">#</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Teléfono</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Email</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {clientes.map((cliente, idx) => (
                    <tr key={cliente.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-500 font-medium">{idx + 1 + (page - 1) * pageSize}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{cliente.nombre}</td>
                      <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{cliente.telefono || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{cliente.email || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setEditando(cliente)}
                            className="text-primary-600 hover:text-primary-800 text-sm font-medium hover:underline"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => setEliminarId(cliente.id)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium hover:underline"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                <p className="text-sm text-gray-500">Página {page} de {totalPages}</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Anterior
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number
                    if (totalPages <= 5) pageNum = i + 1
                    else if (page <= 3) pageNum = i + 1
                    else if (page >= totalPages - 2) pageNum = totalPages - 4 + i
                    else pageNum = page - 2 + i
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          page === pageNum ? 'bg-primary-600 text-white' : 'border border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
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