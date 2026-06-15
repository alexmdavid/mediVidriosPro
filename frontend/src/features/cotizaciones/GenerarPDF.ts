// =============================================================
// Generación de PDF de cotización con formato exacto
// Fuente: Times New Roman (serif)
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
// Función para formatear moneda colombiana
// Formato: $28'490.000 (apostófaro separador de miles)
// =============================================================

function formatMoneda(valor: number): string {
  const formatter = new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  let result = formatter.format(valor);
  // Notación colombiana: reemplaza el primer punto por apóstrofe si es millón
  if (valor >= 1000000) {
    result = result.replace('.', "'");
  }
  return '$' + result;
}

// =============================================================
// Función principal para generar el PDF
// =============================================================

export function generarCotizacionPDF(respuesta: CotizacionResponse): void {
  const { cotizacion, resumen } = respuesta
  const doc = new jsPDF()

  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20
  const font = 'times' // Times New Roman

  let y = margin

  // =============================================================
  // ENCABEZADO - Datos de la empresa (bold, 12pt)
  // =============================================================

  doc.setFont(font, 'bold')
  doc.setFontSize(12)
  doc.text(EMPRESA.nombre, margin, y)
  y += 6

  doc.setFont(font, 'normal')
  doc.setFontSize(10)
  doc.text(`RUT: ${EMPRESA.rut}`, margin, y)
  y += 5
  doc.text(`Correo: ${EMPRESA.correo} – Celular: ${EMPRESA.celular}`, margin, y)
  y += 5
  doc.text(EMPRESA.direccion, margin, y)
  y += 10

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

  doc.setFont(font, 'normal')
  doc.setFontSize(11)
  doc.text(fechaFormateada, margin, y)
  y += 12

  // =============================================================
  // DATOS DEL CLIENTE
  // =============================================================

  doc.setFont(font, 'normal')
  doc.setFontSize(11)
  doc.text('Señor', margin, y)
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
  // TÍTULO: COTIZACIÓN (centrado, bold, 16pt)
  // =============================================================

  doc.setFont(font, 'bold')
  doc.setFontSize(16)
  doc.text('COTIZACION', pageWidth / 2, y, { align: 'center' })
  y += 12

  // =============================================================
  // TABLA DE ITEMS
  // =============================================================

  const items = cotizacion.items || []

  const tableData: string[][] = items.map((item, index) => {
    // Construir descripción con formato de viñetas
    let detalle = ''

    if (item.notas_diseno) {
      // Si hay notas de diseño, usarlas como descripción principal con viñetas
      const lineas = item.notas_diseno.split('\n').filter((l) => l.trim())
      detalle = lineas.map((l) => `• ${l.trim()}`).join('\n')
    } else {
      // Descripción por defecto: tipo de vidrio
      detalle = `• ${item.tipo_item.toUpperCase()}`
      if (item.tipo_vidrio) {
        detalle += ` ${item.tipo_vidrio.nombre.toUpperCase()}`
      }
    }

    // Agregar dimensiones si es vidrio
    if (item.ancho_mt && item.alto_mt) {
      const anchoCm = (item.ancho_mt * 100).toFixed(0)
      const altoCm = (item.alto_mt * 100).toFixed(0)
      detalle += `\nMEDIDAS: ${anchoCm}X${altoCm}`
    }

    if (item.area_total_m2 > 0) {
        detalle += `\nTotal metraje cubicados: ${item.area_total_m2}`
    }

    // Valor metro
    const valorMetro = item.precio_unitario_m2
      ? formatMoneda(item.precio_unitario_m2)
      : ''

    return [
      (index + 1).toString(),
      detalle,
      formatArea(item.area_total_m2),
      formatMoneda(item.precio_calculado),
    ]
  })

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['ITEMS', 'DETALLE', 'AREA EN M²', 'VALOR TOTAL']],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 4,
      font: font,
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
      textColor: [0, 0, 0],
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center',
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 15 }, // ITEMS
      1: { cellWidth: 90 }, // DETALLE
      2: { halign: 'center', cellWidth: 35 }, // AREA EN M²
      3: { halign: 'right', cellWidth: 35 }, // VALOR TOTAL
    },
    didParseCell: function (data) {
      // Encabezado: fondo blanco
      if (data.section === 'head') {
        data.cell.styles.fillColor = [255, 255, 255]
      }
    },
  })

  // Actualizar Y después de la tabla
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12

  // =============================================================
  // CONDICIONES ECONÓMICAS
  // =============================================================

  doc.setFont(font, 'bold')
  doc.setFontSize(10)
  doc.text('CONDICIONES ECONÓMICAS:', margin, y)
  y += 6

  doc.setFont(font, 'normal')
  doc.setFontSize(10)
  doc.text('60% de anticipo al aceptar esta cotización y 40% contra entrega.', margin, y)
  y += 7

  doc.setFont(font, 'bold')
  doc.text('NO INCLUYE: obras de albañilería.', margin, y)
  y += 7

  doc.setFont(font, 'bold')
  doc.text('TIEMPO DE ENTREGA: A acordar con el cliente.', margin, y)
  y += 7

  doc.setFont(font, 'bold')
  doc.text('VALIDEZ OFERTA: 10 días calendario.', margin, y)
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

// =============================================================
// Utilidad para formatear área
// =============================================================

function formatArea(area: number): string {
  return area.toFixed(2)
}