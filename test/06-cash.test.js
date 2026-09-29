// Fase 5: corte de caja
import { describe, test, beforeAll, afterAll } from 'bun:test'
import { db, startServer, stopServer, resetDb, login, client, ok, addService, addClient, createOrder, orderRow } from './_helpers.js'

let base, A, E, cid, o1, o2, o3, o4, oCash
const shift = (id) => db.query('SELECT * FROM Cash_shifts WHERE id = ?').get(id)
const newOrder = (qty) => createOrder(A, cid, [[1, qty]])   // $40/kg

beforeAll(async () => {
  resetDb(); base = startServer()
  A = client(base, await login(base))
  db.query("INSERT INTO Users (username, name, password, role) VALUES ('emp', 'Empleada Uno', ?, 'employee')").run(await Bun.password.hash('emp123'))
  E = client(base, await login(base, 'emp', 'emp123'))
  await addService(A, 'Lavado kg', 'laundry', '40', 'kilo')
  cid = await addClient(A, 'Cliente Caja')
  o1 = await newOrder(1); o2 = await newOrder(2); o3 = await newOrder(0.5); o4 = await newOrder(3)  // 40, 80, 20, 120
})
afterAll(stopServer)

describe('sin turno', () => {
  test('página de apertura; cobros sin turno se registran y se muestran aparte', async () => {
    let html = await (await A.get('/cash')).text()
    ok(html.includes('No hay turno abierto') && html.includes('name="initial_cash"') && html.includes('Caja cerrada'), 'formulario + nav')
    ok(html.includes('Aún no hay cortes cerrados') && !html.includes('Cobros sin turno'), 'vacío')
    ok((await (await A.get(`/orders/${o1}`)).text()).includes('quedará registrado <strong>sin turno</strong>'), 'detalle avisa')
    await A.post(`/orders/${o4}/pay`, { payment_method: 'transfer' })
    oCash = await newOrder(1)
    await A.post(`/orders/${oCash}/pay`, { payment_method: 'cash' })
    ok(orderRow(o4).paid === 1 && orderRow(o4).cash_shift_id === null, 'transferencia sin turno')
    ok(orderRow(oCash).paid === 1 && orderRow(oCash).cash_shift_id === null, 'EFECTIVO sin turno permitido')
    ok(db.query(`SELECT message FROM Logs WHERE order_id = ? AND action = 'ORDER_PAID'`).get(oCash).message.includes('SIN turno'), 'log marcado')
    html = await (await A.get('/cash')).text()
    ok(html.includes('Cobros sin turno de hoy'), 'sección visible')
    ok(html.includes('Efectivo: <strong>$40.00</strong> (1)') && html.includes('Transferencias: <strong>$120.00</strong> (1)'), 'totales sin turno')
    ok(html.includes(`/orders/${oCash}"`) && html.includes(`/orders/${o4}"`), 'lista ambos')
  })
})

describe('abrir', () => {
  test('validación, apertura por empleada, doble apertura', async () => {
    let r = await A.post('/cash/open', { initial_cash: 'abc' })
    ok(!r.headers.get('hx-redirect') && (await r.text()).includes('mayor o igual a 0'), 'fondo inválido')
    ok(db.query('SELECT COUNT(*) n FROM Cash_shifts').get().n === 0, 'nada abierto')
    r = await E.post('/cash/open', { initial_cash: '500,50' })
    ok(r.headers.get('hx-redirect') === '/cash', 'redirect')
    const s = shift(1)
    ok(s.status === 'open' && s.initial_cash === 500.5 && s.user_id === 2, 'abierto por empleada, coma decimal')
    ok(db.query("SELECT cash_shift_id FROM Logs WHERE action = 'SHIFT_OPENED'").get()?.cash_shift_id === 1, 'log')
    r = await A.post('/cash/open', { initial_cash: '100' })
    ok((await r.text()).includes('Ya hay un turno abierto') && db.query('SELECT COUNT(*) n FROM Cash_shifts').get().n === 1, 'segundo rechazado')
    ok((await (await A.get('/orders')).text()).includes('Caja abierta'), 'nav')
  })
})

