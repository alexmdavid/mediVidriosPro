// =============================================================
// Generación de Word (.doc) de cotización
// FORMATO EXACTO: idéntico al PDF y al formato de referencia
// =============================================================

import type { CotizacionResponse } from './types'

const EMPRESA = {
  nombre: 'RUBIEL ANTONIO RUIDIAZ COMAS',
  rut: '85165741',
  correo: 'rubanruic@gmail.com',
  celular: '3103233594',
  direccion: 'CALLE 20 # 28 – 21 DUITAMA',
}

function formatMoneda(valor: number): string {
  if (valor === 0) return '$0'
  const entero = Math.round(valor)
  const s = entero.toString()
  if (entero >= 1000000) {
    const millones = Math.floor(entero / 1000000)
    const resto = entero % 1000000
    if (resto === 0) return `$${millones}'000.000`
    return `$${millones}'${resto.toString().padStart(6, '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
  }
  return '$' + s.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export function generarCotizacionWord(respuesta: CotizacionResponse): void {
  const { cotizacion } = respuesta;
  const fecha = new Date(cotizacion.fecha_creacion).toLocaleDateString('es-CO', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  const items = cotizacion.items || [];
  const htmlItems = items.map((item, index) => {
    let detalle = ''
    if (item.notas_diseno) {
      const lineas = item.notas_diseno.split('\n').filter(l => l.trim())
      detalle = lineas.map(l => `• ${l.trim()}`).join('<br>')
    } else {
      detalle = `• ${item.tipo_item.toUpperCase()}`
      if (item.tipo_vidrio) detalle += ` ${item.tipo_vidrio.nombre.toUpperCase()}`
    }

    if (item.ancho_mt && item.alto_mt) {
      const anchoCm = (item.ancho_mt * 100).toFixed(0)
      const altoCm = (item.alto_mt * 100).toFixed(0)
      detalle += `<br>MEDIDAS: ${anchoCm}X${altoCm}`
    }

    if (item.area_total_m2 > 0) {
      detalle += `<br>Total metraje cubicados: ${item.area_total_m2.toFixed(0)}`
    }

    // Determinar área: para servicios "VALOR METRO" + precio unitario
    const esServicio = item.tipo_item.toLowerCase().includes('lavada') || 
                       item.tipo_item.toLowerCase().includes('limpieza') ||
                       item.tipo_item.toLowerCase().includes('retirada') ||
                       item.tipo_item.toLowerCase().includes('pintura') ||
                       (item.notas_diseno && item.notas_diseno.length > 50)

    let areaStr = ''
    if (esServicio) {
      areaStr = `VALOR METRO<br>${formatMoneda(item.precio_unitario_m2)}`
    } else {
      areaStr = item.area_total_m2.toFixed(0)
    }

    return `
      <tr>
        <td style="border: 1px solid black; text-align: center; padding: 5px; vertical-align: top; width: 30px;">${index + 1}</td>
        <td style="border: 1px solid black; padding: 5px; vertical-align: top;">
          ${detalle}
        </td>
        <td style="border: 1px solid black; text-align: center; padding: 5px; vertical-align: top; width: 90px;">${areaStr}</td>
        <td style="border: 1px solid black; text-align: right; padding: 5px; vertical-align: top; width: 90px;">${formatMoneda(item.precio_calculado)}</td>
      </tr>
    `;
  }).join('');

  const content = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>Cotizacion</title>
    <style>
      body { font-family: Arial, Helvetica, sans-serif; margin: 20mm; }
      .empresa-line1 { font-weight: bold; font-size: 10pt; margin-bottom: 2px; }
      .info-line { font-size: 10pt; margin-bottom: 2px; }
      .date-line { font-size: 11pt; margin-top: 10px; margin-bottom: 10px; }
      .cliente-line { font-size: 11pt; }
      .cliente-nombre { font-weight: bold; font-size: 11pt; }
      .title { font-weight: bold; font-size: 14pt; text-align: center; margin: 15px 0; }
      table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 10pt; }
      table th, table td { border: 1px solid black; padding: 5px; vertical-align: top; }
      table th { text-align: center; font-weight: bold; }
      .conditions { font-size: 10pt; }
      .conditions p { margin: 4px 0; }
      .firma { margin-top: 30px; }
    </style>
    </head>
    <body>
      <!-- ENCABEZADO (TEXTO PLANO ALINEADO A LA IZQUIERDA, 10pt) -->
      <div class="empresa-line1">${EMPRESA.nombre}</div>
      <div class="info-line">RUT: ${EMPRESA.rut}</div>
      <div class="info-line">Correo: ${EMPRESA.correo} – Celular: ${EMPRESA.celular}</div>
      <div class="info-line">${EMPRESA.direccion}</div>
      
      <!-- FECHA: Duitama, 20 de marzo de 2026 (11pt) -->
      <div class="date-line">Duitama, ${fecha}</div>
      
      <!-- DATOS DEL CLIENTE (11pt) -->
      <div class="cliente-line">Señor</div>
      <div class="cliente-nombre">${(cotizacion.cliente?.nombre || 'Cliente').toUpperCase()}</div>
      <div class="cliente-line">Ciudad</div>

      <!-- TÍTULO CENTRADO (14pt, negrita, ESTRICTAMENTE ANTES DE LA TABLA) -->
      <div class="title">COTIZACION</div>
      
      <!-- TABLA (10pt) -->
      <table>
        <thead>
          <tr>
            <th style="width: 30px;">ITEMS</th>
            <th>DETALLE</th>
            <th style="width: 90px;">AREA EN M2</th>
            <th style="width: 90px;">VALOR TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${htmlItems}
        </tbody>
      </table>

      <!-- BLOQUE INFERIOR DE CONDICIONES (10pt, negrita) -->
      <div class="conditions">
        <p><b>CONDICIONES ECONÓMICAS:</b> 60% de anticipo al aceptar esta cotización y 40% contra entrega.</p>
        <p><b>NO INCLUYE:</b> obras de albañilería.</p>
        <p><b>TIEMPO DE ENTREGA:</b> A acordar con el cliente.</p>
        <p><b>VALIDEZ OFERTA:</b> 10 días calendario.</p>
      </div>

      <!-- FIRMA -->
      <div class="firma">
        <p>Cordialmente,</p>
        <br>
        <hr style="width: 200px; text-align: left; margin-left: 0;">
        <p style="font-weight: bold; font-size: 11pt;">${EMPRESA.nombre}</p>
        <p style="font-size: 10pt;">CC. ${EMPRESA.rut}</p>
      </div>
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff', content], {
    type: 'application/msword'
  });
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Cotizacion_${cotizacion.id}.doc`;
  link.click();
  URL.revokeObjectURL(url);
}