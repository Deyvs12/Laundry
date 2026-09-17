// Correcciones de la revisión: zona horaria, rutas absolutas, login robusto, escapado
import { describe, test, beforeAll, afterAll } from 'bun:test'
import { db, startServer, stopServer, resetDb, login, client, ok } from './_helpers.js'
import { DB_PATH } from '../src/db/database.js'
import { escapeHtml, formatDate, formatDateTime } from '../src/views/_helpers.js'

let base, c
beforeAll(async () => { resetDb(); base = startServer(); c = client(base, await login(base)) })
afterAll(stopServer)

describe('entorno', () => {
  test('la DB de pruebas es la temporal, no la del proyecto', () => {
    ok(DB_PATH === process.env.LAVANDERIA_DB && !DB_PATH.endsWith('/Lavanderia/lavanderia.db'), DB_PATH)
  })
  test('estáticos se sirven sin depender del cwd', async () => {
    const r = await fetch(`${base}/public/css/main.css`)
    ok(r.status === 200 && (await r.text()).includes('tailwindcss'), 'main.css')
  })
})

describe('fechas', () => {
  // Esta máquina está en UTC-6; 02:30Z del 12 es el 11 a las 20:30 local.
  const local = new Date('2026-09-12T02:30:00Z')
  const expected = local.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
  test('datetime UTC → fecha local; fecha sin hora intacta', () => {
    ok(formatDate('2026-09-12 02:30:00') === expected, `formatDate → ${expected}`)
    ok(formatDateTime('2026-09-12 02:30:00').startsWith(expected), 'formatDateTime')
    ok(formatDate('2026-09-12') === '12/09/2026', 'sin hora no se convierte')
    ok(formatDate(null) === '—', 'null')
  })
})

describe('login', () => {
  test('hash inválido en la DB → credenciales inválidas, no 500', async () => {
    db.query("INSERT INTO Users (username, name, password, role) VALUES ('roto', 'Hash Roto', 'texto-plano', 'employee')").run()
    const r = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ username: 'roto', password: 'x' }) })
    ok(r.status === 200 && (await r.text()).includes('Credenciales inválidas'), 'ok')
  })
  test('nombre de usuario escapado en nav y home', async () => {
    db.query("UPDATE Users SET name = '<img src=x onerror=alert(1)>', password = ? WHERE username = 'roto'").run(await Bun.password.hash('pw'))
    const cookie = await login(base, 'roto', 'pw')
    const html = await (await fetch(`${base}/`, { headers: { Cookie: cookie } })).text()
    ok(html.includes('&lt;img') && !html.includes('<img src=x'), 'escapado')
  })
  test("escapeHtml escapa comilla simple", () => {
    ok(escapeHtml("O'Brien") === 'O&#39;Brien', "'")
  })
})
