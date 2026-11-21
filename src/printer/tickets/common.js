// Piezas compartidas por todos los tickets: encabezado del negocio, folio,
// código de barras, pie y formatos de fecha, dinero y cantidad.
//
// Todo lo que se escribe pasa por wrap() o row(): ningún renglón puede pasar de
// 32 columnas, o la impresora lo partiría donde le tocara.
import { COLS, row, rule, wrap } from '../columns.js'
import { folioBarcode } from '../folio.js'
import { formatDate, formatDateTime, formatMoney } from '../../views/_helpers.js'
import { quantityUnit } from '../../constants.js'

export { COLS, row, rule, wrap, formatDate, formatDateTime }

export const money = (n) => formatMoney(n)

// "3 kg", "2 pz", "1" (servicio). Sin ceros de sobra: 2.5, no 2.50.
export function quantity(qty, priceType) {
  const n = Number(qty)
  const text = Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100)
  const unit = quantityUnit(priceType)
  return unit ? `${text} ${unit}` : text
}

// La hora de impresión, en la zona de la PC. Mismo formato que formatDateTime.
export function nowText(now = new Date()) {
  return now.toLocaleString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// "Etiqueta: valor", partido si no cabe. Para datos que no son importes.
export function field(t, label, value) {
  if (value === null || value === undefined || value === '') return t
  return t.lines(wrap(`${label}: ${value}`))
}

// Nombre, dirección y teléfono del negocio. En una reimpresión va "COPIA"
// arriba de todo, para que no pase por el original.
export function header(t, biz, { copy = false, now = new Date() } = {}) {
  t.align('center')
  if (copy) {
    t.bold().line('*** COPIA ***').bold(false).line(`Reimpreso ${nowText(now)}`).line()
  }
  if (biz.name) t.bold().lines(wrap(biz.name)).bold(false)
  for (const line of biz.address) t.lines(wrap(line))
  if (biz.phone) t.lines(wrap(`Tel. ${biz.phone}`))
  return t.align('left').line(rule())
}

// Título del documento, centrado y en negritas.
export function title(t, text) {
  return t.align('center').bold().lines(wrap(text)).bold(false).align('left')
}

// El folio en grande, para encontrarlo de un vistazo. `scale` 2 cabe hasta
// "#12345678" (16 columnas); 3 hasta "#1234567" (10).
export function bigFolio(t, orderId, scale = 2) {
  return t.align('center').bold().size(scale, scale).line(`#${orderId}`).size().bold(false).align('left')
}

// El código de barras del folio, centrado, con "P123" legible debajo.
export function folioCodeBlock(t, orderId) {
  const { data, options } = folioBarcode(orderId)
  return t.line().align('center').barcode(data, options).align('left')
}

export function footer(t, biz) {
  if (!biz.footer.length) return t
  t.line().align('center')
  for (const line of biz.footer) t.lines(wrap(line))
  return t.align('left')
}

// Renglón para firmar a mano, con espacio arriba para la firma.
export function signature(t, label) {
  return t.feed(3).line(rule('_')).align('center').lines(wrap(label)).align('left')
}
