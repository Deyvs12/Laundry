import { escapeHtml, formatMoney, formatDate, renderOptions } from '../_helpers.js'
import { ORDER_STATUSES, orderStatusLabel } from '../../constants.js'

const STATUS_FILTERS = [
  { value: 'active', label: 'Activos' },
  { value: 'all', label: 'Todos' },
  ...ORDER_STATUSES
]

export function ordersList(orders, { status = 'active', client = '' } = {}) {
  return `
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-semibold">Pedidos</h1>
      <a href="/orders/new" class="bg-slate-800 text-white px-3 py-1 rounded">Nuevo pedido</a>
    </div>

    <div id="orders-filters" class="flex flex-wrap gap-3 items-end mb-4">
      <div>
        <label class="block text-xs text-slate-500 mb-1" for="filter-status">Estado</label>
        <select
          id="filter-status"
          name="status"
          hx-get="/orders/list"
          hx-include="#orders-filters"
          hx-target="#orders-tbody"
          hx-swap="outerHTML"
          class="border border-slate-300 rounded px-3 py-2 text-sm">
          ${renderOptions(STATUS_FILTERS, status)}
        </select>
      </div>
      <div class="flex-1 min-w-48">
        <label class="block text-xs text-slate-500 mb-1" for="filter-client">Cliente</label>
        <input
          id="filter-client"
          name="client"
          type="text"
          value="${escapeHtml(client)}"
          placeholder="Nombre o teléfono…"
          autocomplete="off"
          hx-get="/orders/list"
          hx-include="#orders-filters"
          hx-trigger="input changed delay:300ms"
          hx-target="#orders-tbody"
          hx-swap="outerHTML"
          class="w-full border border-slate-300 rounded px-3 py-2 text-sm">
      </div>
    </div>

    <table class="w-full border border-slate-300 text-sm">
      <thead class="bg-slate-100 text-left">
        <tr>
          <th class="border border-slate-300 px-3 py-2 w-20">Folio</th>
          <th class="border border-slate-300 px-3 py-2">Cliente</th>
          <th class="border border-slate-300 px-3 py-2 w-28">Recibido</th>
          <th class="border border-slate-300 px-3 py-2 w-28">Entrega</th>
          <th class="border border-slate-300 px-3 py-2 w-28">Estado</th>
          <th class="border border-slate-300 px-3 py-2 w-28">Total</th>
          <th class="border border-slate-300 px-3 py-2 w-24">Pago</th>
          <th class="border border-slate-300 px-3 py-2 w-32">Atendió</th>
        </tr>
      </thead>
      ${renderTbody(orders)}
    </table>
  `
}

export function renderTbody(orders) {
  if (orders.length === 0) {
    return `<tbody id="orders-tbody">
      <tr><td colspan="8" class="border border-slate-300 px-3 py-3 text-center text-slate-500">No hay pedidos con ese filtro.</td></tr>
    </tbody>`
  }
  return `<tbody id="orders-tbody">${orders.map(renderRow).join('')}</tbody>`
}

function renderRow(order) {
  const muted = order.status === 'cancelled' ? ' class="text-slate-400"' : ''
  return `
    <tr${muted}>
      <td class="border border-slate-300 px-3 py-2">
        <a href="/orders/${order.id}" class="text-blue-600">#${order.id}</a>
      </td>
      <td class="border border-slate-300 px-3 py-2">${escapeHtml(order.client_name)}</td>
      <td class="border border-slate-300 px-3 py-2">${formatDate(order.created_at)}</td>
      <td class="border border-slate-300 px-3 py-2">${formatDate(order.expected_delivery_date)}</td>
      <td class="border border-slate-300 px-3 py-2">${escapeHtml(orderStatusLabel(order.status))}</td>
      <td class="border border-slate-300 px-3 py-2">${formatMoney(order.total)}</td>
      <td class="border border-slate-300 px-3 py-2">${order.paid ? 'Pagado' : 'Pendiente'}</td>
      <td class="border border-slate-300 px-3 py-2">${escapeHtml(order.staff_name || '—')}</td>
    </tr>
  `
}
