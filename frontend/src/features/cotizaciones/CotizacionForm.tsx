import { useState, useEffect, useCallback } from 'react'
import type {
  FilaMedida,
  TipoVidrio,
  CotizacionResponse,
} from './types'
import {
  calcularAreaFrontend,
  calcularPrecioFrontend,
  formatMoneda,
} from './types'
import FilaMedidaRow from './FilaMedida'
import { obtenerTiposVidrio, crearCotizacion } from '../../api/cotizaciones'
import { generarCotizacionPDF } from './GenerarPDF'

// =============================================================
// Generar ID temporal único para filas
// =============================================================
let filaIdCounter = 0
function generarFilaId(): string {
  filaIdCounter += 1
  return `fila_${Date.now()}_${filaIdCounter}`
}

// =============================================================
// Fila vacía por defecto
// =============================================================
function crearFilaVacia(): FilaMedida {
  return {
    id: generarFilaId(),
    tipo_item: '',
    ancho_mt: '',
    alto_mt: '',
    cantidad: '1',
    tipo_vidrio_id: '',
    notas_diseno: '',
  }
}

// =============================================================
// Componente principal del formulario de cotización
// =============================================================
export default function CotizacionForm() {
  // ---- Estado ----
  const [clienteNombre, setClienteNombre] = useState('')
  const [descripcionObra, setDescripcionObra] = useState('')
  const [porcentajeMargen, setPorcentajeMargen] = useState('30')
  const [filas, setFilas] = useState<FilaMedida[]>([crearFilaVacia()])
  const [tiposVidrio, setTiposVidrio] = useState<TipoVidrio[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<CotizacionResponse | null>(null)
  const [autoFocusFilaId, setAutoFocusFilaId] = useState<string | null>(null)
  const [autoFocusCampo, setAutoFocusCampo] = useState<string | undefined>(undefined)

  // ---- Cargar tipos de vidrio al montar ----
  useEffect(() => {
    obtenerTiposVidrio()
      .then(setTiposVidrio)
      .catch((err) => {
        console.error('Error al cargar tipos de vidrio:', err)
        setError('No se pudieron cargar los tipos de vidrio. Verifica que el backend esté ejecutándose.')
      })
  }, [])

  // ---- Calcular totales ----
  const margen = parseFloat(porcentajeMargen) || 0
  let totalAreaM2 = 0
  let totalCosto = 0

  for (const fila of filas) {
    const area = calcularAreaFrontend(fila.ancho_mt, fila.alto_mt, fila.cantidad)
    totalAreaM2 += area

    const tipoVidrio = tiposVidrio.find(
      (tv) => tv.id === parseInt(fila.tipo_vidrio_id, 10)
    )
    if (tipoVidrio && area > 0) {
      totalCosto += calcularPrecioFrontend(area, tipoVidrio.precio_m2, margen)
    }
  }
  totalAreaM2 = Math.round(totalAreaM2 * 10000) / 10000
  totalCosto = Math.round(totalCosto * 100) / 100

  const cantidadTotalItems = filas.reduce((sum, f) => {
    const c = parseInt(f.cantidad, 10)
    return sum + (isNaN(c) || c <= 0 ? 0 : c)
  }, 0)

  // ---- Handlers ----
  const actualizarFila = useCallback(
    (id: string, campo: keyof FilaMedida, valor: string) => {
      setFilas((prev) =>
        prev.map((f) => (f.id === id ? { ...f, [campo]: valor } : f))
      )
    },
    []
  )

  const eliminarFila = useCallback((id: string) => {
    setFilas((prev) => {
      if (prev.length <= 1) return prev // No eliminar la última fila
      return prev.filter((f) => f.id !== id)
    })
  }, [])

  const duplicarFila = useCallback(
    (id: string) => {
      setFilas((prev) => {
        const index = prev.findIndex((f) => f.id === id)
        if (index === -1) return prev
        const filaOriginal = prev[index]
        const nuevaFila: FilaMedida = {
          ...filaOriginal,
          id: generarFilaId(),
        }
        const nuevas = [...prev]
        nuevas.splice(index + 1, 0, nuevaFila)
        return nuevas
      })
    },
    []
  )

  const agregarFila = useCallback(() => {
    const nuevaFila = crearFilaVacia()
    setFilas((prev) => [...prev, nuevaFila])
    setAutoFocusFilaId(nuevaFila.id)
    setAutoFocusCampo('tipo_item')
    // Limpiar auto-focus después de un breve delay
    setTimeout(() => {
      setAutoFocusFilaId(null)
      setAutoFocusCampo(undefined)
    }, 100)
  }, [])

  // Agregar fila al presionar Enter en la última fila
  const handleKeyDownGlobal = useCallback(
    (e: React.KeyboardEvent) => {
      // Si se presiona Enter en la última fila, agregar nueva fila
      if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
        const target = e.target as HTMLElement
        const lastRow = target.closest('tbody')?.querySelector('tr:last-child')
        const currentRow = target.closest('tr')
        if (lastRow === currentRow) {
          e.preventDefault()
          agregarFila()
        }
      }
    },
    [agregarFila]
  )

  // ---- Validar formulario ----
  const esFormularioValido = (): boolean => {
    if (!clienteNombre.trim()) return false
    if (!descripcionObra.trim()) return false
    if (filas.length === 0) return false

    for (const fila of filas) {
      if (!fila.tipo_item) return false
      if (!fila.tipo_vidrio_id) return false
      const ancho = parseFloat(fila.ancho_mt)
      const alto = parseFloat(fila.alto_mt)
      const cantidad = parseInt(fila.cantidad, 10)
      if (isNaN(ancho) || ancho <= 0) return false
      if (isNaN(alto) || alto <= 0) return false
      if (isNaN(cantidad) || cantidad <= 0) return false
    }

    return true
  }

  // ---- Enviar cotización ----
  const handleSubmit = async () => {
    if (!esFormularioValido()) {
      setError('Por favor completa todos los campos obligatorios correctamente.')
      return
    }

    setCargando(true)
    setError(null)
    setResultado(null)

    try {
      const response = await crearCotizacion({
        cliente_id: 0,
        cliente_nombre: clienteNombre.trim(),
        descripcion_obra: descripcionObra.trim(),
        porcentaje_margen: margen,
        items: filas.map((f) => ({
          tipo_item: f.tipo_item,
          ancho_mt: parseFloat(f.ancho_mt),
          alto_mt: parseFloat(f.alto_mt),
          cantidad: parseInt(f.cantidad, 10),
          tipo_vidrio_id: parseInt(f.tipo_vidrio_id, 10),
          notas_diseno: f.notas_diseno.trim() || undefined,
        })),
      })

      setResultado(response)
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Error desconocido al crear cotización'
      setError(msg)
    } finally {
      setCargando(false)
    }
  }

  // ---- Resetear formulario ----
  const handleReset = () => {
    setClienteNombre('')
    setDescripcionObra('')
    setPorcentajeMargen('30')
    setFilas([crearFilaVacia()])
    setResultado(null)
    setError(null)
  }

  // =============================================================
  // Render
  // =============================================================
  return (
    <div className="space-y-6" onKeyDown={handleKeyDownGlobal}>
      {/* Título */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Nueva Cotización</h2>
        <p className="text-sm text-gray-500 mt-1">
          Ingresa las medidas de vidrio en formato de tabla. El sistema calculará automáticamente la cubicación y costos.
        </p>
      </div>

      {/* Resultado de cotización exitosa */}
      {resultado && (
        <div className="card bg-green-50 border-green-200 p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-green-800">
                Cotización #{resultado.cotizacion.id} creada exitosamente
              </h3>
              <p className="text-sm text-green-700 mt-1">
                Estado: <span className="font-medium capitalize">{resultado.cotizacion.estado}</span>
              </p>

              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg p-3 border border-green-200">
                  <p className="text-xs text-gray-500">Total Items</p>
                  <p className="text-lg font-bold text-gray-900">{resultado.resumen.cantidad_total_items}</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-green-200">
                  <p className="text-xs text-gray-500">Área Total</p>
                  <p className="text-lg font-bold text-gray-900">{resultado.resumen.area_total_m2.toFixed(4)} m²</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-green-200">
                  <p className="text-xs text-gray-500">Subtotal (costo)</p>
                  <p className="text-lg font-bold text-gray-900">{formatMoneda(resultado.resumen.subtotal_costo)}</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-green-200 bg-green-100">
                  <p className="text-xs text-green-700">Total Cotizado (+{resultado.resumen.porcentaje_margen}%)</p>
                  <p className="text-xl font-bold text-green-800">{resultado.resumen.total_formateado}</p>
                </div>
              </div>

              {/* Desglose por item */}
              {resultado.cotizacion.items && resultado.cotizacion.items.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Desglose por ítem:</h4>
                  <div className="bg-white rounded-lg border border-green-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-green-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Tipo</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Medidas</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Cant.</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Área (m²)</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Vidrio</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Precio</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {resultado.cotizacion.items.map((item) => (
                          <tr key={item.id}>
                            <td className="px-3 py-2 font-medium">{item.tipo_item}</td>
                            <td className="px-3 py-2 text-gray-600">
                              {item.ancho_mt}m × {item.alto_mt}m
                            </td>
                            <td className="px-3 py-2 text-right">{item.cantidad}</td>
                            <td className="px-3 py-2 text-right text-primary-700 font-medium">
                              {item.area_total_m2.toFixed(4)}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-600">
                              {item.tipo_vidrio?.nombre || `ID ${item.tipo_vidrio_id}`}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-green-700">
                              {formatMoneda(item.precio_calculado)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={() => generarCotizacionPDF(resultado)}
                  className="btn-primary flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Descargar PDF
                </button>
                <button
                  onClick={handleReset}
                  className="btn-secondary"
                >
                  Crear otra cotización
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Formulario */}
      {!resultado && (
        <>
          {/* Datos del cliente y obra */}
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
              Datos del Cliente y Obra
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del Cliente *
                </label>
                <input
                  type="text"
                  value={clienteNombre}
                  onChange={(e) => setClienteNombre(e.target.value)}
                  placeholder="Ej: Juan Pérez, Constructora XYZ"
                  className="input-celda"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Obra / Descripción *
                </label>
                <input
                  type="text"
                  value={descripcionObra}
                  onChange={(e) => setDescripcionObra(e.target.value)}
                  placeholder="Ej: Remodelación apartamento 302"
                  className="input-celda"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  % Margen / Ganancia
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={porcentajeMargen}
                  onChange={(e) => setPorcentajeMargen(e.target.value)}
                  className="input-celda"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipos de vidrio disponibles
                </label>
                <p className="text-sm text-gray-500 py-1.5">
                  {tiposVidrio.length > 0
                    ? `${tiposVidrio.length} tipos cargados`
                    : 'Cargando...'}
                </p>
              </div>
            </div>
          </div>

          {/* Tabla de medidas */}
          <div className="card overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Medidas de Vidrio
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Presiona Enter para avanzar entre campos. Agrega filas con el botón inferior.
                </p>
              </div>
              <button
                type="button"
                onClick={agregarFila}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Añadir Fila
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[900px]">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase w-8">#</th>
                    <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase w-36">Tipo Ítem</th>
                    <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase w-48">Tipo Vidrio</th>
                    <th className="px-2 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase w-24">Ancho (m)</th>
                    <th className="px-2 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase w-24">Alto (m)</th>
                    <th className="px-2 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase w-20">Cant.</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase w-28">Área (m²)</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase w-28">$ / m²</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase w-32">Precio</th>
                    <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase w-32">Notas</th>
                    <th className="px-2 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase w-20">Acc.</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((fila, index) => (
                    <FilaMedidaRow
                      key={fila.id}
                      fila={fila}
                      index={index}
                      tiposVidrio={tiposVidrio}
                      porcentajeMargen={margen}
                      onChange={actualizarFila}
                      onEliminar={eliminarFila}
                      onDuplicar={duplicarFila}
                      autoFocusField={autoFocusFilaId === fila.id ? autoFocusCampo : undefined}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Botón agregar fila */}
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
              <button
                type="button"
                onClick={agregarFila}
                className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50/50 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Añadir otra fila (o presiona Enter en la última celda)
              </button>
            </div>
          </div>

          {/* Resumen y botón de envío */}
          <div className="card p-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Filas</p>
                <p className="text-lg font-bold text-gray-900">{filas.length}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Cant. Total</p>
                <p className="text-lg font-bold text-gray-900">{cantidadTotalItems}</p>
              </div>
              <div className="bg-primary-50 rounded-lg p-3 text-center">
                <p className="text-xs text-primary-600">Área Total (m²)</p>
                <p className="text-lg font-bold text-primary-700">{totalAreaM2.toFixed(4)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Margen</p>
                <p className="text-lg font-bold text-gray-900">{margen}%</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
                <p className="text-xs text-green-600">TOTAL</p>
                <p className="text-xl font-bold text-green-700">{formatMoneda(totalCosto)}</p>
              </div>
            </div>

            {/* Errores */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Botones */}
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="btn-secondary"
              >
                Limpiar Todo
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={cargando || !esFormularioValido()}
                className="btn-primary flex items-center gap-2"
              >
                {cargando ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Generando...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    Generar Cotización
                  </>
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}