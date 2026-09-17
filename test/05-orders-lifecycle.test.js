// Fase 3: máquina de estados, regla 9, cobro, entrega, cancelación, filtros
import { describe, test, beforeAll, afterAll } from 'bun:test'
import { db, startServer, stopServer, resetDb, login, client, ok, addService, addClient, createOrder, orderRow, logsOf, lineIds } from './_helpers.js'

let base, c, cid, cid2, A, B, C
const st = (id) => orderRow(id).status
beforeAll(async () => {
  resetDb(); base = startServer(); c = client(base, await login(base))
  await addService(c, 'Lavado kg', 'laundry', '30', 'kilo')
  await addService(c, 'Camisa', 'ironing', '15', 'unit')
  cid = await addClient(c, 'Ana López', '555-0001')
  cid2 = await addClient(c, 'Beto Ruiz', '555-0002')
  A = await createOrder(c, cid, [[1, 2], [2, 3]], { expected_delivery_date: '2026-09-20' })
  B = await createOrder(c, cid2, [[1, 2], [2, 3]], { expected_delivery_date: '2026-09-15' })
  C = await createOrder(c, cid, [[1, 2], [2, 3]])
})
afterAll(stopServer)

describe('regla 9: ready automático y su inversa', () => {
  test('líneas → estado del pedido', async () => {
    const [l1, l2] = lineIds(A)
    ok(st(A) === 'received', 'arranca received')
    let html = await (await c.post(`/orders/${A}/lines/${l1}/toggle`)).text()
    ok(html.includes('id="order-detail"'), 'devuelve #order-detail')
    ok(st(A) === 'in_process', '1 de 2 → in_process')
    ok(html.includes('Regresar a proceso') && html.includes('Marcar listo'), 'botones por línea')
    html = await (await c.post(`/orders/${A}/lines/${l2}/toggle`)).text()
    ok(st(A) === 'ready', '2 de 2 → ready AUTOMÁTICO')
    ok(html.includes('Cobra el pedido para poder entregarlo'), 'entregar bloqueado sin pago')
    await c.post(`/orders/${A}/lines/${l2}/toggle`)
    ok(st(A) === 'in_process', 'regresar una → in_process')
    ok(logsOf(A).filter((l) => l.action === 'ORDER_STATUS_CHANGED').length === 3, 'cada cambio en bitácora')
    await c.post(`/orders/${A}/ready-all`)
    ok(st(A) === 'ready', 'marcar todo listo')
  })
})

describe('cobro', () => {
  test('entregar exige pago; validación de método; doble cobro', async () => {
    let html = await (await c.post(`/orders/${A}/deliver`)).text()
    ok(html.includes('Cobra el pedido antes de entregarlo') && st(A) === 'ready', 'sin pagar → rechazado')
    html = await (await c.post(`/orders/${A}/pay`, { payment_method: 'bitcoin' })).text()
    ok(html.includes('Selecciona la forma de pago') && orderRow(A).paid === 0, 'método inválido')
    html = await (await c.get(`/orders/${B}`)).text()
    ok(html.includes('quedará registrado <strong>sin turno</strong>'), 'detalle avisa que no hay turno (sin bloquear)')
    html = await (await c.post(`/orders/${A}/pay`, { payment_method: 'transfer' })).text()
    const o = orderRow(A)
    ok(o.paid === 1 && o.payment_method === 'transfer' && typeof o.payment_day === 'string', 'cobrado')
    ok(o.cash_shift_id === null, 'sin turno → NULL')
    ok(logsOf(A).some((l) => l.action === 'ORDER_PAID' && l.message.includes('SIN turno')), 'log avisa SIN turno')
    ok(html.includes('Pagado · Transferencia') && !html.includes(`/orders/${A}/pay"`) && !html.includes('/cancel"'), 'detalle actualizado')
    html = await (await c.post(`/orders/${A}/pay`, { payment_method: 'cash' })).text()
    ok(html.includes('ya está pagado'), 'doble cobro')
  })

  test('cobro en efectivo se liga al turno abierto', async () => {
    db.query('INSERT INTO Cash_shifts (user_id, initial_cash) VALUES (1, 500)').run()
    await c.post(`/orders/${B}/pay`, { payment_method: 'cash' })
    ok(orderRow(B).cash_shift_id === 1, 'cash_shift_id = 1')
    ok(logsOf(B).find((l) => l.action === 'ORDER_PAID').cash_shift_id === 1, 'log lleva turno')
    db.query("UPDATE Cash_shifts SET status = 'closed' WHERE id = 1").run()
  })
})

