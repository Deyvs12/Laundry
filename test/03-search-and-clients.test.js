// Buscador de servicios con catálogo grande + errores visibles en Clientes
import { describe, test, beforeAll, afterAll } from 'bun:test'
import { db, startServer, stopServer, resetDb, login, client, ok, addClient, createOrder, orderRow } from './_helpers.js'

let base, c
beforeAll(async () => {
  resetDb(); base = startServer(); c = client(base, await login(base))
  // id N = "Lavado prenda N" a 20+N; luego planchado y tintorería
  const ins = db.query('INSERT INTO Services (name, type, price, price_type) VALUES (?, ?, ?, ?)')
  db.transaction(() => {
    for (let i = 1; i <= 100; i++) ins.run(`Lavado prenda ${i}`, 'laundry', 20 + i, 'unit')
    for (let i = 1; i <= 80; i++) ins.run(`Planchado prenda ${i}`, 'ironing', 10 + i, 'unit')
    for (let i = 1; i <= 33; i++) ins.run(`Tintorería especial ${i}`, 'dry_cleaning', 150 + i, 'service')
  })()
})
afterAll(stopServer)

describe('buscador de servicios (213 en catálogo)', () => {
  const count = (html) => (html.match(/hx-vals='\{"pick_service_id"/g) || []).length

  test('página: sin select gigante, resultados acotados', async () => {
    const html = await (await c.get('/orders/new')).text()
    ok(!html.includes('<optgroup'), 'sin desplegable')
    ok(count(html) === 12 && html.includes('Mostrando 12 de 213'), 'acotado con aviso')
  })

  test('filtros', async () => {
    let html = await (await c.get('/orders/new/services?service_type=dry_cleaning')).text()
    ok(html.includes('Tintorería especial') && !html.includes('Lavado prenda') && html.includes('Mostrando 12 de 33'), 'por tipo')
    html = await (await c.get('/orders/new/services?service_search=Planchado+prenda+7')).text()
    ok(count(html) === 11 && !html.includes('Mostrando'), 'por nombre (7, 70-79)')
    html = await (await c.get('/orders/new/services?service_type=laundry&service_search=prenda+42')).text()
    ok(count(html) === 1 && html.includes('Lavado prenda 42'), 'tipo + nombre')
    ok((await (await c.get('/orders/new/services?service_search=nada+de+nada')).text()).includes('Sin servicios que coincidan'), 'sin coincidencias')
    ok((await (await c.get('/orders/new/services?service_search=%25')).text()).includes('Sin servicios que coincidan'), 'comodín escapado')
    ok((await (await c.get('/orders/new/services?service_type=DROP+TABLE')).text()).includes('Mostrando 12 de 213'), 'tipo inválido se ignora')
  })

  test('inactivos fuera; agregar desde un resultado', async () => {
    await c.post('/services/41/toggle')
    ok(!(await (await c.get('/orders/new/services?service_search=Lavado+prenda+41')).text()).includes('Lavado prenda 41'), 'desactivado no aparece')
    await c.post('/services/41/toggle')
    const html = await (await c.post('/orders/new/lines', { pick_service_id: '42', pick_quantity: '2' })).text()
    ok(html.includes('Lavado prenda 42') && html.includes('$124.00'), '2 × $62')
  })

  test('pedido de punta a punta con el catálogo grande', async () => {
    const cid = await addClient(c, 'Fin a Fin', '555-7777')
    const id = await createOrder(c, cid, [[42, 2]], { discount: '24' })
    ok(orderRow(id).total === 100, '2×62 − 24 = 100')
  })
})

describe('clientes: errores visibles', () => {
  test('alta con nombre vacío → 200, error, conserva campos, no guarda', async () => {
    const r = await c.post('/clients', { name: '   ', phone: '555', notes: 'algo' })
    const html = await r.text()
    ok(r.status === 200 && html.includes('El nombre es obligatorio'), '200 con error')
    ok(html.includes('hx-post="/clients"') && html.includes('value="555"') && html.includes('value="algo"'), 'form repintado con valores')
    ok(html.includes('id="form-area" class="mb-4"'), 'conserva la clase del contenedor')
    ok(db.query("SELECT COUNT(*) n FROM Clients WHERE phone = '555'").get().n === 0, 'no se creó')
  })

  test('alta válida limpia el formulario', async () => {
    const html = await (await c.post('/clients', { name: 'Ana Real', phone: '555-1111', notes: 'ok' })).text()
    ok(html.includes('Ana Real') && html.includes('<div id="form-area" class="mb-4" hx-swap-oob="true"></div>'), 'ok')
  })

  test('edición inválida y válida', async () => {
    const id = db.query("SELECT id FROM Clients WHERE name = 'Ana Real'").get().id
    let html = await (await c.put(`/clients/${id}`, { name: '', phone: '555-2222', notes: 'editado' })).text()
    ok(html.includes('El nombre es obligatorio') && html.includes(`id="client-${id}"`) && html.includes('value="555-2222"'), 'error en la fila, conserva lo editado')
    ok(db.query('SELECT phone FROM Clients WHERE id = ?').get(id).phone === '555-1111', 'no se guardó')
    html = await (await c.put(`/clients/${id}`, { name: 'Ana Editada', phone: '555-3333', notes: '' })).text()
    ok(html.includes('Ana Editada'), 'edición válida')
    ok((await (await c.get(`/clients/${id}/edit`)).text()).includes('value="555-3333"'), 'form precargado')
    ok((await c.get('/clients/abc/edit')).status === 404, 'id no numérico → 404')
  })

  test('borrado lógico', async () => {
    const id = db.query("SELECT id FROM Clients WHERE name = 'Ana Editada'").get().id
    const html = await (await c.del(`/clients/${id}`)).text()
    ok(!html.includes('Ana Editada') && html.includes('id="clients-tbody"'), 'desaparece de la lista')
    ok(db.query('SELECT is_active FROM Clients WHERE id = ?').get(id).is_active === 0, 'sigue en la DB inactivo')
  })
})
