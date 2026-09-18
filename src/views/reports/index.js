import { escapeHtml, formatMoney, formatDate, formatDateTime } from '../_helpers.js'
import { serviceTypeLabel, paymentMethodLabel } from '../../constants.js'

const PRESETS = [
  { key: 'today', label: 'Hoy' },
  { key: 'week', label: 'Esta semana' },
  { key: 'month', label: 'Este mes' },
  { key: 'last_month', label: 'Mes anterior' }
]

const GROUPS = [
  { key: 'day', label: 'Por día' },
  { key: 'week', label: 'Por semana' },
  { key: 'month', label: 'Por mes' }
]

// Página de solo lectura: enlaces y un formulario GET normales bastan, no hace
// falta HTMX para recargar una tabla que se lee entera de todos modos.
export function reportsPage({ range, data, backups }) {
  const { from, to, preset, group } = range
  const link = (key) =>
    `<a href="/reports?preset=${key}&group=${group}" class="px-3 py-1 rounded text-sm ${preset === key ? 'bg-slate-800 text-white' : 'bg-slate-200'}">${PRESETS.find((p) => p.key === key).label}</a>`

  return `
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-semibold">Reportes</h1>
    </div>

    <div class="border border-slate-300 rounded p-4 mb-6 space-y-3">
      <div class="flex flex-wrap gap-2">${PRESETS.map((p) => link(p.key)).join('')}</div>
      <form method="get" action="/reports" class="flex flex-wrap items-end gap-2 text-sm">
        <div>
          <label class="block text-xs text-slate-500 mb-1" for="from">Desde</label>
          <input id="from" name="from" type="date" value="${from}" class="border border-slate-300 rounded px-3 py-2">
        </div>
        <div>
          <label class="block text-xs text-slate-500 mb-1" for="to">Hasta</label>
          <input id="to" name="to" type="date" value="${to}" class="border border-slate-300 rounded px-3 py-2">
        </div>
        <div>
          <label class="block text-xs text-slate-500 mb-1" for="group">Agrupar</label>
          <select id="group" name="group" class="border border-slate-300 rounded px-3 py-2">
            ${GROUPS.map((g) => `<option value="${g.key}"${g.key === group ? ' selected' : ''}>${g.label}</option>`).join('')}
          </select>
        </div>
        <button type="submit" class="bg-slate-800 text-white px-3 py-2 rounded">Ver</button>
      </form>
      <p class="text-xs text-slate-500">Periodo: ${formatDate(from)} a ${formatDate(to)}. Los ingresos son pedidos cobrados en ese periodo, por fecha de cobro.</p>
    </div>

    ${summaryCards(data.summary)}

    <h2 class="font-semibold mt-6 mb-2">Ingresos ${GROUPS.find((g) => g.key === group).label.toLowerCase()}</h2>
    ${periodTable(data.byPeriod, group)}

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
      <div>
        <h2 class="font-semibold mb-2">Por tipo de servicio</h2>
        ${typeTable(data.byType)}
      </div>
      <div>
        <h2 class="font-semibold mb-2">Por forma de pago</h2>
        ${methodTable(data.byMethod)}
      </div>
    </div>

    <h2 class="font-semibold mt-6 mb-2">Clientes que más compraron</h2>
    ${clientsTable(data.topClients)}

    ${backupPanel(backups)}
  `
}

function summaryCards(s) {
  const card = (label, value) => `<div class="border border-slate-300 rounded p-3">
    <div class="text-xs text-slate-500">${label}</div>
    <div class="text-xl font-semibold">${value}</div>
  </div>`
  return `<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
    ${card('Ingresos', formatMoney(s.revenue))}
    ${card('Pedidos cobrados', s.orders)}
    ${card('Ticket promedio', formatMoney(s.average))}
    ${card('Descuentos otorgados', formatMoney(s.discounts))}
  </div>`
}

const TH = 'border border-slate-300 px-3 py-2'
const TD = 'border border-slate-300 px-3 py-2'
const empty = (cols, msg) => `<tr><td colspan="${cols}" class="${TD} text-center text-slate-500">${msg}</td></tr>`

function periodLabel(period, group) {
  if (group === 'month') {
    const [y, m] = period.split('-')
    return `${m}/${y}`
  }
  return group === 'week' ? `Semana del ${formatDate(period)}` : formatDate(period)
}

