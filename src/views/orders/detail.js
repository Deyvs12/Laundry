import { escapeHtml, formatMoney, formatDate, formatDateTime, renderOptions } from '../_helpers.js'
import {
  PAYMENT_METHODS,
  orderStatusLabel,
  lineStatusLabel,
  paymentMethodLabel,
  quantityUnit
} from '../../constants.js'
import { isFinal } from '../../services/orders.js'

// Todo el detalle es un solo fragmento (#order-detail). Cada acción lo
// devuelve completo: es lo más simple y garantiza que estado, líneas y
// botones nunca se desincronicen entre sí.
export function orderDetail(order, lines, { error = null, shift = null } = {}) {
  const subtotal = lines.reduce((sum, l) => sum + l.sub_total, 0)
  const final = isFinal(order.status)
  const act = (path) =>
    `hx-post="/orders/${order.id}/${path}" hx-target="#order-detail" hx-swap="outerHTML"`

  return `
  <div id="order-detail">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-semibold">Pedido #${order.id}
        <span class="text-base font-normal text-slate-500">· ${escapeHtml(orderStatusLabel(order.status))}</span>
      </h1>
      <a href="/orders" class="text-sm text-slate-600 hover:text-slate-900">Volver a pedidos</a>
    </div>

    ${error ? `<p class="mb-4 text-sm text-red-600 border border-red-200 bg-red-50 rounded px-3 py-2">${escapeHtml(error)}</p>` : ''}

    <div class="border border-slate-300 rounded p-4 mb-4 text-sm grid grid-cols-1 md:grid-cols-2 gap-2">
      ${field('Cliente', escapeHtml(order.client_name) + (order.client_phone ? ` · ${escapeHtml(order.client_phone)}` : ''))}
      ${field('Atendió', escapeHtml(order.staff_name || '—'))}
      ${field('Recibido', formatDateTime(order.created_at))}
      ${field('Entrega estimada', formatDate(order.expected_delivery_date))}
      ${field('Pago', paymentSummary(order))}
      ${order.notes ? field('Notas', escapeHtml(order.notes)) : ''}
    </div>

    <table class="w-full border border-slate-300 text-sm mb-4">
      <thead class="bg-slate-100 text-left">
        <tr>
          <th class="border border-slate-300 px-3 py-2">Servicio</th>
          <th class="border border-slate-300 px-3 py-2 w-28">Cantidad</th>
          <th class="border border-slate-300 px-3 py-2 w-28">Precio</th>
          <th class="border border-slate-300 px-3 py-2 w-28">Subtotal</th>
          <th class="border border-slate-300 px-3 py-2 w-28">Estado</th>
          ${final ? '' : '<th class="border border-slate-300 px-3 py-2 w-28"></th>'}
        </tr>
      </thead>
      <tbody>
        ${lines.map((line) => lineRow(order, line, final, act)).join('')}
      </tbody>
    </table>

    <div class="flex flex-col md:flex-row md:justify-between gap-6">
      <div class="flex-1">${actions(order, lines, final, act, shift)}</div>

      <div class="text-sm space-y-1 w-full md:w-64">
        <div class="flex justify-between">
          <span class="text-slate-600">Subtotal</span><span>${formatMoney(subtotal)}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-600">Descuento</span><span>${order.discount > 0 ? '-' : ''}${formatMoney(order.discount)}</span>
        </div>
        <div class="flex justify-between font-semibold text-base border-t border-slate-300 pt-1">
          <span>Total</span><span>${formatMoney(order.total)}</span>
        </div>
      </div>
    </div>
  </div>
  `
}

function field(label, value) {
  return `<div><span class="text-slate-500">${label}:</span> ${value}</div>`
}

function paymentSummary(order) {
  if (!order.paid) return '<span class="text-amber-700">Pendiente</span>'
  return `Pagado · ${escapeHtml(paymentMethodLabel(order.payment_method))} · ${formatDateTime(order.payment_day)}${
    order.cash_shift_id ? ` · <a href="/cash/${order.cash_shift_id}" class="text-blue-600">turno #${order.cash_shift_id}</a>` : ''
  }`
}

function lineRow(order, line, final, act) {
  const ready = line.status === 'ready'
  return `
    <tr${ready ? '' : ' class="bg-amber-50"'}>
      <td class="border border-slate-300 px-3 py-2">${escapeHtml(line.name)}</td>
      <td class="border border-slate-300 px-3 py-2">${line.quantity} ${escapeHtml(quantityUnit(line.price_type))}</td>
      <td class="border border-slate-300 px-3 py-2">${formatMoney(line.unit_price)}</td>
      <td class="border border-slate-300 px-3 py-2">${formatMoney(line.sub_total)}</td>
      <td class="border border-slate-300 px-3 py-2">${escapeHtml(lineStatusLabel(line.status))}</td>
      ${
        final
          ? ''
          : `<td class="border border-slate-300 px-3 py-2">
              <button ${act(`lines/${line.id}/toggle`)} class="${ready ? 'text-slate-600' : 'text-green-700'}">
                ${ready ? 'Regresar a proceso' : 'Marcar listo'}
              </button>
            </td>`
      }
    </tr>
  `
}

function actions(order, lines, final, act, shift) {
  if (final) {
    return `<p class="text-sm text-slate-500">Pedido ${escapeHtml(orderStatusLabel(order.status).toLowerCase())}. No admite más cambios.</p>`
  }

  const pending = lines.some((l) => l.status !== 'ready')
  const btn = 'px-3 py-2 rounded text-sm'
  const parts = []

  if (order.status === 'received') {
    parts.push(`<button ${act('start')} class="${btn} bg-slate-200">Iniciar proceso</button>`)
  }
  if (pending) {
    parts.push(`<button ${act('ready-all')} class="${btn} bg-slate-200">Marcar todo listo</button>`)
  }
  if (order.status === 'ready') {
    parts.push(
      order.paid
        ? `<button ${act('deliver')} hx-confirm="¿Entregar el pedido #${order.id} al cliente?" class="${btn} bg-slate-800 text-white">Entregar</button>`
        : `<span class="text-sm text-amber-700 self-center">Cobra el pedido para poder entregarlo.</span>`
    )
  }

  const noShiftHint = shift
    ? ''
    : `<p class="text-xs text-amber-700 mt-3">No hay turno de caja abierto: el cobro quedará registrado <strong>sin turno</strong> y no entrará en ningún corte.</p>`

  const payForm = order.paid
    ? ''
    : `${noShiftHint}<div id="pay-form" class="flex items-end gap-2 ${shift ? 'mt-3 pt-3 border-t border-slate-200' : 'mt-1'}">
        <div>
          <label class="block text-xs text-slate-500 mb-1" for="payment_method">Forma de pago</label>
          <select id="payment_method" name="payment_method" class="border border-slate-300 rounded px-3 py-2 text-sm">
            ${renderOptions(PAYMENT_METHODS, 'cash')}
          </select>
        </div>
        <button ${act('pay')} hx-include="#pay-form"
          hx-confirm="¿Cobrar ${formatMoney(order.total)} del pedido #${order.id}?"
          class="${btn} bg-green-700 text-white">Cobrar ${formatMoney(order.total)}</button>
      </div>`

  const cancelBtn = order.paid
    ? ''
    : `<div class="mt-3">
        <button ${act('cancel')} hx-confirm="¿Cancelar el pedido #${order.id}? Esta acción no se puede deshacer."
          class="text-sm text-red-600 underline">Cancelar pedido</button>
      </div>`

  return `
    <div class="flex flex-wrap gap-2">${parts.join('')}</div>
    ${payForm}
    ${cancelBtn}
  `
}
