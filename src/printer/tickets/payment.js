// Comprobante de pago y comprobante de devolución.
//
// `order` tiene la forma de orders.findById(): trae los datos del cobro
// (payment_day, payment_method, cash_shift_id) y de la devolución, si la hay
// (refund_amount, refund_method, refund_day).
import { Ticket } from '../escpos.js'
import { paymentMethodLabel } from '../../constants.js'
import {
  field,
  folioCodeBlock,
  footer,
  formatDate,
  formatDateTime,
  header,
  money,
  row,
  rule,
  signature,
  title
} from './common.js'

export function paymentReceipt({ order, business, copy = false, now = new Date() }) {
  if (!order.paid) throw new Error(`El pedido #${order.id} no está pagado`)

  const t = new Ticket()
  header(t, business, { copy, now })
  title(t, 'COMPROBANTE DE PAGO')
  t.align('center').bold().line(`Pedido #${order.id}`).bold(false).align('left')
  t.line()

  field(t, 'Fecha', formatDateTime(order.payment_day))
  field(t, 'Cliente', order.client_name)
  if (order.status !== 'delivered' && order.status !== 'cancelled') {
    field(t, 'Entrega', formatDate(order.expected_delivery_date))
  }
  t.line(rule())
  t.bold().size(1, 2).lines(row('PAGADO', money(order.total))).size().bold(false)
  field(t, 'Forma de pago', paymentMethodLabel(order.payment_method))
  field(t, 'Turno de caja', order.cash_shift_id ? `#${order.cash_shift_id}` : 'sin turno')

  // Con este comprobante también se recoge la ropa.
  folioCodeBlock(t, order.id)
  footer(t, business)
  return t.build()
}

export function refundReceipt({ order, business, copy = false, now = new Date() }) {
  if (!order.refund_id) throw new Error(`El pedido #${order.id} no tiene devolución`)

  const t = new Ticket()
  header(t, business, { copy, now })
  title(t, 'COMPROBANTE DE DEVOLUCIÓN')
  t.align('center').bold().line(`Pedido #${order.id} - cancelado`).bold(false).align('left')
  t.line()

  field(t, 'Fecha', formatDateTime(order.refund_day))
  field(t, 'Cliente', order.client_name)
  field(t, 'Cobrado', formatDateTime(order.payment_day))
  t.line(rule())
  t.bold().size(1, 2).lines(row('DEVUELTO', money(order.refund_amount))).size().bold(false)
  field(t, 'Devuelto en', paymentMethodLabel(order.refund_method))

  signature(t, `Recibí conforme: ${order.client_name}`)
  return t.build()
}
