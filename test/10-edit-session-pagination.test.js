// Edición de pedidos, expiración de sesión, paginación de pedidos y clientes
import { describe, test, beforeAll, afterAll } from 'bun:test'
import { db, startServer, stopServer, resetDb, login, client, ok, addService, addClient, createOrder, orderRow, logsOf, ensureStaff, daysFromNow } from './_helpers.js'
import * as sessions from '../src/services/sessions.js'

let base, c, cid, cid2, staffId
beforeAll(async () => {
  resetDb(); base = startServer(); c = client(base, await login(base))
  await addService(c, 'Lavado kg', 'laundry', '10', 'kilo')    // 1
  await addService(c, 'Camisa', 'ironing', '20', 'unit')       // 2
  cid = await addClient(c, 'Ana', '555-1')
  cid2 = await addClient(c, 'Beto', '555-2')
  staffId = ensureStaff('María')
  db.query("INSERT INTO Staff (name) VALUES ('Pepe')").run()
})
afterAll(stopServer)

describe('editar pedido', () => {
  test('pantalla prellenada y guardado reemplaza líneas', async () => {
    const id = await createOrder(c, cid, [[1, 2], [2, 1]], { discount: '5', notes: 'Cuidado <b>', expected_delivery_date: daysFromNow(3), id_staff: String(staffId) })
    ok(orderRow(id).total === 35, 'total inicial 20+20−5')
    let html = await (await c.get(`/orders/${id}`)).text()
    ok(html.includes(`href="/orders/${id}/edit"`), 'detalle ofrece Editar')

    html = await (await c.get(`/orders/${id}/edit`)).text()
    ok(html.includes(`Editar pedido #${id}`) && html.includes(`hx-put="/orders/${id}"`) && html.includes('Guardar cambios'), 'modo edición')
    ok(html.includes(`name="id_client" value="${cid}"`) && html.includes('Ana'), 'cliente prellenado')
    ok(html.includes('name="line_service_id[]" value="1"') && html.includes('name="line_service_id[]" value="2"'), 'líneas prellenadas')
    ok(html.includes('value="5"') && html.includes('value="Cuidado &lt;b&gt;"') && html.includes(`value="${daysFromNow(3)}"`), 'descuento, notas, fecha')
    ok(html.includes(`<option value="${staffId}" selected>`), 'persona seleccionada')
    ok(html.includes('$40.00') && html.includes('$35.00'), 'totales calculados')

    // reemplazar: 3 camisas, sin descuento, otro cliente, otra persona
    const r = await c.put(`/orders/${id}`, new URLSearchParams([
      ['line_service_id[]', '2'], ['line_quantity[]', '3'],
      ['id_client', String(cid2)], ['discount', '0'], ['notes', 'nuevo'], ['id_staff', '2'],
      ['expected_delivery_date', daysFromNow(5)]
    ]))
    ok(r.headers.get('hx-redirect') === `/orders/${id}`, 'redirige al detalle')
    const o = orderRow(id)
    ok(o.total === 60 && o.discount === 0 && o.id_client === cid2 && o.id_staff === 2 && o.notes === 'nuevo', 'cabecera actualizada')
    const lines = db.query('SELECT * FROM Order_services WHERE id_orders = ?').all(id)
    ok(lines.length === 1 && lines[0].id_services === 2 && lines[0].quantity === 3, 'líneas reemplazadas')
    const log = logsOf(id).find((l) => l.action === 'ORDER_EDITED')
    ok(log && log.message.includes('por Pepe') && log.message.includes('35.00 → 60.00') && log.message.includes('descuento 5.00 → 0.00'), `bitácora: ${log?.message}`)
  })

  test('validaciones y fecha pasada conservable', async () => {
    const id = await createOrder(c, cid, [[1, 1]], { expected_delivery_date: daysFromNow(2) })
    db.query('UPDATE Orders SET expected_delivery_date = ? WHERE id = ?').run(daysFromNow(-2), id)
    let html = await (await c.get(`/orders/${id}/edit`)).text()
    ok(html.includes(`min="${daysFromNow(-2)}"`), 'min baja a la fecha que ya tenía')
    const put = (extra) => c.put(`/orders/${id}`, new URLSearchParams([['line_service_id[]', '1'], ['line_quantity[]', '1'], ['id_client', String(cid)], ['id_staff', String(staffId)], ...extra]))
    let r = await put([['expected_delivery_date', daysFromNow(-2)]])
    ok(r.headers.get('hx-redirect') === `/orders/${id}`, 'conservar la fecha pasada se permite')
    r = await put([['expected_delivery_date', daysFromNow(-1)]])
    ok((await r.text()).includes('no puede ser anterior a hoy'), 'otra fecha pasada no')
    r = await c.put(`/orders/${id}`, new URLSearchParams([['id_client', String(cid)], ['id_staff', String(staffId)]]))
    ok((await r.text()).includes('al menos un servicio'), 'sin líneas')
  })

  test('no editable: en proceso o cobrado', async () => {
    const a = await createOrder(c, cid, [[1, 1]])
    await c.post(`/orders/${a}/start`)
    let html = await (await c.get(`/orders/${a}`)).text()
    ok(!html.includes(`href="/orders/${a}/edit"`), 'sin enlace Editar en proceso')
    html = await (await c.get(`/orders/${a}/edit`)).text()
    ok(html.includes('Solo se puede editar un pedido recibido y sin cobrar') && html.includes(`Pedido #${a}`), 'edit → detalle con aviso')
    const r = await c.put(`/orders/${a}`, new URLSearchParams([['line_service_id[]', '2'], ['line_quantity[]', '9'], ['id_client', String(cid)], ['id_staff', String(staffId)]]))
    ok((await r.text()).includes('Solo se puede editar') && orderRow(a).total === 10, 'PUT rechazado, nada cambia')
    const b = await createOrder(c, cid, [[1, 1]])
    await c.post(`/orders/${b}/pay`, { payment_method: 'transfer' })
    ok(!(await (await c.get(`/orders/${b}`)).text()).includes(`/orders/${b}/edit"`), 'cobrado tampoco')
    ok((await c.get('/orders/9999/edit')).status === 404, '404')
  })
})

