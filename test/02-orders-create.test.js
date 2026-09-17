// Fase 2: creación de pedidos
import { describe, test, beforeAll, afterAll } from 'bun:test'
import { db, startServer, stopServer, resetDb, login, client, ok, addService, addClient, createOrder, orderRow, logsOf } from './_helpers.js'

let base, c, cid
const S = {}
beforeAll(async () => {
  resetDb(); base = startServer(); c = client(base, await login(base))
  S.kilo = await addService(c, 'Lavado por kilo', 'laundry', '25.50', 'kilo')      // 1
  S.camisa = await addService(c, 'Planchado camisa', 'ironing', '15', 'unit')      // 2
  S.traje = await addService(c, 'Traje tintorería', 'dry_cleaning', '180', 'service') // 3
  cid = await addClient(c, 'Cliente Mostrador', '555-9000')
})
afterAll(stopServer)

describe('pantalla de captura', () => {
  test('carga con buscador de servicios y sin cliente/líneas', async () => {
    const html = await (await c.get('/orders/new')).text()
    ok(html.includes('id="order-form"'), 'form')
    ok(html.includes('name="service_search"') && html.includes('name="service_type"'), 'buscador')
    ok(html.includes('$25.50'), 'precio visible en resultados')
    ok(html.includes('Ningún cliente seleccionado') && html.includes('Aún no has agregado servicios'), 'estado inicial')
  })

  test('cliente: buscar, seleccionar, quitar, crear al vuelo', async () => {
    let r = await c.get('/orders/new/clients?client_search=most')
    let html = await r.text()
    ok(html.includes('hx-get="/orders/new/clients/') && html.includes('Cliente Mostrador'), 'búsqueda por nombre')
    ok((await (await c.get('/orders/new/clients?client_search=555-9000')).text()).includes('Cliente Mostrador'), 'por teléfono')
    ok((await (await c.get('/orders/new/clients?client_search=zzzz')).text()).includes('Sin coincidencias'), 'sin resultados')
    ok((await (await c.get('/orders/new/clients?client_search=%25')).text()).includes('Sin coincidencias'), 'comodín % escapado')
    ok((await (await c.get(`/orders/new/clients/${cid}`)).text()).includes(`value="${cid}"`), 'seleccionar')
    ok(!(await (await c.get('/orders/new/clients/clear')).text()).includes('name="id_client"'), 'quitar')
    r = await c.post('/orders/new/clients', { new_client_name: '', new_client_phone: '' })
    ok((await r.text()).includes('nombre del cliente es obligatorio'), 'crear sin nombre rechazado')
  })

  test('líneas: agregar, acumular, quitar, resumen OOB', async () => {
    let r = await c.post('/orders/new/lines', { pick_service_id: S.kilo, pick_quantity: '2,5' })
    let html = await r.text()
    ok(html.includes('$63.75') && html.includes('2.5 kg'), '2.5 kg × 25.50, coma decimal, unidad')
    ok(html.includes(`name="line_service_id[]" value="${S.kilo}"`) && !html.includes('line_unit_price'), 'hidden sin precio')
    ok(html.includes('id="order-summary" hx-swap-oob="true"'), 'resumen OOB')
    r = await c.post('/orders/new/lines', new URLSearchParams([['line_service_id[]', S.kilo], ['line_quantity[]', '2.5'], ['pick_service_id', S.camisa], ['pick_quantity', '3']]))
    html = await r.text()
    ok(html.includes('$63.75') && html.includes('$45.00') && html.includes('$108.75'), 'acumula y suma')
    r = await c.post('/orders/new/lines/remove', new URLSearchParams([['line_service_id[]', S.kilo], ['line_quantity[]', '2.5'], ['line_service_id[]', S.camisa], ['line_quantity[]', '3'], ['remove_index', '0']]))
    html = await r.text()
    ok(!html.includes('$63.75') && html.includes('$45.00'), 'quitar por índice')
  })

  test('líneas inválidas explican el motivo', async () => {
    let html = await (await c.post('/orders/new/lines', { pick_service_id: S.camisa, pick_quantity: '2.5' })).text()
    ok(html.includes('Aún no has agregado servicios') && html.includes('número entero'), '2.5 camisas rechazado')
    html = await (await c.post('/orders/new/lines', { pick_service_id: S.traje, pick_quantity: '1.5' })).text()
    ok(html.includes('número entero'), '1.5 servicios rechazado')
    html = await (await c.post('/orders/new/lines', { pick_service_id: S.kilo, pick_quantity: '0' })).text()
    ok(html.includes('mayor a 0'), 'cantidad 0')
    html = await (await c.post('/orders/new/lines', { pick_service_id: '9999', pick_quantity: '1' })).text()
    ok(html.includes('ya no está disponible'), 'servicio inexistente')
    html = await (await c.post('/orders/new/lines', { pick_service_id: S.kilo, pick_quantity: '1' })).text()
    ok(html.includes('hx-swap-oob="true"></div>'), 'el error se limpia en la siguiente')
  })

  test('descuento en el resumen', async () => {
    const lines = [['line_service_id[]', S.kilo], ['line_quantity[]', '2.5']]
    let html = await (await c.post('/orders/new/summary', new URLSearchParams([...lines, ['discount', '8.75']]))).text()
    ok(html.includes('$63.75') && html.includes('-$8.75') && html.includes('$55.00'), 'resta del total')
    html = await (await c.post('/orders/new/summary', new URLSearchParams([...lines, ['discount', '999']]))).text()
    ok(html.includes('supera el subtotal'), 'avisa si pasa el subtotal')
  })
})

