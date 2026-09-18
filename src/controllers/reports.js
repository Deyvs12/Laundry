import * as reports from '../services/reports.js'
import * as backup from '../services/backup.js'
import { render } from '../render.js'
import { todayLocal } from '../views/_helpers.js'
import { reportsPage, backupPanel } from '../views/reports/index.js'

const ISO = /^\d{4}-\d{2}-\d{2}$/
const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// Rangos en fecha local. Semana = lunes a hoy; mes = día 1 a hoy.
function presetRange(preset) {
  const now = new Date()
  const today = todayLocal()
  if (preset === 'today') return { from: today, to: today }
  if (preset === 'week') {
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
    return { from: iso(monday), to: today }
  }
  if (preset === 'last_month') {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const last = new Date(now.getFullYear(), now.getMonth(), 0)
    return { from: iso(first), to: iso(last) }
  }
  return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: today } // month
}

function readRange(q) {
  const group = ['day', 'week', 'month'].includes(q.group) ? q.group : 'day'
  const from = (q.from || '').toString()
  const to = (q.to || '').toString()

  if (ISO.test(from) && ISO.test(to) && from <= to) return { from, to, group, preset: 'custom' }

  const preset = ['today', 'week', 'month', 'last_month'].includes(q.preset) ? q.preset : 'month'
  return { ...presetRange(preset), group, preset }
}

export function index(c) {
  const range = readRange(c.req.query())
  const data = {
    summary: reports.summary(range),
    byPeriod: reports.revenueByPeriod(range),
    byType: reports.byServiceType(range),
    byMethod: reports.byPaymentMethod(range),
    topClients: reports.topClients(range)
  }
  return render(c, { title: 'Reportes — Laundry', body: reportsPage({ range, data, backups: backup.list() }) })
}

export function createBackup(c) {
  const name = backup.create()
  return c.html(backupPanel(backup.list(), { message: `Respaldo creado: ${name}` }))
}

// Única respuesta no-HTML del sistema: es un archivo para guardar, no una vista.
export function downloadBackup(c) {
  const path = backup.resolve(c.req.param('name'))
  if (!path) return c.text('Respaldo no encontrado', 404)
  c.header('Content-Type', 'application/vnd.sqlite3')
  c.header('Content-Disposition', `attachment; filename="${c.req.param('name')}"`)
  return c.body(Bun.file(path).stream())
}
