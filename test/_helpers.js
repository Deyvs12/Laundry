import entry from '../src/index.js'
import db from '../src/db/database.js'
import * as users from '../src/services/users.js'

export { db }

const ADMIN_HASH = await Bun.password.hash('admin123')

let server = null

export function startServer() {
  server = Bun.serve({ port: 0, fetch: entry.fetch })
  return `http://localhost:${server.port}`
}

export function stopServer() {
  server?.stop()
  server = null
}

// Los archivos de test comparten proceso y DB: cada uno arranca limpio.
export function resetDb() {
  db.exec('PRAGMA foreign_keys = OFF')
  for (const t of ['Logs', 'Order_services', 'Orders', 'Cash_shifts', 'Services', 'Clients', 'Staff', 'Users']) {
    db.exec(`DELETE FROM ${t}`)
  }
  db.exec('DELETE FROM sqlite_sequence')
  db.exec('PRAGMA foreign_keys = ON')
  users.create({ username: 'admin', name: 'Administrador', password: ADMIN_HASH, role: 'admin' })
}

export async function login(base, username = 'admin', password = 'admin123') {
  const r = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'HX-Request': 'true' },
    body: new URLSearchParams({ username, password })
  })
  return r.headers.get('set-cookie')?.split(';')[0] ?? null
}

// Cliente HTTP con sesión. `post` acepta objeto o URLSearchParams (para campos repetidos).
export function client(base, cookie) {
  const H = { Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded', 'HX-Request': 'true' }
  const body = (d) => (d instanceof URLSearchParams ? d : new URLSearchParams(d))
  return {
    get: (u, opts = {}) => fetch(`${base}${u}`, { headers: { Cookie: cookie }, ...opts }),
    post: (u, d = {}) => fetch(`${base}${u}`, { method: 'POST', headers: H, body: body(d) }),
    put: (u, d = {}) => fetch(`${base}${u}`, { method: 'PUT', headers: H, body: body(d) }),
    del: (u) => fetch(`${base}${u}`, { method: 'DELETE', headers: H })
  }
}

export function ok(cond, label) {
  if (!cond) throw new Error(`FALLÓ: ${label}`)
}

// Atajos de datos de prueba
export async function addService(c, name, type, price, price_type) {
  await c.post('/services', { name, type, price, price_type })
  return db.query('SELECT id FROM Services WHERE name = ?').get(name).id
}

export async function addClient(c, name, phone = '') {
  const r = await c.post('/orders/new/clients', { new_client_name: name, new_client_phone: phone })
  return Number((await r.text()).match(/name="id_client" value="(\d+)"/)[1])
}

export function ensureStaff(name = 'Personal Prueba') {
  const row = db.query('SELECT id FROM Staff WHERE name = ?').get(name)
  return row ? row.id : db.query('INSERT INTO Staff (name) VALUES (?)').run(name).lastInsertRowid
}

// lines: [[serviceId, qty], ...]. Si no se indica id_staff, usa una persona de prueba.
export async function createOrder(c, clientId, lines, extra = {}) {
  const params = new URLSearchParams()
  if (extra.id_staff === undefined) params.set('id_staff', String(ensureStaff()))
  for (const [id, qty] of lines) {
    params.append('line_service_id[]', String(id))
    params.append('line_quantity[]', String(qty))
  }
  params.set('id_client', String(clientId))
  for (const [k, v] of Object.entries(extra)) params.set(k, v)
  const r = await c.post('/orders', params)
  const loc = r.headers.get('hx-redirect')
  if (!loc) throw new Error(`createOrder rechazado: ${await r.text()}`)
  return Number(loc.split('/').pop())
}

// 'YYYY-MM-DD' local a n días de hoy (negativo = pasado)
export function daysFromNow(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  const pad = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const orderRow = (id) => db.query('SELECT * FROM Orders WHERE id = ?').get(id)
export const logsOf = (id) => db.query('SELECT action, message, cash_shift_id FROM Logs WHERE order_id = ? ORDER BY id').all(id)
export const lineIds = (id) => db.query('SELECT id FROM Order_services WHERE id_orders = ? ORDER BY id').all(id).map((l) => l.id)
