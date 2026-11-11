import { escapeHtml, formatDateTime, formatDate, renderOptions } from '../_helpers.js'
import { LOG_ACTIONS, logActionLabel } from '../../constants.js'

export function logsPage({ filters, rows, hasMore }) {
  const { action, from, to, order } = filters
  const nextUrl = hasMore && rows.length
    ? `/logs?${new URLSearchParams({ action, from, to, order, before: String(rows[rows.length - 1].id) })}`
    : null

  return `
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-semibold">Bitácora</h1>
    </div>

    <form method="get" action="/logs" class="border border-slate-300 rounded p-4 mb-4 flex flex-wrap items-end gap-2 text-sm">
      <div>
        <label class="block text-xs text-slate-500 mb-1" for="action">Acción</label>
        <select id="action" name="action" class="border border-slate-300 rounded px-3 py-2">
          ${renderOptions(LOG_ACTIONS, action, 'Todas')}
        </select>
      </div>
      <div>
        <label class="block text-xs text-slate-500 mb-1" for="from">Desde</label>
        <input id="from" name="from" type="date" value="${from}" class="border border-slate-300 rounded px-3 py-2">
      </div>
      <div>
        <label class="block text-xs text-slate-500 mb-1" for="to">Hasta</label>
        <input id="to" name="to" type="date" value="${to}" class="border border-slate-300 rounded px-3 py-2">
      </div>
      <div>
        <label class="block text-xs text-slate-500 mb-1" for="order">Pedido</label>
        <input id="order" name="order" type="text" inputmode="numeric" value="${escapeHtml(order)}" placeholder="folio"
          class="border border-slate-300 rounded px-3 py-2 w-24">
      </div>
      <button type="submit" class="bg-slate-800 text-white px-3 py-2 rounded">Ver</button>
      <a href="/logs" class="text-slate-600 underline px-2">Limpiar</a>
    </form>

    <p class="text-xs text-slate-500 mb-2">
      ${from || to ? `Del ${formatDate(from)} al ${formatDate(to)}.` : 'Todo el historial.'}
      ${order ? ` Pedido #${escapeHtml(order)}.` : ''}
      Más recientes primero.
    </p>

    <table class="w-full border border-slate-300 text-sm">
      <thead class="bg-slate-100 text-left">
        <tr>
          <th class="border border-slate-300 px-3 py-2 w-40">Fecha</th>
          <th class="border border-slate-300 px-3 py-2 w-36">Acción</th>
          <th class="border border-slate-300 px-3 py-2">Detalle</th>
          <th class="border border-slate-300 px-3 py-2 w-20">Pedido</th>
          <th class="border border-slate-300 px-3 py-2 w-20">Turno</th>
        </tr>
      </thead>
      <tbody>
        ${
          rows.length === 0
            ? '<tr><td colspan="5" class="border border-slate-300 px-3 py-3 text-center text-slate-500">Sin movimientos con ese filtro.</td></tr>'
            : rows.map(renderRow).join('')
        }
      </tbody>
    </table>

    ${nextUrl ? `<div class="mt-3 text-sm"><a href="${nextUrl}" class="text-blue-600 underline">Ver anteriores</a></div>` : ''}
  `
}

const TONE = {
  ORDER_PAID: 'text-green-700',
  ORDER_DISCOUNTED: 'text-amber-700',
  ORDER_CANCELLED: 'text-red-700',
  SHIFT_OPENED: 'text-green-700',
  SHIFT_CLOSED: 'text-blue-700'
}

function renderRow(l) {
  return `
    <tr>
      <td class="border border-slate-300 px-3 py-2 whitespace-nowrap">${formatDateTime(l.created_at)}</td>
      <td class="border border-slate-300 px-3 py-2 ${TONE[l.action] || ''}">${escapeHtml(logActionLabel(l.action))}</td>
      <td class="border border-slate-300 px-3 py-2">${escapeHtml(l.message)}</td>
      <td class="border border-slate-300 px-3 py-2">${l.order_id ? `<a href="/orders/${l.order_id}" class="text-blue-600">#${l.order_id}</a>` : '—'}</td>
      <td class="border border-slate-300 px-3 py-2">${l.cash_shift_id ? `<a href="/cash/${l.cash_shift_id}" class="text-blue-600">#${l.cash_shift_id}</a>` : '—'}</td>
    </tr>
  `
}