describe('sesión', () => {
  test('expira por inactividad y la actividad la renueva', async () => {
    const cookie = await login(base)
    const sid = cookie.split('=')[1]
    ok((await fetch(`${base}/orders`, { headers: { Cookie: cookie }, redirect: 'manual' })).status === 200, 'activa')
    sessions._setLastSeen(sid, Date.now() - sessions.TTL_MS + 60_000)
    ok((await fetch(`${base}/orders`, { headers: { Cookie: cookie }, redirect: 'manual' })).status === 200, 'a un minuto de expirar sigue viva…')
    sessions._setLastSeen(sid, Date.now() - sessions.TTL_MS + 60_000)
    await fetch(`${base}/orders`, { headers: { Cookie: cookie } })
    ok(sessions.get(sid) !== null, '…y la petición renovó el plazo')
    sessions._setLastSeen(sid, Date.now() - sessions.TTL_MS - 1000)
    const r = await fetch(`${base}/orders`, { headers: { Cookie: cookie }, redirect: 'manual' })
    ok(r.status === 302 && r.headers.get('location') === '/login', 'expirada → login')
    ok(sessions.get(sid) === null, 'destruida')
    ok(sessions.TTL_MS === 8 * 3600 * 1000, 'por defecto 8 horas')
  })
})

describe('paginación', () => {
  test('pedidos: 50 por página, filtros conservados', async () => {
    resetDb()
    await addService(c, 'Lavado kg', 'laundry', '10', 'kilo')
    const cc = client(base, await login(base))
    const k = await addClient(cc, 'Cliente Pag', '555-9')
    const p = await addClient(cc, 'Otro', '555-8')
    for (let i = 0; i < 60; i++) await createOrder(cc, k, [[1, 1]])
    await createOrder(cc, p, [[1, 1]])
    let html = await (await cc.get('/orders')).text()
    ok((html.match(/href="\/orders\/\d+"/g) || []).length === 50, '50 filas')
    ok(html.includes('Página 1 de 2') && html.includes('61 en total') && html.includes('Siguientes'), 'paginador')
    html = await (await cc.get('/orders/list?status=active&client=Pag&page=2')).text()
    ok((html.match(/href="\/orders\/\d+"/g) || []).length === 10 && html.includes('Página 2 de 2') && html.includes('60 en total'), 'página 2 filtrada')
    ok(html.includes('Anteriores') && !html.includes('Siguientes'), 'última página')
    ok(html.includes('client=Pag&amp;page=1') || html.includes('client=Pag&page=1'), 'href conserva el filtro')
    html = await (await cc.get('/orders/list?page=99')).text()
    ok(html.includes('Página 2 de 2'), 'página fuera de rango se acota')
  })

  test('clientes: búsqueda + páginas, alta y borrado repintan', async () => {
    resetDb()
    const cc = client(base, await login(base))
    const ins = db.query('INSERT INTO Clients (name, phone) VALUES (?, ?)')
    db.transaction(() => { for (let i = 1; i <= 55; i++) ins.run(`Cliente ${String(i).padStart(2, '0')}`, `700-${i}`) })()
    let html = await (await cc.get('/clients')).text()
    ok(html.includes('id="clients-results"') && html.includes('Página 1 de 2') && html.includes('55 en total'), 'paginado')
    ok((html.match(/id="client-\d+"/g) || []).length === 50, '50 filas')
    html = await (await cc.get('/clients/list?q=700-5&page=1')).text()
    ok(html.includes('Cliente 05') && html.includes('Cliente 50') && !html.includes('Cliente 01') && !html.includes('Página'), 'búsqueda por teléfono, sin paginador')
    html = await (await cc.post('/clients', { name: 'Zeta Nuevo', phone: '999', notes: '', q: 'Zeta' })).text()
    ok(html.includes('Zeta Nuevo') && !html.includes('Cliente 01') && html.includes('hx-swap-oob="true"></div>'), 'alta respeta el filtro y limpia el form')
    const zid = db.query("SELECT id FROM Clients WHERE name = 'Zeta Nuevo'").get().id
    html = await (await fetch(`${base}/clients/${zid}?q=Cliente+0`, { method: 'DELETE', headers: { Cookie: cc.get('/').headers?.Cookie || (await login(base)) } })).text()
    ok(html.includes('id="clients-results"') && html.includes('Cliente 01') && !html.includes('Zeta'), 'borrado repinta con el filtro de la URL')
  })
})
