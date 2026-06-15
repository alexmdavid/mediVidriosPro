// =============================================================
// Generación de PDF de cotización con formato exacto
// =============================================================

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { CotizacionResponse } from './types'

// =============================================================
// Datos de la empresa (fijos)
// =============================================================

const EMPRESA = {
  nombre: 'RUBIEL ANTONIO RUIDIAZ COMAS',
  rut: '85165741',
  correo: 'rubanruic@gmail.com',
  celular: '3103233594',
  direccion: 'CALLE 20 # 28 – 21 DUITAMA',
}

// =============================================================
// Función para formatear moneda colombiana (sin símbolo $)
// =============================================================

function formatMoneda(valor: number): string {
  const entero = Math.floor(valor)
  const decimal = Math.round((valor - entero) * 100) % 100

  // Separar miles con puntos
  const strEntero = entero.toString()
  let resultado = ''
  for (let i = 0; i < strEntero.length; i++) {
    if (i > 0 && (strEntero.length - i) % 3 === 0) {
      resultado += '.'
    }
    resultado += strEntero[i]
  }

  return `$${resultado}'${decimal.toString().padStart(2, '0')}.000`
}

// =============================================================
// Formatear área
// =============================================================

function formatArea(area: number): string {
  return area.toFixed(2)
}

// =============================================================
// Función principal para generar el PDF
// =============================================================

export function generarCotizacionPDF(respuesta: CotizacionResponse): void {
  const { cotizacion, resumen } = respuesta
  const doc = new jsPDF()

  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20
  const contentWidth = pageWidth - margin * 2

  let y = margin

  // =============================================================
  // ENCABEZADO - Datos de la empresa
  // =============================================================

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(EMPRESA.nombre, margin, y)
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`RUT: ${EMPRESA.rut}`, margin, y)
  y += 4.5
  doc.text(`Correo: ${EMPRESA.correo} – Celular: ${EMPRESA.celular}`, margin, y)
  y += 4.5
  doc.text(EMPRESA.direccion, margin, y)
  y += 4.5
  y += 4

  // =============================================================
  // FECHA Y CIUDAD
  // =============================================================

  const fecha = new Date(cotizacion.fecha_creacion)
  const opcionesFecha: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }
  const fechaFormateada = `Duitama, ${fecha.toLocaleDateString('es-CO', opcionesFecha)}`

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(fechaFormateada, margin, y)
  y += 10

  // =============================================================
  // DATOS DEL CLIENTE
  // =============================================================

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Señor', margin, y)
  y += 5

  doc.setFont('helvetica', 'bold')
  doc.text(cotizacion.cliente?.nombre || 'Cliente', margin, y)
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.text('Ciudad', margin, y)
  y += 10

  // =============================================================
  // TÍTULO: COTIZACIÓN
  // =============================================================

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('COTIZACION', pageWidth / 2, y, { align: 'center' })
  y += 10

  // =============================================================
  // TABLA DE ITEMS
  // =============================================================

  const items = cotizacion.items || []

  const tableData = items.map((item, index) => {
    // Construir descripción detallada
    let detalle = item.tipo_item.toUpperCase()

    if (item.tipo_vidrio) {
      detalle += ` - ${item.tipo_vidrio.nombre.toUpperCase()}`
    }

    if (item.ancho_mt && item.alto_mt) {
      detalle += `\nMEDIDAS: ${(item.ancho_mt * 100).toFixed(0)}X${(item.alto_mt * 100).toFixed(0)}`
    }

    if (item.notas_diseno) {
      detalle += `\n${item.notas_diseno}`
    }

    // Valor metro cuadrado
    const valorMetro = item.precio_unitario_m2
      ? `$${Math.round(item.precio_unitario_m2).toLocaleString('es-CO')}`
      : ''

    return [
      (index + 1).toString(),
      detalle,
      formatArea(item.area_total_m2),
      formatMoneda(item.precio_calculado),
    ]
  })

  // Agregar fila de total
  tableData.push([
    '',
    'TOTAL',
    formatArea(resumen.area_total_m2),
    formatMoneda(resumen.total_con_margen),
  ])

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['ITEM', 'DETALLE', 'AREA EN M2', 'VALOR TOTAL']],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 3,
      font: 'helvetica',
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 15 },
      1: { cellWidth: 95 },
      2: { halign: 'center', cellWidth: 30 },
      3: { halign: 'right', cellWidth: 30 },
    },
    didParseCell: function (data) {
      // Estilo para la fila de total
      if (data.row.index === tableData.length - 1) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [245, 245, 245]
      }
    },
  })

  // Actualizar Y después de la tabla
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

  // =============================================================
  // CONDICIONES ECONÓMICAS
  // =============================================================

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('CONDICIONES ECONÓMICAS:', margin, y)
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('60% de anticipo al aceptar esta cotización y 40% contra entrega.', margin, y)
  y += 6

  doc.setFont('helvetica', 'bold')
  doc.text('NO INCLUYE:', margin, y)
  doc.setFont('helvetica', 'normal')
  const noIncluyeX = margin + doc.getTextWidth('NO INCLUYE: ')
  doc.text('obras de albañilería.', noIncluyeX, y)
  y += 6

  doc.setFont('helvetica', 'bold')
  doc.text('TIEMPO DE ENTREGA:', margin, y)
  doc.setFont('helvetica', 'normal')
  const tiempoX = margin + doc.getTextWidth('TIEMPO DE ENTREGA: ')
  doc.text('A acordar con el cliente.', tiempoX, y)
  y += 6

  doc.setFont('helvetica', 'bold')
  doc.text('VALIDEZ OFERTA:', margin, y)
  doc.setFont('helvetica', 'normal')
  const validezX = margin + doc.getTextWidth('VALIDEZ OFERTA: ')
  doc.text('10 días calendario.', validezX, y)
  y += 12

  // =============================================================
  // FIRMA
  // =============================================================

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Cordialmente,', margin, y)
  y += 20

  // Línea de firma
  doc.setDrawColor(0)
  doc.setLineWidth(0.3)
  doc.line(margin, y, margin + 60, y)
  y += 5

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(EMPRESA.nombre, margin, y)
  y += 4.5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`CC. ${EMPRESA.rut}`, margin, y)

  // =============================================================
  // Guardar el PDF
  // =============================================================

  const nombreArchivo = `Cotizacion_${cotizacion.id}_${cotizacion.cliente?.nombre || 'Cliente'
    }.pdf`
  doc.save(nombreArchivo)
}