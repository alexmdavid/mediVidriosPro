// =============================================================
// Componente de detalle de cotización existente
// Permite ver los detalles y descargar el PDF
// =============================================================

import { useState, useEffect } from 'react'
import type { CotizacionResponse } from './types'
import { formatMoneda } from './types'
import { obtenerCotizacion } from '../../api/cotizaciones'
import { generarCotizacionPDF } from './GenerarPDF'
import { generarCotizacionWord } from './GenerarWord'

interface Props {
  cotizacionId: number
  onVolver: () => void
}

export default function CotizacionDetalle({ cotizacionId, onVolver }: Props) {
  const [data, setData] = useState<CotizacionResponse | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [menuAbierto, setMenuAbierto] = useState(false)

  useEffect(() => {
    setCargando(true)
    setError(null)
    obtenerCotizacion(cotizacionId)
      .then(setData)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Error al cargar cotización')
      })
      .finally(() => setCargando(false))
  }, [cotizacionId])

  if (cargando) {
    return (
      <div className="card p-8 text-center">
        <svg className="animate-spin h-8 w-8 text-primary-600 mx-auto" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <p className="text-gray-500 mt-3">Cargando cotización...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="card p-6 bg-red-50 border-red-200">
        <p className="text-red-700">{error || 'Cotización no encontrada'}</p>
        <button onClick={onVolver} className="mt-3 btn-secondary">
          Volver a la lista
        </button>
      </div>
    )
  }

  const { cotizacion, resumen } = data

  const ESTADO_COLORS: Record<string, string> = {
    borrador: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    enviada: 'bg-blue-100 text-blue-800 border-blue-300',
    aprobada: 'bg-green-100 text-green-800 border-green-300',
    rechazada: 'bg-red-100 text-red-800 border-red-300',
    facturada: 'bg-purple-100 text-purple-800 border-purple-300',
  }

  return (
    <div className="space-y-6">
      {/* Header con acciones */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onVolver}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="Volver a la lista"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Cotización #{cotizacion.id}
            </h2>
            <p className="text-sm text-gray-500">
              {new Date(cotizacion.fecha_creacion).toLocaleDateString('es-CO', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
        </div>
        
        <div className="relative">
          <button
            onClick={() => setMenuAbierto(!menuAbierto)}
            className="btn-primary flex items-center gap-2 bg-gray-800 hover:bg-black"
          >
            Gestionar Cotización
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 9l-7 7-7-7" /></svg>
          </button>
          
          {menuAbierto && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
              <button className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                Editar Cotización
              </button>
              <button className="w-full text-left px-4 py-2.5 hover:bg-red-50 text-sm text-red-600 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Eliminar
              </button>
              <div className="border-t border-gray-100 my-1"></div>
              <button 
                onClick={() => { generarCotizacionPDF(data); setMenuAbierto(false); }}
                className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm flex items-center gap-2"
              >
                Descargar como PDF
              </button>
              <button 
                onClick={() => { generarCotizacionWord(data); setMenuAbierto(false); }}
                className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm flex items-center gap-2"
              >
                Descargar como Word
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Info del cliente y estado */}
      <div className="card p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Cliente</h3>
            <p className="text-lg font-bold text-gray-900">{cotizacion.cliente?.nombre || 'Sin cliente'}</p>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Obra / Descripción</h3>
            <p className="text-gray-700">{cotizacion.descripcion_obra}</p>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Estado</h3>
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${ESTADO_COLORS[cotizacion.estado] || 'bg-gray-100 text-gray-800 border-gray-300'}`}>
              {cotizacion.estado.charAt(0).toUpperCase() + cotizacion.estado.slice(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Resumen */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Resumen</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500">Total Items</p>
            <p className="text-lg font-bold text-gray-900">{resumen.cantidad_total_items}</p>
          </div>
          <div className="bg-primary-50 rounded-lg p-3 text-center">
            <p className="text-xs text-primary-600">Área Total (m²)</p>
            <p className="text-lg font-bold text-primary-700">{resumen.area_total_m2.toFixed(4)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500">Margen</p>
            <p className="text-lg font-bold text-gray-900">{resumen.porcentaje_margen}%</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
            <p className="text-xs text-green-600">TOTAL</p>
            <p className="text-xl font-bold text-green-700">{resumen.total_formateado}</p>
          </div>
        </div>
      </div>

      {/* Tabla de items */}
      {cotizacion.items && cotizacion.items.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Detalle de Medidas
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Vidrio</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Medidas</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Cant.</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Área (m²)</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">$/m²</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total</th>
                  {cotizacion.items.some((i) => i.notas_diseno) && (
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Notas</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cotizacion.items.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{item.tipo_item}</td>
                    <td className="px-4 py-3 text-gray-600">{item.tipo_vidrio?.nombre || `ID ${item.tipo_vidrio_id}`}</td>
                    <td className="px-4 py-3 text-center text-gray-600">
                      {item.ancho_mt}m × {item.alto_mt}m
                    </td>
                    <td className="px-4 py-3 text-center">{item.cantidad}</td>
                    <td className="px-4 py-3 text-right text-primary-700 font-medium">
                      {item.area_total_m2.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {formatMoneda(item.precio_unitario_m2)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-green-700">
                      {formatMoneda(item.precio_calculado)}
                    </td>
                    {cotizacion.items?.some((i) => i.notas_diseno) && (
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {item.notas_diseno || '-'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-right font-bold text-gray-700">TOTAL:</td>
                  <td className="px-4 py-3 text-right font-bold text-primary-700">{resumen.area_total_m2.toFixed(4)}</td>
                  <td></td>
                  <td className="px-4 py-3 text-right font-bold text-green-700">{resumen.total_formateado}</td>
                  {cotizacion.items?.some((i) => i.notas_diseno) && <td></td>}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}