function periodTable(rows, group) {
  return `<table class="w-full border border-slate-300 text-sm">
    <thead class="bg-slate-100 text-left"><tr>
      <th class="${TH}">Periodo</th><th class="${TH} w-24">Pedidos</th>
      <th class="${TH} w-32">Efectivo</th><th class="${TH} w-32">Transferencia</th><th class="${TH} w-32">Total</th>
    </tr></thead>
    <tbody>${
      rows.length === 0
        ? empty(5, 'Sin cobros en este periodo.')
        : rows.map((r) => `<tr>
            <td class="${TD}">${periodLabel(r.period, group)}</td><td class="${TD}">${r.orders}</td>
            <td class="${TD}">${formatMoney(r.cash)}</td><td class="${TD}">${formatMoney(r.transfer)}</td>
            <td class="${TD} font-semibold">${formatMoney(r.total)}</td>
          </tr>`).join('')
    }</tbody>
  </table>`
}

function typeTable(rows) {
  return `<table class="w-full border border-slate-300 text-sm">
    <thead class="bg-slate-100 text-left"><tr>
      <th class="${TH}">Tipo</th><th class="${TH} w-24">Pedidos</th><th class="${TH} w-32">Venta bruta</th>
    </tr></thead>
    <tbody>${
      rows.length === 0
        ? empty(3, 'Sin datos.')
        : rows.map((r) => `<tr>
            <td class="${TD}">${escapeHtml(serviceTypeLabel(r.type))}</td><td class="${TD}">${r.orders}</td>
            <td class="${TD}">${formatMoney(r.gross)}</td>
          </tr>`).join('')
    }</tbody>
  </table>
  <p class="text-xs text-slate-500 mt-1">Venta bruta: antes de descuentos, que se aplican al pedido completo.</p>`
}

function methodTable(rows) {
  return `<table class="w-full border border-slate-300 text-sm">
    <thead class="bg-slate-100 text-left"><tr>
      <th class="${TH}">Forma</th><th class="${TH} w-24">Pedidos</th><th class="${TH} w-32">Total</th>
    </tr></thead>
    <tbody>${
      rows.length === 0
        ? empty(3, 'Sin datos.')
        : rows.map((r) => `<tr>
            <td class="${TD}">${escapeHtml(paymentMethodLabel(r.method))}</td><td class="${TD}">${r.orders}</td>
            <td class="${TD}">${formatMoney(r.total)}</td>
          </tr>`).join('')
    }</tbody>
  </table>`
}

function clientsTable(rows) {
  return `<table class="w-full border border-slate-300 text-sm">
    <thead class="bg-slate-100 text-left"><tr>
      <th class="${TH} w-10">#</th><th class="${TH}">Cliente</th><th class="${TH} w-24">Pedidos</th><th class="${TH} w-32">Total</th>
    </tr></thead>
    <tbody>${
      rows.length === 0
        ? empty(4, 'Sin datos.')
        : rows.map((r, i) => `<tr>
            <td class="${TD}">${i + 1}</td>
            <td class="${TD}">${escapeHtml(r.name)}${r.phone ? ` <span class="text-slate-500">· ${escapeHtml(r.phone)}</span>` : ''}</td>
            <td class="${TD}">${r.orders}</td><td class="${TD}">${formatMoney(r.total)}</td>
          </tr>`).join('')
    }</tbody>
  </table>`
}

export function backupPanel(backups, { message = null } = {}) {
  const kb = (n) => `${Math.round(n / 1024)} KB`
  return `<div id="backup-panel" class="border border-slate-300 rounded p-4 mt-8">
    <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
      <h2 class="font-semibold">Respaldo de la base de datos</h2>
      <button hx-post="/backups" hx-target="#backup-panel" hx-swap="outerHTML"
        class="bg-slate-800 text-white px-3 py-2 rounded text-sm">Crear respaldo ahora</button>
    </div>
    ${message ? `<p class="text-sm text-green-700 mb-3">${escapeHtml(message)}</p>` : ''}
    ${
      backups.length === 0
        ? '<p class="text-sm text-slate-500">Aún no hay respaldos.</p>'
        : `<ul class="divide-y divide-slate-200 text-sm border border-slate-200 rounded">${backups
            .map((b) => `<li class="flex justify-between px-3 py-2">
              <span>${escapeHtml(b.name)} <span class="text-slate-500">· ${kb(b.size)} · ${formatDateTime(b.createdAt.toISOString().slice(0, 19).replace('T', ' '))}</span></span>
              <a href="/backups/${encodeURIComponent(b.name)}" class="text-blue-600">Descargar</a>
            </li>`).join('')}</ul>`
    }
  </div>`
}