describe('cobros dentro del turno', () => {
  test('se ligan al turno y el panel suma bien', async () => {
    await A.post(`/orders/${o1}/pay`, { payment_method: 'cash' })
    await E.post(`/orders/${o2}/pay`, { payment_method: 'cash' })
    await A.post(`/orders/${o3}/pay`, { payment_method: 'transfer' })
    ok(db.query('SELECT COUNT(*) n FROM Orders WHERE cash_shift_id = 1').get().n === 3, '3 ligados')
    const html = await (await A.get('/cash')).text()
    ok(html.includes('Turno #1 abierto') && html.includes('Empleada Uno'), 'panel')
    ok(html.includes('Efectivo cobrado (2)') && html.includes('$120.00'), 'efectivo 40+80')
    ok(html.includes('Transferencias (1)') && html.includes('$20.00'), 'transferencia')
    ok(html.includes('$620.50'), 'esperado = 500.50 + 120')
    ok([o1, o2, o3].every((id) => html.includes(`/orders/${id}"`)), 'lista cobros del turno')
    ok(html.indexOf(`/orders/${oCash}"`) > html.indexOf('Cobros sin turno'), 'los sin turno siguen aparte')
    ok((await (await A.get(`/orders/${o1}`)).text()).includes('href="/cash/1"'), 'detalle enlaza al turno')
  })
})

describe('devoluciones en el turno', () => {
  test('restan del esperado, se listan y se ligan al turno', async () => {
    const o = await newOrder(2)   // $80
    await A.post(`/orders/${o}/pay`, { payment_method: 'cash' })
    await A.post(`/orders/${o}/cancel`)
    const refund = db.query("SELECT * FROM Cash_movements WHERE order_id = ?").get(o)
    ok(refund.cash_shift_id === 1 && refund.method === 'cash' && refund.amount === 80, 'ligada al turno 1')
    const html = await (await A.get('/cash')).text()
    ok(html.includes('Devoluciones (1)') && html.includes('$80.00 en efectivo'), 'aviso en el panel')
    ok(html.includes('>Devoluciones<') && html.includes('−$80.00'), 'tabla de devoluciones')
    // esperado: 500.50 + (120 + 80 cobrados) − 80 devueltos = 620.50
    ok(html.includes('$620.50'), 'esperado descuenta la devolución')
    ok(db.query("SELECT message FROM Logs WHERE action = 'ORDER_REFUNDED'").get().message.includes('turno #1'), 'log con turno')
  })
})

