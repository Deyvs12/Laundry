import { escapeHtml, formatMoney, formatDateTime } from '../_helpers.js'
import { paymentMethodLabel } from '../../constants.js'

export function cashPage({ shift, summary, payments, refunds, history, unassigned, unassignedRefunds, unassignedSummary, error = null }) {
  return `
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-semibold">Caja</h1>
    </div>

    ${error ? `<p class="mb-4 text-sm text-red-600 border border-red-200 bg-red-50 rounded px-3 py-2">${escapeHtml(error)}</p>` : ''}

    ${shift ? openShiftPanel(shift, summary, payments, refunds) : openForm()}

    ${unassignedPanel(unassigned, unassignedRefunds, unassignedSummary)}

    <h2 class="font-semibold mt-8 mb-3">Cortes anteriores</h2>
    ${historyTable(history)}
  `
}

function openForm() {
  return `
    <div class="border border-slate-300 rounded p-4 bg-slate-50">
      <h2 class="font-semibold mb-1">No hay turno abierto</h2>
      <p class="text-sm text-slate-600 mb-3">Cuenta el efectivo con el que arranca el cajón y abre el turno. Los cobros que se hagan sin turno abierto no entran en ningún corte: quedan aparte como "cobros sin turno".</p>
      <form hx-post="/cash/open" hx-target="#main" hx-swap="innerHTML" class="flex items-end gap-2">
        <div>
          <label class="block text-xs text-slate-500 mb-1" for="initial_cash">Fondo inicial</label>
          <input id="initial_cash" name="initial_cash" type="text" inputmode="decimal" required placeholder="0.00"
            class="border border-slate-300 rounded px-3 py-2 w-40">
        </div>
        <button type="submit" class="bg-slate-800 text-white px-4 py-2 rounded">Abrir turno</button>
      </form>
    </div>
  `
}

function openShiftPanel(shift, summary, payments, refunds) {
  const expected = shift.initial_cash + summary.cash_net
  return `
    <div class="border border-green-300 bg-green-50 rounded p-4 mb-4">
      <div class="flex flex-wrap justify-between gap-2 mb-3">
        <h2 class="font-semibold">Turno #${shift.id} abierto</h2>
        <span class="text-sm text-slate-600">Abrió ${escapeHtml(shift.opened_by_name)} · ${formatDateTime(shift.opening_time)}</span>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
        ${stat('Fondo inicial', formatMoney(shift.initial_cash))}
        ${stat(`Efectivo cobrado (${summary.cash_count})`, formatMoney(summary.cash_total))}
        ${stat(`Transferencias (${summary.transfer_count})`, formatMoney(summary.transfer_total))}
        ${stat('Efectivo esperado en cajón', formatMoney(expected), true)}
      </div>
      ${summary.refund_count ? `<p class="text-sm text-red-700 mb-4">Devoluciones (${summary.refund_count}): ${formatMoney(summary.cash_refunds)} en efectivo, ${formatMoney(summary.transfer_refunds)} por transferencia. El efectivo devuelto ya está restado del esperado.</p>` : ''}

      <form hx-post="/cash/${shift.id}/close" hx-target="#main" hx-swap="innerHTML"
        hx-confirm="¿Cerrar el turno #${shift.id}? Después no se podrán registrar más cobros en efectivo hasta abrir otro."
        class="flex items-end gap-2 pt-3 border-t border-green-200">
        <div>
          <label class="block text-xs text-slate-500 mb-1" for="actual_cash">Efectivo contado</label>
          <input id="actual_cash" name="actual_cash" type="text" inputmode="decimal" required placeholder="0.00"
            class="border border-slate-300 rounded px-3 py-2 w-40">
        </div>
        <button type="submit" class="bg-slate-800 text-white px-4 py-2 rounded">Cerrar turno</button>
      </form>
    </div>

    <h2 class="font-semibold mb-2">Cobros de este turno</h2>
    ${paymentsTable(payments)}
    ${refundsTable(refunds)}
  `
}

export function refundsTable(refunds) {
  if (refunds.length === 0) return ''
  return `
    <h2 class="font-semibold mt-4 mb-2 text-red-700">Devoluciones</h2>
    <table class="w-full border border-slate-300 text-sm">
      <thead class="bg-slate-100 text-left">
        <tr>
          <th class="border border-slate-300 px-3 py-2 w-20">Folio</th>
          <th class="border border-slate-300 px-3 py-2">Cliente</th>
          <th class="border border-slate-300 px-3 py-2 w-40">Devuelto</th>
          <th class="border border-slate-300 px-3 py-2 w-32">Forma</th>
          <th class="border border-slate-300 px-3 py-2 w-28">Monto</th>
        </tr>
      </thead>
      <tbody>
        ${refunds
          .map(
            (r) => `<tr class="text-red-700">
          <td class="border border-slate-300 px-3 py-2">${r.order_id ? `<a href="/orders/${r.order_id}" class="text-blue-600">#${r.order_id}</a>` : '—'}</td>
          <td class="border border-slate-300 px-3 py-2">${escapeHtml(r.client_name || '—')}</td>
          <td class="border border-slate-300 px-3 py-2">${formatDateTime(r.created_at)}</td>
          <td class="border border-slate-300 px-3 py-2">${escapeHtml(paymentMethodLabel(r.method))}</td>
          <td class="border border-slate-300 px-3 py-2">−${formatMoney(r.amount)}</td>
        </tr>`
          )
          .join('')}
      </tbody>
    </table>
  `
}