describe('alta del pedido', () => {
  test('validaciones', async () => {
    const lines = [['line_service_id[]', S.kilo], ['line_quantity[]', '2.5']]
    const txt = async (params) => (await c.post('/orders', new URLSearchParams(params))).text()
    ok((await txt([...lines, ['id_client', '']])).includes('Selecciona un cliente'), 'sin cliente')
    ok((await txt([['id_client', cid]])).includes('al menos un servicio'), 'sin líneas')
    ok((await txt([...lines, ['id_client', cid], ['discount', '9999']])).includes('no puede ser mayor'), 'descuento excesivo')
    ok((await txt([...lines, ['id_client', cid], ['expected_delivery_date', '13-99-2026']])).includes('fecha de entrega no es válida'), 'formato de fecha')
    ok((await txt([...lines, ['id_client', cid], ['expected_delivery_date', '2026-02-31']])).includes('fecha de entrega no es válida'), '31 de febrero')
    ok((await txt([...lines, ['id_client', cid], ['expected_delivery_date', '2026-13-01']])).includes('fecha de entrega no es válida'), 'mes 13')
  })

  test('alta correcta: totales, snapshot de precio, bitácora', async () => {
    const id = await createOrder(c, cid, [[S.kilo, 2.5], [S.camisa, 3]], { discount: '8.75', notes: 'Mancha <b>urgente</b>', expected_delivery_date: '2028-02-29' })
    const o = orderRow(id)
    ok(o.total === 100 && o.discount === 8.75, 'total = 108.75 − 8.75')
    ok(o.status === 'received' && o.paid === 0 && o.cash_shift_id === null, 'estado inicial')
    ok(o.id_user === 1, 'id_user de la sesión')
    ok(o.expected_delivery_date === '2028-02-29', '29 feb bisiesto aceptado')
    const lines = db.query('SELECT * FROM Order_services WHERE id_orders = ? ORDER BY id').all(id)
    ok(lines.length === 2 && lines[0].unit_price === 25.5 && lines[0].sub_total === 63.75, 'líneas con precio congelado')
    ok(lines.every((l) => l.status === 'in_process'), 'líneas en in_process')
    ok(logsOf(id).map((l) => l.action).join(',') === 'ORDER_CREATED,ORDER_DISCOUNTED', 'bitácora')
    const html = await (await c.get(`/orders/${id}`)).text()
    ok(html.includes('$108.75') && html.includes('-$8.75') && html.includes('$100.00'), 'detalle desglosa')
    ok(html.includes('&lt;b&gt;urgente&lt;/b&gt;'), 'notas escapadas')
    ok((await (await c.get('/orders?status=all')).text()).includes('29/02/2028'), 'fecha local en listado')
  })

  test('el precio no se acepta del navegador', async () => {
    const r = await c.post('/orders', new URLSearchParams([['line_service_id[]', S.kilo], ['line_quantity[]', '1'], ['line_unit_price[]', '0.01'], ['id_client', cid]]))
    const id = Number(r.headers.get('hx-redirect').split('/').pop())
    ok(db.query('SELECT unit_price FROM Order_services WHERE id_orders = ?').get(id).unit_price === 25.5, 'precio manipulado ignorado')
  })

  test('servicio desactivado a media captura', async () => {
    await c.post(`/services/${S.camisa}/toggle`)
    const r = await c.post('/orders', new URLSearchParams([['line_service_id[]', S.camisa], ['line_quantity[]', '1'], ['id_client', cid]]))
    ok((await r.text()).includes('dejó de estar disponible'), 'avisa')
    await c.post(`/services/${S.camisa}/toggle`)
  })

  test('transacción: nada a medias', () => {
    const before = db.query('SELECT COUNT(*) n FROM Orders').get().n
    try {
      db.transaction(() => {
        db.query('INSERT INTO Orders (id_client, id_user, total) VALUES (?, 1, 10)').run(cid)
        db.query('INSERT INTO Order_services (id_orders, id_services, quantity, unit_price, sub_total) VALUES (99999, 1, 1, 1, 1)').run()
      })()
    } catch {}
    ok(db.query('SELECT COUNT(*) n FROM Orders').get().n === before, 'rollback')
  })

  test('404 y protección', async () => {
    ok((await c.get('/orders/99999')).status === 404, 'inexistente')
    ok((await c.get('/orders/abc')).status === 404, 'id no numérico')
    ok((await fetch(`${base}/orders/new`, { redirect: 'manual' })).status === 302, 'protegido')
  })
})