describe('cerrar', () => {
  test('validación, cierre por admin, diferencia, log, detalle', async () => {
    let r = await A.post('/cash/1/close', { actual_cash: '-5' })
    ok((await r.text()).includes('mayor o igual a 0') && shift(1).status === 'open', 'negativo rechazado')
    r = await A.post('/cash/1/close', { actual_cash: '600' })
    ok(r.headers.get('hx-redirect') === '/cash/1', 'redirect al detalle')
    const s = shift(1)
    ok(s.status === 'closed' && s.expected_cash === 620.5 && s.actual_cash === 600 && s.difference === -20.5, 'cifras')
    ok(s.closed_by === 1 && s.user_id === 2 && typeof s.closing_time === 'string', 'cerró admin, abrió empleada')
    const m = db.query("SELECT message FROM Logs WHERE action = 'SHIFT_CLOSED'").get().message
    ok(m.includes('620.50') && m.includes('600.00') && m.includes('-20.50'), 'log con cifras')
    ok((await (await A.post('/cash/1/close', { actual_cash: '600' })).text()).includes('ya está cerrado'), 'doble cierre')
    let html = await (await A.get('/cash/1')).text()
    ok(html.includes('cerrado') && html.includes('Administrador') && html.includes('(falta)') && html.includes('$20.50'), 'detalle')
    ok(html.includes('Devoluciones (1)') && html.includes('−$80.00'), 'detalle del turno lista la devolución')
    html = await (await A.get('/cash')).text()
    ok(html.includes('No hay turno abierto') && html.includes('href="/cash/1"') && html.includes('$620.50'), 'vuelve a apertura + histórico')
  })

  test('tras cerrar, el efectivo se registra sin turno y aparece aparte', async () => {
    const o = await newOrder(1)
    await A.post(`/orders/${o}/pay`, { payment_method: 'cash' })
    ok(orderRow(o).paid === 1 && orderRow(o).cash_shift_id === null, 'sin turno')
    ok((await (await A.get('/cash')).text()).includes('Efectivo: <strong>$80.00</strong> (2)'), 'suma con el anterior')
  })

  test('los cobros sin turno de días anteriores dejan de mostrarse (sin borrarse)', async () => {
    const o = await newOrder(1)
    await A.post(`/orders/${o}/pay`, { payment_method: 'cash' })
    let html = await (await A.get('/cash')).text()
    ok(html.includes('Efectivo: <strong>$120.00</strong> (3)'), 'hoy cuenta')
    db.query(`UPDATE Orders SET payment_day = datetime('now', '-1 day') WHERE id = ?`).run(o)
    html = await (await A.get('/cash')).text()
    ok(html.includes('Efectivo: <strong>$80.00</strong> (2)') && !html.includes(`/orders/${o}"`), 'el de ayer ya no aparece')
    ok(orderRow(o).paid === 1, 'pero sigue pagado en la DB')
    db.query(`UPDATE Orders SET payment_day = datetime('now', '-3 hours') WHERE id IN (SELECT id FROM Orders WHERE paid = 1 AND cash_shift_id IS NULL)`).run()
  })

  test('devolución sin turno aparece en "sin turno de hoy"', async () => {
    const o = await newOrder(1)   // $40
    await A.post(`/orders/${o}/pay`, { payment_method: 'transfer' })
    await A.post(`/orders/${o}/cancel`)
    ok(db.query('SELECT cash_shift_id FROM Cash_movements WHERE order_id = ?').get(o).cash_shift_id === null, 'sin turno')
    const html = await (await A.get('/cash')).text()
    ok(html.includes('−$40.00</strong> transferencia'), 'resumen sin turno incluye la devolución')
  })

  test('cuadra, sobra, fondo cero, abierto no está en histórico', async () => {
    await A.post('/cash/open', { initial_cash: '200' })
    const o5 = await newOrder(1)
    await A.post(`/orders/${o5}/pay`, { payment_method: 'cash' })
    await A.post('/cash/2/close', { actual_cash: '240' })
    ok(shift(2).difference === 0 && (await (await A.get('/cash/2')).text()).includes('Cuadra'), 'cuadra')
    await A.post('/cash/open', { initial_cash: '0' })
    await A.post('/cash/3/close', { actual_cash: '7.25' })
    ok(shift(3).difference === 7.25 && (await (await A.get('/cash')).text()).includes('(sobra)'), 'sobra')
    await A.post('/cash/open', { initial_cash: '50' })
    const html = await (await A.get('/cash')).text()
    ok(html.includes('Turno #4 abierto') && !html.includes('href="/cash/4"'), 'abierto solo en panel')
  })

  test('404, protección, atomicidad', async () => {
    ok((await A.get('/cash/999')).status === 404, '404')
    ok((await fetch(`${base}/cash`, { redirect: 'manual' })).status === 302, 'protegido')
    db.exec(`CREATE TRIGGER boom BEFORE INSERT ON Logs WHEN NEW.action = 'SHIFT_CLOSED' BEGIN SELECT RAISE(ABORT, 'boom'); END`)
    let threw = false
    try { (await import('../src/services/cash_shifts.js')).close({ shiftId: 4, userId: 1, actualCash: 50 }) } catch { threw = true }
    db.exec('DROP TRIGGER boom')
    ok(threw && shift(4).status === 'open' && shift(4).closed_by === null, 'cierre revertido')
  })
})