describe('entregar y cancelar', () => {
  test('delivered es final', async () => {
    let html = await (await c.post(`/orders/${A}/deliver`)).text()
    ok(st(A) === 'delivered' && html.includes('No admite más cambios') && !html.includes('Marcar listo'), 'entregado')
    html = await (await c.post(`/orders/${A}/lines/${lineIds(A)[0]}/toggle`)).text()
    ok(html.includes('ya no admite cambios') && st(A) === 'delivered', 'línea bloqueada')
    await c.post(`/orders/${A}/cancel`)
    ok(st(A) === 'delivered', 'cancelar bloqueado')
  })

  test('cancelar', async () => {
    let html = await (await c.post(`/orders/${B}/cancel`)).text()
    ok(html.includes('requiere devolución') && st(B) === 'received', 'pagado → rechazado')
    await c.post(`/orders/${C}/start`)
    ok(st(C) === 'in_process', 'iniciar manual')
    ok((await (await c.post(`/orders/${C}/start`)).text()).includes('ya está en proceso'), 'iniciar dos veces')
    await c.post(`/orders/${C}/cancel`)
    ok(st(C) === 'cancelled' && logsOf(C).some((l) => l.action === 'ORDER_CANCELLED' && l.message.includes('en proceso')), 'cancelado con log')
    ok((await (await c.post(`/orders/${C}/pay`, { payment_method: 'cash' })).text()).includes('cancelado no se puede cobrar'), 'cobrar cancelado')
  })

  test('otras transiciones prohibidas', async () => {
    ok((await (await c.post(`/orders/${B}/deliver`)).text()).includes('que esté listo'), 'entregar un received')
    ok((await (await c.post(`/orders/${B}/lines/${lineIds(A)[0]}/toggle`)).text()).includes('no pertenece'), 'línea ajena')
    ok((await c.post('/orders/9999/start')).status === 404, 'inexistente')
  })
})

describe('listado con filtros', () => {
  // A delivered (20/09), B received (15/09), C cancelled (sin fecha)
  const has = (html, id) => html.includes(`/orders/${id}"`)
  test('activos por defecto, todos, por estado, por cliente', async () => {
    let html = await (await c.get('/orders')).text()
    ok(has(html, B) && !has(html, A) && !has(html, C), 'activos')
    ok(html.includes('name="status"') && html.includes('name="client"'), 'filtros')
    html = await (await c.get('/orders/list?status=all')).text()
    ok([A, B, C].every((id) => has(html, id)) && html.includes('class="text-slate-400"'), 'todos, cancelado atenuado')
    html = await (await c.get('/orders/list?status=delivered')).text()
    ok(has(html, A) && !has(html, B), 'por estado')
    html = await (await c.get('/orders/list?status=all&client=beto')).text()
    ok(has(html, B) && !has(html, A), 'por nombre')
    html = await (await c.get('/orders/list?status=all&client=555-0001')).text()
    ok(has(html, A) && has(html, C) && !has(html, B), 'por teléfono')
    ok(has(await (await c.get('/orders/list?status=hackeado')).text(), B), 'estado inválido → activos')
  })

  test('orden: urgente primero, sin fecha al final; histórico por folio', async () => {
    const D = await createOrder(c, cid, [[1, 1]], { expected_delivery_date: '2026-09-10' })
    const E = await createOrder(c, cid, [[1, 1]])
    let html = await (await c.get('/orders/list')).text()
    const pos = (id) => html.indexOf(`/orders/${id}"`)
    ok(pos(D) < pos(B) && pos(B) < pos(E), 'D < B < E')
    html = await (await c.get('/orders/list?status=all')).text()
    ok(html.indexOf(`/orders/${E}"`) < html.indexOf(`/orders/${A}"`), 'folio descendente')
  })

  test('nombre con comillas y tags escapado', async () => {
    db.query(`UPDATE Clients SET name = 'Eva "x" <b>' WHERE id = ?`).run(cid2)
    ok((await (await c.get(`/orders/${B}`)).text()).includes('Eva &quot;x&quot; &lt;b&gt;'), 'escapado')
  })
})

describe('atomicidad', () => {
  test('si falla el log, el cobro se revierte', async () => {
    const D = await createOrder(c, cid, [[1, 1]])
    const before = db.query("SELECT COUNT(*) n FROM Logs WHERE action = 'ORDER_PAID'").get().n
    db.exec(`CREATE TRIGGER boom BEFORE INSERT ON Logs WHEN NEW.action = 'ORDER_PAID' AND NEW.order_id = ${D} BEGIN SELECT RAISE(ABORT, 'boom'); END`)
    let threw = false
    try { (await import('../src/services/orders.js')).pay(D, 'cash', 1) } catch { threw = true }
    db.exec('DROP TRIGGER boom')
    ok(threw && orderRow(D).paid === 0 && db.query("SELECT COUNT(*) n FROM Logs WHERE action = 'ORDER_PAID'").get().n === before, 'rollback')
  })
})
