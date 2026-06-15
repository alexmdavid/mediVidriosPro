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
      ? item.notas_diseno.split('\n').map(l => `• ${l}`).join('<br>')
      : `• ${item.tipo_item.toUpperCase()}`;
      
    return `
      <tr>
        <td style="border: 1px solid black; text-align: center; padding: 5px;">${index + 1}</td>
        <td style="border: 1px solid black; padding: 5px;">
          ${detalle}<br>
          MEDIDAS: ${(item.ancho_mt * 100).toFixed(0)}X${(item.alto_mt * 100).toFixed(0)}<br>
          Total metraje cubicados: ${item.area_total_m2}
        </td>
        <td style="border: 1px solid black; text-align: center; padding: 5px;">${item.area_total_m2.toFixed(2)}</td>
        <td style="border: 1px solid black; text-align: center; padding: 5px;">${formatMoneda(item.precio_unitario_m2)}</td>
        <td style="border: 1px solid black; text-align: center; padding: 5px;">${formatMoneda(item.precio_calculado)}</td>
      </tr>
    `;
  }).join('');

  const content = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>Cotizacion</title>
    <style>
      body { font-family: 'Times New Roman', Times, serif; text-align: center; }
      .header { font-weight: bold; font-size: 14pt; margin-bottom: 2px; }
      .info { font-size: 10pt; margin-bottom: 2px; }
      table { width: 100%; border-collapse: collapse; margin: 20px 0; }
      .conditions { font-size: 10pt; margin-top: 20px; }
      .signature { margin-top: 40px; }
    </style>
    </head>
    <body>
      <div class="header">${EMPRESA.nombre}</div>
      <div class="info">RUT: ${EMPRESA.rut}</div>
      <div class="info">Correo: ${EMPRESA.correo} – Celular: ${EMPRESA.celular}</div>
      <div class="info">${EMPRESA.direccion}</div>
      <br>
      <div class="info">Duitama, ${fecha}</div>
      <br>
      <div>Señor</div>
      <div style="font-weight: bold;">${cotizacion.cliente?.nombre || 'Cliente'}</div>
      <div>Ciudad</div>
      <br>
      <div style="font-weight: bold; font-size: 16pt;">COTIZACION</div>
      
      <table>
        <thead>
          <tr style="font-weight: bold;">
            <td style="border: 1px solid black; text-align: center;">ITEM</td>
            <td style="border: 1px solid black; text-align: center;">DETALLE</td>
            <td style="border: 1px solid black; text-align: center;">AREA EN M2</td>
            <td style="border: 1px solid black; text-align: center;">VALOR METRO</td>
            <td style="border: 1px solid black; text-align: center;">VALOR TOTAL</td>
          </tr>
        </thead>
        <tbody>
          ${htmlItems}
        </tbody>
      </table>

      <div class="conditions">
        <p><b>CONDICIONES ECONÓMICAS:</b> 60% de anticipo al aceptar esta cotización y 40% contra entrega.</p>
        <p><b>NO INCLUYE:</b> obras de albañilería.</p>
        <p><b>TIEMPO DE ENTREGA:</b> A acordar con el cliente.</p>
        <p><b>VALIDEZ OFERTA:</b> 10 días calendario.</p>
      </div>

      <div class="signature">
        <p>Cordialmente,</p>
        <br><br>
        <p>__________________________________</p>
        <p><b>${EMPRESA.nombre}</b></p>
        <p>CC. ${EMPRESA.rut}</p>
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