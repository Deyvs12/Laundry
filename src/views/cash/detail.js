import { escapeHtml, formatMoney, formatDateTime } from '../_helpers.js'
import { paymentsTable, differenceCell } from './index.js'

export function shiftDetail(shift, summary, payments) {
  const open = shift.status === 'open'
  return `
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-semibold">Turno #${shift.id}
        <span class="text-base font-normal text-slate-500">· ${open ? 'abierto' : 'cerrado'}</span>
      </h1>
      <a href="/cash" class="text-sm text-slate-600 hover:text-slate-900">Volver a caja</a>
    </div>

    <div class="border border-slate-300 rounded p-4 mb-4 text-sm grid grid-cols-1 md:grid-cols-2 gap-2">
      ${row('Abrió', `${escapeHtml(shift.opened_by_name)} · ${formatDateTime(shift.opening_time)}`)}
      ${row('Cerró', open ? '—' : `${escapeHtml(shift.closed_by_name || '—')} · ${formatDateTime(shift.closing_time)}`)}
      ${row('Fondo inicial', formatMoney(shift.initial_cash))}
      ${row(`Efectivo cobrado (${summary.cash_count})`, formatMoney(summary.cash_total))}
      ${row(`Transferencias (${summary.transfer_count})`, formatMoney(summary.transfer_total))}
      ${row('Efectivo esperado', formatMoney(open ? shift.initial_cash + summary.cash_total : shift.expected_cash))}
      ${open ? '' : row('Efectivo contado', formatMoney(shift.actual_cash))}
      ${open ? '' : row('Diferencia', differenceCell(shift.difference))}
    </div>

    <h2 class="font-semibold mb-2">Cobros del turno</h2>
    ${paymentsTable(payments)}
  `
}

function row(label, value) {
  return `<div><span class="text-slate-500">${label}:</span> ${value}</div>`
}
