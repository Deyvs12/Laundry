// Fase 0 (migraciones, base) + Fase 1 (catálogo de servicios)
import { describe, test, beforeAll, afterAll } from 'bun:test'
import { db, startServer, stopServer, resetDb, login, client, ok } from './_helpers.js'

let base, c
beforeAll(async () => { resetDb(); base = startServer(); c = client(base, await login(base)) })
afterAll(stopServer)

describe('base', () => {
  test('migraciones aplicadas en DB nueva', () => {
    ok(db.query('PRAGMA user_version').get().user_version === 4, 'user_version = 4')
    const cols = db.query('PRAGMA table_info(Orders)').all().map((x) => x.name)
    ok(cols.includes('discount') && cols.includes('cash_shift_id'), 'Orders tiene discount y cash_shift_id')
    ok(db.query("SELECT sql FROM sqlite_master WHERE name = 'Logs'").get().sql.includes('ORDER_DISCOUNTED'), 'Logs acepta ORDER_DISCOUNTED')
    ok(db.query('PRAGMA table_info(Cash_shifts)').all().some((x) => x.name === 'closed_by'), 'Cash_shifts.closed_by')
    ok(db.query('PRAGMA foreign_keys').get().foreign_keys === 1, 'foreign_keys ON')
  })

  test('FK activa de verdad', () => {
    let err = null
    try { db.query('INSERT INTO Orders (id_client, id_user) VALUES (99999, 1)').run() } catch (e) { err = e.message }
    ok(err?.includes('FOREIGN KEY'), 'rechaza cliente inexistente')
  })

  test('/ping devuelve texto, rutas protegidas redirigen', async () => {
    let r = await fetch(`${base}/ping`)
    ok(r.headers.get('content-type')?.startsWith('text/plain'), '/ping text/plain')
    r = await fetch(`${base}/services`, { redirect: 'manual' })
    ok(r.status === 302 && r.headers.get('location') === '/login', '/services sin sesión → /login')
    r = await fetch(`${base}/services`, { headers: { 'HX-Request': 'true' }, redirect: 'manual' })
    ok(r.status === 200 && r.headers.get('hx-redirect') === '/login', 'petición htmx sin sesión → HX-Redirect')
  })

  test('login y logout quedan en bitácora', async () => {
    ok(db.query("SELECT COUNT(*) n FROM Logs WHERE action = 'USER_LOGIN'").get().n === 1, 'USER_LOGIN')
    let r = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ username: 'admin', password: 'mal' }) })
    ok((await r.text()).includes('Credenciales inválidas'), 'password incorrecta')
    const cookie = await login(base)
    r = await fetch(`${base}/auth/logout`, { method: 'POST', headers: { Cookie: cookie, 'HX-Request': 'true' } })
    ok(r.headers.get('hx-redirect') === '/login', 'logout redirige')
    ok(db.query("SELECT COUNT(*) n FROM Logs WHERE action = 'USER_LOGOUT'").get().n === 1, 'USER_LOGOUT')
  })
})

describe('catálogo de servicios', () => {
  test('página y catálogo vacío', async () => {
    const r = await c.get('/services')
    const html = await r.text()
    ok(r.status === 200 && html.includes('<!doctype html>') && html.includes('services-tbody'), '/services carga')
    ok(html.includes('No hay servicios en el catálogo'), 'vacío')
  })

  test('alta con coma decimal y limpieza OOB del formulario', async () => {
    const r = await c.post('/services', { name: 'Lavado por kilo', type: 'laundry', price: '25,50', price_type: 'kilo' })
    const html = await r.text()
    ok(html.includes('Lavado por kilo') && html.includes('$25.50'), 'creado con coma decimal')
    ok(html.includes('<div id="form-area" class="mb-4" hx-swap-oob="true"></div>'), 'form limpiado vía OOB')
  })

  test('validaciones devuelven 200 con error y conservan lo capturado', async () => {
    let r = await c.post('/services', { name: 'Malo', type: 'laundry', price: 'abc', price_type: 'kilo' })
    let html = await r.text()
    ok(r.status === 200 && html.includes('El precio debe ser un número'), 'precio inválido')
    ok(html.includes('value="Malo"'), 'conserva el nombre')
    r = await c.post('/services', { name: 'Hack', type: 'DROP', price: '10', price_type: 'kilo' })
    ok((await r.text()).includes('Selecciona un tipo de servicio'), 'tipo fuera del CHECK')
    r = await c.post('/services', { name: 'X', type: 'laundry', price: '10', price_type: 'gramo' })
    ok((await r.text()).includes('Selecciona una forma de cobro'), 'price_type fuera del CHECK')
    ok(db.query('SELECT COUNT(*) n FROM Services').get().n === 1, 'nada inválido se guardó')
  })

  test('precio se redondea a 2 decimales', async () => {
    await c.post('/services', { name: 'Camisa', type: 'ironing', price: '15.555', price_type: 'unit' })
    ok(db.query("SELECT price FROM Services WHERE name = 'Camisa'").get().price === 15.56, '15.555 → 15.56')
  })

  test('filtro por tipo repone el id del tbody', async () => {
    const r = await c.get('/services/list?filter_type=ironing')
    const html = await r.text()
    ok(html.includes('Camisa') && !html.includes('Lavado por kilo'), 'solo planchado')
    ok(html.trim().startsWith('<tbody id="services-tbody">'), 'tbody con id')
  })

  test('escapado de HTML', async () => {
    await c.post('/services', { name: '<script>alert(1)</script>', type: 'laundry', price: '1', price_type: 'unit' })
    const html = await (await c.get('/services')).text()
    ok(html.includes('&lt;script&gt;') && !html.includes('<script>alert(1)</script>'), 'nombre malicioso escapado')
  })

  test('editar, cancelar, activar/desactivar, 404', async () => {
    let r = await c.get('/services/1/edit')
    let html = await r.text()
    ok(html.includes('hx-put="/services/1"') && html.includes('value="25.5"'), 'form de edición precargado')
    r = await c.put('/services/1', { name: 'Lavado por kilo', type: 'laundry', price: '30', price_type: 'kilo' })
    ok((await r.text()).includes('$30.00'), 'guardar edición')
    r = await c.put('/services/1', { name: '', type: 'laundry', price: '30', price_type: 'kilo' })
    ok((await r.text()).includes('El nombre es obligatorio'), 'edición inválida → error en la fila')
    r = await c.get('/services/1/row')
    ok((await r.text()).includes('<tr id="service-1"'), 'cancelar devuelve la fila')
    r = await c.post('/services/1/toggle')
    html = await r.text()
    ok(html.includes('Inactivo') && html.includes('>Activar<'), 'desactivar')
    r = await c.post('/services/1/toggle')
    ok((await r.text()).includes('Activo'), 'reactivar')
    r = await c.get('/services/9999/edit')
    ok(r.status === 404, 'inexistente → 404')
    r = await c.get('/services/abc/edit')
    ok(r.status === 404, 'id no numérico → 404 limpio')
  })
})
