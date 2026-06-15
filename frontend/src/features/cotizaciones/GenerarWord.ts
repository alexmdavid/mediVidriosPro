// =============================================================
// Generación de Word (DOC) de cotización con formato exacto
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
  const formatter = new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  let result = formatter.format(valor);
  if (valor >= 1000000) result = result.replace('.', "'");
  return '$' + result;
}

export function generarCotizacionWord(respuesta: CotizacionResponse): void {
  const { cotizacion } = respuesta;
  const fecha = new Date(cotizacion.fecha_creacion).toLocaleDateString('es-CO', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  const items = cotizacion.items || [];
  const htmlItems = items.map((item, index) => {
    const detalle = item.notas_diseno 
      ? item.notas_diseno.split('\n').filter(l => l.trim()).map(l => `• ${l.trim()}`).join('<br>')
      : `• ${item.tipo_item.toUpperCase()}${item.tipo_vidrio ? ` ${item.tipo_vidrio.nombre.toUpperCase()}` : ''}`;

    const medidas = (item.ancho_mt && item.alto_mt) ? `<br>MEDIDAS: ${(item.ancho_mt * 100).toFixed(0)}X${(item.alto_mt * 100).toFixed(0)}` : '';
    const metrajeCubicado = (item.area_total_m2 > 0) ? `<br>Total metraje cubicados: ${item.area_total_m2.toFixed(2)}` : '';
      
    return `
      <tr>
        <td style="border: 1px solid black; text-align: center; padding: 5px;">${index + 1}</td>
        <td style="border: 1px solid black; padding: 5px;">
          ${detalle}${medidas}${metrajeCubicado}
        </td>
        <td style="border: 1px solid black; text-align: center; padding: 5px;">${item.area_total_m2.toFixed(2)}</td>
        <td style="border: 1px solid black; text-align: center; padding: 5px;">${formatMoneda(item.precio_calculado)}</td>
      </tr>
    `;
  }).join('');

  const content = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>Cotizacion</title>
    <style> /* Estilos para Word */
      body { font-family: 'Times New Roman', Times, serif; margin: 1in; text-align: left; }
      .header { font-weight: bold; font-size: 12pt; margin-bottom: 2px; }
      .info { font-size: 10pt; margin-bottom: 2px; }
      .date-city { font-size: 11pt; margin-top: 10px; margin-bottom: 10px; }
      .recipient { font-size: 11pt; margin-top: 10px; margin-bottom: 10px; }
      .recipient-name { font-weight: bold; font-size: 11pt; }
      .title { font-weight: bold; font-size: 16pt; text-align: center; margin: 20px 0; }
      table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 9pt; }
      table th, table td { border: 1px solid black; padding: 5px; vertical-align: top; }
      table th { text-align: center; font-weight: bold; }
      .conditions { font-size: 10pt; margin-top: 20px; }
      .signature { margin-top: 40px; }
      .signature-line { border-bottom: 1px solid black; width: 200px; margin: 0 auto; }
      .signature-name { font-weight: bold; font-size: 11pt; margin-top: 5px; }
      .signature-cc { font-size: 10pt; }
    </style>
    </head>
    <body>
      <!-- BLOQUE DE ENCABEZADO (Alineado a la Izquierda) -->
      <div class="header">${EMPRESA.nombre}</div>
      <div class="info">RUT: ${EMPRESA.rut}</div>
      <div class="info">Correo: ${EMPRESA.correo} – Celular: ${EMPRESA.celular}</div>
      <div class="info">${EMPRESA.direccion}</div>
      <div class="date-city">Duitama, ${fecha}</div>
      
      <!-- BLOQUE DE DESTINATARIO (Alineado a la Izquierda) -->
      <div class="recipient">
        <p>Señor</p>
        <p class="recipient-name">${(cotizacion.cliente?.nombre || 'Cliente').toUpperCase()}</p>
        <p>Ciudad</p>
      </div>

      <!-- TÍTULO PRINCIPAL (ESTRICTAMENTE CENTRADO) -->
      <div class="title">COTIZACION</div>
      
      <table>
        <thead>
          <tr style="font-weight: bold;">
            <th>ITEMS</th>
            <th>DETALLE</th>
            <th>AREA EN M²</th>
            <th>VALOR TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${htmlItems}
        </tbody>
      </table>

      <!-- BLOQUE INFERIOR DE CONDICIONES (Alineado a la Izquierda) -->
      <div class="conditions">
        <p><b>CONDICIONES ECONÓMICAS:</b> 60% de anticipo al aceptar esta cotización y 40% contra entrega.</p>
        <p><b>NO INCLUYE:</b> obras de albañilería.</p>
        <p><b>TIEMPO DE ENTREGA:</b> A acordar con el cliente.</p>
        <p><b>VALIDEZ OFERTA:</b> 10 días calendario.</p>
      </div>

      <div class="signature">
        <p>Cordialmente,</p>
        <br>
        <div class="signature-line"></div>
        <p class="signature-name"><b>${EMPRESA.nombre}</b></p>
        <p class="signature-cc">CC. ${EMPRESA.rut}</p>
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