import { useEffect, useRef } from 'react'
import type { FilaMedida as FilaMedidaType, TipoVidrio } from './types'
import { TIPOS_ITEM, calcularAreaFrontend, calcularPrecioFrontend, formatMoneda } from './types'

// =============================================================
// Props del componente FilaMedida
// =============================================================
interface FilaMedidaProps {
  fila: FilaMedidaType
  index: number
  tiposVidrio: TipoVidrio[]
  porcentajeMargen: number
  onChange: (id: string, campo: keyof FilaMedidaType, valor: string) => void
  onEliminar: (id: string) => void
  onDuplicar: (id: string) => void
  autoFocusField?: string
}

// =============================================================
// Componente FilaMedida - Una fila de la tabla de medidas
// =============================================================
export default function FilaMedida({
  fila,
  index,
  tiposVidrio,
  porcentajeMargen,
  onChange,
  onEliminar,
  onDuplicar,
  autoFocusField,
}: FilaMedidaProps) {
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null)

  // Auto-focus al campo especificado
  useEffect(() => {
    if (autoFocusField && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocusField])

  // Calcular valores derivados
  const areaTotal = calcularAreaFrontend(fila.ancho_mt, fila.alto_mt, fila.cantidad)
  const tipoVidrioSeleccionado = tiposVidrio.find(
    (tv) => tv.id === parseInt(fila.tipo_vidrio_id, 10)
  )
  const precioM2 = tipoVidrioSeleccionado?.precio_m2 ?? 0
  const precioTotal = calcularPrecioFrontend(areaTotal, precioM2, porcentajeMargen)

  // Manejar tecla Enter para navegar entre campos
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
    siguienteCampo?: string
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (siguienteCampo) {
        // Focus al siguiente campo de la misma fila
        const siguiente = (e.target as HTMLElement)
          .closest('tr')
          ?.querySelector(`[data-campo="${siguienteCampo}"]`)
        if (siguiente) {
          (siguiente as HTMLElement).focus()
        }
      }
    }
  }

  return (
    <tr className="fila-medida border-b border-gray-100">
      {/* Número de fila */}
      <td className="px-3 py-2 text-center">
        <span className="text-xs font-medium text-gray-400">{index + 1}</span>
      </td>

      {/* Tipo de Ítem */}
      <td className="px-2 py-1.5">
        <select
          ref={inputRef as React.RefObject<HTMLSelectElement>}
          data-campo="tipo_item"
          value={fila.tipo_item}
          onChange={(e) => onChange(fila.id, 'tipo_item', e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, 'ancho_mt')}
          className="select-celda"
        >
          <option value="">Seleccionar...</option>
          {TIPOS_ITEM.map((tipo) => (
            <option key={tipo} value={tipo}>
              {tipo}
            </option>
          ))}
        </select>
      </td>

      {/* Tipo de Vidrio */}
      <td className="px-2 py-1.5">
        <select
          value={fila.tipo_vidrio_id}
          onChange={(e) => onChange(fila.id, 'tipo_vidrio_id', e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, 'ancho_mt')}
          className="select-celda"
          data-campo="tipo_vidrio"
        >
          <option value="">Vidrio...</option>
          {tiposVidrio.map((tv) => (
            <option key={tv.id} value={tv.id}>
              {tv.nombre} ({tv.espesor_mm}mm) - ${tv.precio_m2.toLocaleString()}/m²
            </option>
          ))}
        </select>
      </td>

      {/* Ancho (m) */}
      <td className="px-2 py-1.5">
        <input
          ref={autoFocusField === 'ancho_mt' ? inputRef as React.RefObject<HTMLInputElement> : undefined}
          data-campo="ancho_mt"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="0.00"
          value={fila.ancho_mt}
          onChange={(e) => onChange(fila.id, 'ancho_mt', e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, 'alto_mt')}
          className={`input-celda text-center ${fila.ancho_mt && parseFloat(fila.ancho_mt) <= 0 ? 'input-celda-error' : ''}`}
        />
      </td>

      {/* Alto (m) */}
      <td className="px-2 py-1.5">
        <input
          data-campo="alto_mt"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="0.00"
          value={fila.alto_mt}
          onChange={(e) => onChange(fila.id, 'alto_mt', e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, 'cantidad')}
          className={`input-celda text-center ${fila.alto_mt && parseFloat(fila.alto_mt) <= 0 ? 'input-celda-error' : ''}`}
        />
      </td>

      {/* Cantidad */}
      <td className="px-2 py-1.5">
        <input
          data-campo="cantidad"
          type="number"
          step="1"
          min="1"
          placeholder="1"
          value={fila.cantidad}
          onChange={(e) => onChange(fila.id, 'cantidad', e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, 'notas')}
          className={`input-celda text-center ${fila.cantidad && parseInt(fila.cantidad, 10) <= 0 ? 'input-celda-error' : ''}`}
        />
      </td>

      {/* Area Total (m²) - Calculado automáticamente */}
      <td className="px-3 py-2 text-right">
        <span className={`text-sm font-medium ${areaTotal > 0 ? 'text-primary-700' : 'text-gray-300'}`}>
          {areaTotal > 0 ? `${areaTotal.toFixed(4)} m²` : '—'}
        </span>
      </td>

      {/* Precio Unitario m² */}
      <td className="px-3 py-2 text-right">
        <span className={`text-sm ${precioM2 > 0 ? 'text-gray-600' : 'text-gray-300'}`}>
          {precioM2 > 0 ? formatMoneda(precioM2) : '—'}
        </span>
      </td>

      {/* Precio Calculado */}
      <td className="px-3 py-2 text-right">
        <span className={`text-sm font-bold ${precioTotal > 0 ? 'text-green-700' : 'text-gray-300'}`}>
          {precioTotal > 0 ? formatMoneda(precioTotal) : '—'}
        </span>
      </td>

      {/* Notas */}
      <td className="px-2 py-1.5">
        <input
          data-campo="notas"
          type="text"
          placeholder="Nota breve..."
          value={fila.notas_diseno}
          onChange={(e) => onChange(fila.id, 'notas_diseno', e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
            }
          }}
          className="input-celda text-xs"
        />
      </td>

      {/* Acciones */}
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onDuplicar(fila.id)}
            className="p-1 text-gray-400 hover:text-primary-600 rounded transition-colors"
            title="Duplicar fila"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onEliminar(fila.id)}
            className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
            title="Eliminar fila"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  )
}