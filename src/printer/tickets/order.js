// Comprobante del pedido (para el cliente) y etiqueta (para la bolsa de ropa).
//
// `order` tiene la forma de orders.findById() y `lines` la de orders.linesOf().
import { Ticket } from '../escpos.js'
import { paymentMethodLabel } from '../../constants.js'
import {
  bigFolio,
  field,
  folioCodeBlock,
  footer,
  formatDate,
  formatDateTime,
  header,
  money,
  quantity,
  row,
  rule,
  title,
  wrap
} from './common.js'

export function orderTicket({ order, lines, business, copy = false, now = new Date() }) {
  const t = new Ticket()
  header(t, business, { copy, now })
  title(t, 'PEDIDO')
  bigFolio(t, order.id, 2)

  t.line()
  field(t, 'Recibido', formatDateTime(order.created_at))
  if (order.expected_delivery_date) {
    t.bold()
    field(t, 'Entrega', formatDate(order.expected_delivery_date))
    t.bold(false)
  }
  field(t, 'Cliente', order.client_name)
  field(t, 'Tel.', order.client_phone)
  field(t, 'Atendió', order.staff_name)
  t.line(rule())

  // Cada servicio: el nombre en su renglón y debajo cantidad × precio con el
  // importe a la derecha. Así un nombre largo no empuja el importe.
  for (const l of lines) {
    t.lines(wrap(l.name))
    t.lines(row(`  ${quantity(l.quantity, l.price_type)} x ${money(l.unit_price)}`, money(l.sub_total)))
  }
  t.line(rule())

  const subtotal = lines.reduce((sum, l) => sum + l.sub_total, 0)
  if (order.discount > 0) {
    t.lines(row('Subtotal', money(subtotal)))
    t.lines(row('Descuento', `-${money(order.discount)}`))
  }
  t.bold().size(1, 2).lines(row('TOTAL', money(order.total))).size().bold(false)
  t.line()

  t.align('center').bold()
  if (order.status === 'cancelled') t.line('CANCELADO')
  else if (order.paid) t.lines(wrap(`PAGADO - ${paymentMethodLabel(order.payment_method)}`))
  else t.line('PENDIENTE DE PAGO')
  t.bold(false).align('left')

  if (order.notes) {
    t.line(rule()).line('Notas:').lines(wrap(order.notes))
  }

  folioCodeBlock(t, order.id)
  footer(t, business)
  return t.build()
}

// Etiqueta para pegar en la bolsa: folio enorme, a quién pertenece, cuándo se
// entrega y qué lleva. Sin datos del negocio: no sale del local.
export function orderLabel({ order, lines, copy = false }) {
  const t = new Ticket()
  if (copy) t.align('center').bold().line('*** COPIA ***').bold(false)

  bigFolio(t, order.id, 3)
  t.align('center').bold().lines(wrap(order.client_name)).bold(false)
  if (order.client_phone) t.lines(wrap(`Tel. ${order.client_phone}`))
  if (order.expected_delivery_date) {
    t.bold().lines(wrap(`Entrega: ${formatDate(order.expected_delivery_date)}`)).bold(false)
  }
  t.align('left').line(rule())

  for (const l of lines) t.lines(wrap(`${quantity(l.quantity, l.price_type)} ${l.name}`))

  if (order.notes) t.line(rule()).lines(wrap(`Notas: ${order.notes}`))

  folioCodeBlock(t, order.id)
  return t.build()
}
