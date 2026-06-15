// =============================================================
// Generación de PDF de cotización - FORMATO EXACTO SR.
// Fuente: Helvetica (Arial)
// Formato moneda colombiana: $28'490.000 o $570.000
// =============================================================

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { CotizacionResponse } from './types'

// =============================================================
// Datos de la empresa (fijos, idéntico al formato de referencia)
// =============================================================

const EMPRESA = {
  nombre: 'RUBIEL ANTONIO RUIDIAZ COMAS',
  rut: '85165741',
  correo: 'rubanruic@gmail.com',
  celular: '3103233594',
  direccion: 'CALLE 20 # 28 – 21 DUITAMA',
}

// =============================================================
// Formato moneda colombiano EXACTO
// $28'490.000 (millones con apóstrofe)
// $570.000 (cientos de miles con punto)
// =============================================================

function formatMoneda(valor: number): string {
  if (valor === 0) return '$0'
  const entero = Math.round(valor)
  const s = entero.toString()
  
  // Si es >= 1,000,000: $28'490.000
  if (entero >= 1000000) {
    const millones = Math.floor(entero / 1000000)
    const resto = entero % 1000000
    if (resto === 0) {
      return `$${millones}'000.000`
    }
    return `$${millones}'${resto.toString().padStart(6, '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
  }
  
  // Si es >= 1000: $570.000
  return '$' + s.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

// =============================================================
// Función principal
// =============================================================

export function generarCotizacionPDF(respuesta: CotizacionResponse): void {
  const { cotizacion, resumen } = respuesta
  const doc = new jsPDF()

  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20
  const font = 'helvetica'

  let y = margin

  // =============================================================
  // ENCABEZADO - TEXTO PLANO ALINEDO A LA IZQUIERDA
  // Línea 1: NEGRITA TAMAÑO DESTACADO
  // =============================================================

  doc.setFont(font, 'bold')
  doc.setFontSize(12)
  doc.text(EMPRESA.nombre, margin, y)
  y += 6

  doc.setFont(font, 'normal')
  doc.setFontSize(10)
  doc.text(`RUT: ${EMPRESA.rut}`, margin, y)
  y += 5
  doc.text(`Correo: ${EMPRESA.correo} \u2013 Celular: ${EMPRESA.celular}`, margin, y)
  y += 5
  doc.text(EMPRESA.direccion, margin, y)
  y += 10

  // =============================================================
  // FECHA: "Duitama, 20 de marzo de 2026"
  // =============================================================

  const fecha = new Date(cotizacion.fecha_creacion)
  const opcionesFecha: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }
  const fechaFormateada = `Duitama, ${fecha.toLocaleDateString('es-CO', opcionesFecha)}`

  doc.setFont(font, 'normal')
  doc.setFontSize(11)
  doc.text(fechaFormateada, margin, y)
  y += 12

  // =============================================================
  // DATOS DEL CLIENTE (idéntico al formato)
  // =============================================================

  doc.setFont(font, 'normal')
  doc.setFontSize(11)
  doc.text('Se\u00f1or', margin, y)
  y += 6

  doc.setFont(font, 'bold')
  doc.setFontSize(11)
  doc.text((cotizacion.cliente?.nombre || 'Cliente').toUpperCase(), margin, y)
  y += 6

  doc.setFont(font, 'normal')
  doc.setFontSize(11)
  doc.text('Ciudad', margin, y)
  y += 12

  // =============================================================
  // TÍTULO: COTIZACION (centrado, negrita, espaciado)
  // =============================================================

  doc.setFont(font, 'bold')
  doc.setFontSize(16)
  doc.text('COTIZACION', pageWidth / 2, y, { align: 'center' })
  y += 12

  // =============================================================
  // TABLA DE ITEMS - ESTRUCTURA EXACTA
  // Columnas: ITEMS | DETALLE | AREA EN M² | VALOR TOTAL
  // Para servicios: Área muestra "VALOR METRO" y el precio/m en la celda
  // Para productos: Área muestra el metraje
  // =============================================================

  const items = cotizacion.items || []

  const tableData: (string[] | { content: string; colSpan?: number; rowSpan?: number })[] = items.map((item, index) => {
    let detalle = ''

    // Construir detalle con el formato exacto del PDF de referencia
    if (item.notas_diseno) {
      // Usar notas de diseño como descripción con viñetas
      const lineas = item.notas_diseno.split('\n').filter((l) => l.trim())
      detalle = lineas.map((l) => `\u2022 ${l.trim()}`).join('\n')
    } else {
      // Formato producto: "REPOSICION VIDRIO BRONCE REFLECTIVO 5 MM. PARA CONSULTORIO"
      detalle = `\u2022 ${item.tipo_item.toUpperCase()}`
      if (item.tipo_vidrio) {
        detalle += ` ${item.tipo_vidrio.nombre.toUpperCase()}`
      }
    }

    // Agregar dimensiones: "MEDIDAS: 150X150"
    if (item.ancho_mt && item.alto_mt) {
      const anchoCm = (item.ancho_mt * 100).toFixed(0)
      const altoCm = (item.alto_mt * 100).toFixed(0)
      detalle += `\nMEDIDAS: ${anchoCm}X${altoCm}`
    }

    // Para ítems con área (productos): mostrar metraje
    // Para servicios: mostrar "Total metraje cubicados: valor"
    if (item.area_total_m2 > 0) {
        detalle += `\nTotal metraje cubicados: ${item.area_total_m2.toFixed(0)}`
    }

    // Determinar si es un servicio (no tiene vidrio claro o tiene notas de diseño largas)
    const esServicio = item.tipo_item.toLowerCase().includes('lavada') || 
                       item.tipo_item.toLowerCase().includes('limpieza') ||
                       item.tipo_item.toLowerCase().includes('retirada') ||
                       item.tipo_item.toLowerCase().includes('pintura') ||
                       (item.notas_diseno && item.notas_diseno.length > 50)

    // El área: si es servicio mostramos VALOR METRO + precio unitario
    let areaStr = ''
    if (esServicio) {
      areaStr = `VALOR METRO\n$${formatMoneda(item.precio_unitario_m2)}`
    } else {
      areaStr = item.area_total_m2.toFixed(0)
    }

    return [
      (index + 1).toString(),
      detalle,
      areaStr,
      formatMoneda(item.precio_calculado),
    ]
  })

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['ITEMS', 'DETALLE', 'AREA EN M2', 'VALOR TOTAL']],
    body: tableData as string[][],
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 4,
      font: font,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      textColor: [0, 0, 0],
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center',
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 14 },
      1: { cellWidth: 'auto' },
      2: { halign: 'center', cellWidth: 35 },
      3: { halign: 'right', cellWidth: 35 },
    },
    didParseCell: function (data) {
      if (data.section === 'head') {
        data.cell.styles.fillColor = [255, 255, 255]
      }
    },
  })

  // Actualizar Y después de la tabla
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12

  // =============================================================
  // BLOQUE INFERIOR DE CONDICIONES (idéntico en texto y espaciado)
  // =============================================================

  doc.setFont(font, 'bold')
  doc.setFontSize(10)
  doc.text('CONDICIONES ECON\u00d3MICAS: 60% de anticipo al aceptar esta cotizaci\u00f3n y 40% contra entrega.', margin, y)
  y += 7

  doc.setFont(font, 'bold')
  doc.text('NO INCLUYE: obras de alba\u00f1iler\u00eda.', margin, y)
  y += 7

  doc.setFont(font, 'bold')
  doc.text('TIEMPO DE ENTREGA: A acordar con el cliente.', margin, y)
  y += 7

  doc.setFont(font, 'bold')
  doc.text('VALIDEZ OFERTA: 10 d\u00edas calendario.', margin, y)
  y += 14

  // =============================================================
  // FIRMA
  // =============================================================

  doc.setFont(font, 'normal')
  doc.setFontSize(11)
  doc.text('Cordialmente,', margin, y)
  y += 20

  // Línea de firma
  doc.setDrawColor(0)
  doc.setLineWidth(0.3)
  doc.line(margin, y, margin + 70, y)
  y += 6

  doc.setFont(font, 'bold')
  doc.setFontSize(11)
  doc.text(EMPRESA.nombre, margin, y)
  y += 5

  doc.setFont(font, 'normal')
  doc.setFontSize(10)
  doc.text(`CC. ${EMPRESA.rut}`, margin, y)

  // =============================================================
  // Guardar el PDF
  // =============================================================

  const nombreArchivo = `Cotizacion_${cotizacion.id}_${cotizacion.cliente?.nombre || 'Cliente'}.pdf`
  doc.save(nombreArchivo)
}