// Dinero que entró sin turno abierto. El efectivo de aquí está físicamente en
// el cajón pero ningún corte lo contó: es lo primero que el dueño debe revisar.
function unassignedPanel(payments, refunds, summary) {
  if (payments.length === 0 && refunds.length === 0) return ''
  return `
    <div class="border border-amber-300 bg-amber-50 rounded p-4 mt-6">
      <h2 class="font-semibold mb-1">Cobros sin turno de hoy</h2>
      <p class="text-sm text-slate-600 mb-3">
        Se registraron hoy con la caja cerrada y no aparecen en ningún corte. Mañana esta lista arranca vacía; los anteriores siguen en Pedidos.
        Efectivo: <strong>${formatMoney(summary.cash_total)}</strong> (${summary.cash_count}) ·
        Transferencias: <strong>${formatMoney(summary.transfer_total)}</strong> (${summary.transfer_count})
        ${summary.refund_count ? ` · Devoluciones: <strong class="text-red-700">−${formatMoney(summary.cash_refunds)}</strong> efectivo, <strong class="text-red-700">−${formatMoney(summary.transfer_refunds)}</strong> transferencia` : ''}
      </p>
      ${payments.length ? paymentsTable(payments) : ''}
      ${refundsTable(refunds)}
    </div>
  `
}

function stat(label, value, strong = false) {
  return `<div>
    <div class="text-xs text-slate-500">${label}</div>
    <div class="${strong ? 'font-semibold text-base' : ''}">${value}</div>
  </div>`
}

export function paymentsTable(payments) {
  if (payments.length === 0) {
    return `<p class="text-sm text-slate-500">Todavía no hay cobros en este turno.</p>`
  }
  return `
    <table class="w-full border border-slate-300 text-sm">
      <thead class="bg-slate-100 text-left">
        <tr>
          <th class="border border-slate-300 px-3 py-2 w-20">Folio</th>
          <th class="border border-slate-300 px-3 py-2">Cliente</th>
          <th class="border border-slate-300 px-3 py-2 w-40">Cobrado</th>
          <th class="border border-slate-300 px-3 py-2 w-32">Forma</th>
          <th class="border border-slate-300 px-3 py-2 w-28">Monto</th>
        </tr>
      </thead>
      <tbody>
        ${payments
          .map(
            (p) => `<tr>
          <td class="border border-slate-300 px-3 py-2"><a href="/orders/${p.id}" class="text-blue-600">#${p.id}</a></td>
          <td class="border border-slate-300 px-3 py-2">${escapeHtml(p.client_name)}</td>
          <td class="border border-slate-300 px-3 py-2">${formatDateTime(p.payment_day)}</td>
          <td class="border border-slate-300 px-3 py-2">${escapeHtml(paymentMethodLabel(p.payment_method))}</td>
          <td class="border border-slate-300 px-3 py-2">${formatMoney(p.total)}</td>
        </tr>`
          )
          .join('')}
      </tbody>
    </table>
  `
}

function historyTable(history) {
  const closed = history.filter((s) => s.status === 'closed')
  if (closed.length === 0) return `<p class="text-sm text-slate-500">Aún no hay cortes cerrados.</p>`

  return `
    <table class="w-full border border-slate-300 text-sm">
      <thead class="bg-slate-100 text-left">
        <tr>
          <th class="border border-slate-300 px-3 py-2 w-20">Turno</th>
          <th class="border border-slate-300 px-3 py-2">Abierto</th>
          <th class="border border-slate-300 px-3 py-2">Cerrado</th>
          <th class="border border-slate-300 px-3 py-2 w-28">Esperado</th>
          <th class="border border-slate-300 px-3 py-2 w-28">Contado</th>
          <th class="border border-slate-300 px-3 py-2 w-36">Diferencia</th>
        </tr>
      </thead>
      <tbody>
        ${closed
          .map(
            (s) => `<tr>
          <td class="border border-slate-300 px-3 py-2"><a href="/cash/${s.id}" class="text-blue-600">#${s.id}</a></td>
          <td class="border border-slate-300 px-3 py-2">${formatDateTime(s.opening_time)} · ${escapeHtml(s.opened_by_name)}</td>
          <td class="border border-slate-300 px-3 py-2">${formatDateTime(s.closing_time)} · ${escapeHtml(s.closed_by_name || '—')}</td>
          <td class="border border-slate-300 px-3 py-2">${formatMoney(s.expected_cash)}</td>
          <td class="border border-slate-300 px-3 py-2">${formatMoney(s.actual_cash)}</td>
          <td class="border border-slate-300 px-3 py-2">${differenceCell(s.difference)}</td>
        </tr>`
          )
          .join('')}
      </tbody>
    </table>
  `
}

export function differenceCell(d) {
  if (d === 0) return '<span class="text-green-700">Cuadra</span>'
  const cls = d > 0 ? 'text-blue-700' : 'text-red-700'
  return `<span class="${cls}">${d > 0 ? '+' : '−'}${formatMoney(Math.abs(d))} ${d > 0 ? '(sobra)' : '(falta)'}</span>`
}
