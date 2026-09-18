// Personal: quién atendió cada pedido (sin sesión)
import { describe, test, beforeAll, afterAll } from 'bun:test'
import { db, startServer, stopServer, resetDb, login, client, ok, addService, addClient, createOrder, orderRow, logsOf } from './_helpers.js'

let base, c, cid
beforeAll(async () => {
  resetDb(); base = startServer(); c = client(base, await login(base))
  await addService(c, 'Lavado kg', 'laundry', '30', 'kilo')
  cid = await addClient(c, 'Cliente X')
})
afterAll(stopServer)

describe('migración v3', () => {
  test('tabla Staff y Orders.id_staff', () => {
    ok(db.query('PRAGMA user_version').get().user_version === 3, 'user_version = 3')
    ok(db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='Staff'").get(), 'Staff existe')
    ok(db.query('PRAGMA table_info(Orders)').all().some((x) => x.name === 'id_staff'), 'Orders.id_staff')
  })
})

describe('CRUD de personal', () => {
  test('alta, validación, edición, toggle', async () => {
    let html = await (await c.get('/staff')).text()
    ok(html.includes('Aún no hay personal registrado') && html.includes('id="staff-tbody"'), 'vacío')
    html = await (await c.post('/staff', { name: '  ' })).text()
    ok(html.includes('El nombre es obligatorio') && db.query('SELECT COUNT(*) n FROM Staff').get().n === 0, 'nombre vacío')
    html = await (await c.post('/staff', { name: 'María' })).text()
    ok(html.includes('María') && html.includes('hx-swap-oob="true"></div>'), 'alta limpia el form')
    await c.post('/staff', { name: '<b>Pepe</b>' })
    html = await (await c.get('/staff')).text()
    ok(html.includes('&lt;b&gt;Pepe&lt;/b&gt;'), 'escapado')
    html = await (await c.put('/staff/1', { name: 'María López' })).text()
    ok(html.includes('María López') && html.includes('id="staff-1"'), 'editar')
    ok((await (await c.get('/staff/1/row')).text()).includes('<tr id="staff-1"'), 'cancelar edición')
    html = await (await c.post('/staff/2/toggle')).text()
    ok(html.includes('Inactivo') && db.query('SELECT is_active FROM Staff WHERE id = 2').get().is_active === 0, 'desactivar')
    ok((await c.get('/staff/999/edit')).status === 404, '404')
  })
})

describe('pedido con persona', () => {
  test('la captura exige elegir persona; solo activas', async () => {
    let html = await (await c.get('/orders/new')).text()
    ok(html.includes('¿Quién atendió?') && html.includes('name="id_staff"'), 'sección 5')
    ok(html.includes('>María López<') && !html.includes('Pepe'), 'solo personal activo')
    const lines = [['line_service_id[]', '1'], ['line_quantity[]', '1'], ['id_client', String(cid)]]
    html = await (await c.post('/orders', new URLSearchParams(lines))).text()
    ok(html.includes('Selecciona quién atendió'), 'sin persona → rechazado')
    html = await (await c.post('/orders', new URLSearchParams([...lines, ['id_staff', '2']]))).text()
    ok(html.includes('Selecciona quién atendió'), 'persona inactiva → rechazado')
    html = await (await c.post('/orders', new URLSearchParams([...lines, ['id_staff', '999']]))).text()
    ok(html.includes('Selecciona quién atendió'), 'persona inexistente → rechazado')
    ok(db.query('SELECT COUNT(*) n FROM Orders').get().n === 0, 'nada guardado')
  })

  test('se guarda y se muestra en detalle, listado, bitácora y caja', async () => {
    const id = await createOrder(c, cid, [[1, 2]], { id_staff: '1' })
    ok(orderRow(id).id_staff === 1 && orderRow(id).id_user === 1, 'id_staff y id_user (sesión)')
    ok(logsOf(id)[0].message.includes('creado por María López'), 'bitácora nombra a la persona')
    ok((await (await c.get(`/orders/${id}`)).text()).includes('Atendió:</span> María López'), 'detalle')
    const list = await (await c.get('/orders')).text()
    ok(list.includes('>Atendió<') && list.includes('María López'), 'columna en listado')
    await c.post(`/orders/${id}/pay`, { payment_method: 'cash' })
    ok((await (await c.get('/cash')).text()).includes('Cobros sin turno'), 'caja sigue funcionando con el join nuevo')
  })

  test('sin personal registrado, la captura avisa', async () => {
    db.query('UPDATE Staff SET is_active = 0').run()
    const html = await (await c.get('/orders/new')).text()
    ok(html.includes('No hay personal registrado') && html.includes('href="/staff"'), 'aviso con enlace')
    db.query('UPDATE Staff SET is_active = 1 WHERE id = 1').run()
  })

  test('pedidos anteriores a v3 (sin persona) muestran guion', async () => {
    db.query('INSERT INTO Orders (id_client, id_user, total) VALUES (?, 1, 0)').run(cid)
    const id = db.query('SELECT MAX(id) id FROM Orders').get().id
    ok((await (await c.get(`/orders/${id}`)).text()).includes('Atendió:</span> —'), 'guion')
  })
})
