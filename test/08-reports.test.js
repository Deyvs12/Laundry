// Fase 6: reportes y respaldo
import { describe, test, beforeAll, afterAll } from 'bun:test'
import { db, startServer, stopServer, resetDb, login, client, ok, addService, addClient, createOrder, daysFromNow } from './_helpers.js'

let base, c, ana, beto
const setPaid = (id, method, localDate, hour = '12:00:00') =>
  db.query(`UPDATE Orders SET paid = 1, payment_method = ?, payment_day = datetime(?, 'utc') WHERE id = ?`).run(method, `${localDate} ${hour}`, id)

beforeAll(async () => {
  resetDb(); base = startServer(); c = client(base, await login(base))
  await addService(c, 'Lavado kg', 'laundry', '10', 'kilo')        // 1
  await addService(c, 'Camisa', 'ironing', '20', 'unit')           // 2
  await addService(c, 'Traje', 'dry_cleaning', '100', 'service')   // 3
  ana = await addClient(c, 'Ana', '555-1')
  beto = await addClient(c, 'Beto', '555-2')
  // hoy: Ana 2×10 efectivo (20) + Beto 1 camisa transferencia (20)
  setPaid(await createOrder(c, ana, [[1, 2]]), 'cash', daysFromNow(0))
  setPaid(await createOrder(c, beto, [[2, 1]]), 'transfer', daysFromNow(0))
  // hace 3 días: Ana traje con 10 de descuento, efectivo (90)
  setPaid(await createOrder(c, ana, [[3, 1]], { discount: '10' }), 'cash', daysFromNow(-3))
  // hace 40 días: Beto 5 camisas efectivo (100)
  setPaid(await createOrder(c, beto, [[2, 5]]), 'cash', daysFromNow(-40))
  // sin pagar: no debe contar
  await createOrder(c, ana, [[3, 1]])
})
afterAll(stopServer)

describe('consultas', () => {
  test('resumen por rango (fecha de cobro, solo pagados)', async () => {
    const r = (await import('../src/services/reports.js')).summary({ from: daysFromNow(-7), to: daysFromNow(0) })
    ok(r.orders === 3 && r.revenue === 130 && r.discounts === 10, `orders=${r.orders} revenue=${r.revenue} disc=${r.discounts}`)
    ok(r.average === 43.33, `promedio ${r.average}`)
  })

  test('por día, semana y mes', async () => {
    const rep = await import('../src/services/reports.js')
    const range = { from: daysFromNow(-60), to: daysFromNow(0) }
    const days = rep.revenueByPeriod({ ...range, group: 'day' })
    ok(days.length === 3 && days[0].period === daysFromNow(0) && days[0].cash === 20 && days[0].transfer === 20 && days[0].total === 40, 'por día: hoy 20+20')
    const months = rep.revenueByPeriod({ ...range, group: 'month' })
    ok(months.every((m) => /^\d{4}-\d{2}$/.test(m.period)) && months.reduce((s, m) => s + m.total, 0) === 230, 'por mes suma 230')
    const weeks = rep.revenueByPeriod({ ...range, group: 'week' })
    ok(weeks.every((w) => new Date(`${w.period}T12:00:00`).getDay() === 1), 'semanas etiquetadas con su lunes')
    ok(weeks.reduce((s, w) => s + w.total, 0) === 230, 'por semana suma 230')
  })

  test('por tipo (bruto), por forma de pago, top clientes', async () => {
    const rep = await import('../src/services/reports.js')
    const range = { from: daysFromNow(-60), to: daysFromNow(0) }
    const types = Object.fromEntries(rep.byServiceType(range).map((t) => [t.type, t]))
    ok(types.laundry.gross === 20 && types.ironing.gross === 120 && types.dry_cleaning.gross === 100, 'bruto por tipo (traje 100 sin descuento)')
    const methods = Object.fromEntries(rep.byPaymentMethod(range).map((m) => [m.method, m]))
    ok(methods.cash.total === 210 && methods.cash.orders === 3 && methods.transfer.total === 20, 'por forma de pago')
    const top = rep.topClients(range)
    ok(top[0].name === 'Beto' && top[0].total === 120 && top[1].name === 'Ana' && top[1].total === 110, 'top clientes por total')
  })
})

describe('devoluciones', () => {
  test('se restan el día que ocurren, por forma de pago y en el neto', async () => {
    const rep = await import('../src/services/reports.js')
    const today = { from: daysFromNow(0), to: daysFromNow(0) }
    const before = rep.summary(today)
    const o = await createOrder(c, ana, [[2, 2]])   // $40
    setPaid(o, 'transfer', daysFromNow(-3))          // cobrado hace 3 días
    await c.post(`/orders/${o}/cancel`)              // devuelto HOY
    const after = rep.summary(today)
    ok(after.orders === before.orders && after.refunds === 40 && after.refund_count === 1, 'hoy: mismos cobros, 1 devolución de 40')
    ok(after.revenue === before.revenue - 40, 'neto de hoy baja 40')
    const days = rep.revenueByPeriod({ from: daysFromNow(-7), to: daysFromNow(0), group: 'day' })
    const todayRow = days.find((d) => d.period === daysFromNow(0))
    ok(todayRow.refunds === 40 && todayRow.net === todayRow.total - 40, 'fila de hoy con devolución y neto')
    const m = Object.fromEntries(rep.byPaymentMethod({ from: daysFromNow(-7), to: daysFromNow(0) }).map((x) => [x.method, x]))
    ok(m.transfer.refunds === 40 && m.transfer.net === m.transfer.total - 40, 'por forma de pago')
    const html = await (await c.get('/reports?preset=today')).text()
    ok(html.includes('Devoluciones (1)') && html.includes('−$40.00'), 'tarjeta y tabla')
  })
})

describe('página', () => {
  test('presets, rango personalizado, agrupación, validación', async () => {
    let html = await (await c.get('/reports?preset=today')).text()
    ok(html.includes('$40.00') && html.includes('Pedidos cobrados') && html.includes('>2<'), 'hoy: 2 pedidos, $40')
    html = await (await c.get(`/reports?from=${daysFromNow(-60)}&to=${daysFromNow(0)}&group=month`)).text()
    ok(html.includes('$230.00') && html.includes('Ingresos por mes'), 'rango + mes')
    ok(html.includes('Beto') && html.includes('Tintorería') && html.includes('Transferencia'), 'secciones')
    html = await (await c.get('/reports?from=2026-13-99&to=abc')).text()
    ok(html.includes('Reportes') && !html.includes('2026-13-99'), 'fechas inválidas → cae en "este mes"')
    html = await (await c.get(`/reports?from=${daysFromNow(0)}&to=${daysFromNow(-5)}`)).text()
    ok(html.includes('Reportes'), 'desde > hasta no rompe')
    html = await (await c.get('/reports?preset=last_month')).text()
    ok(html.includes('Sin cobros en este periodo') || html.includes('$100.00'), 'mes anterior renderiza')
    ok((await fetch(`${base}/reports`, { redirect: 'manual' })).status === 302, 'protegido')
  })
})

describe('respaldo', () => {
  test('crear, listar, descargar, rechazar rutas', async () => {
    let html = await (await c.get('/reports')).text()
    ok(html.includes('Aún no hay respaldos'), 'vacío')
    html = await (await c.post('/backups')).text()
    ok(html.includes('Respaldo creado: lavanderia-') && html.includes('Descargar'), 'creado')
    const name = html.match(/lavanderia-[\d-]+\.db/)[0]
    const r = await c.get(`/backups/${name}`)
    ok(r.status === 200 && r.headers.get('content-disposition').includes(name), 'descarga')
    const buf = new Uint8Array(await r.arrayBuffer())
    ok(new TextDecoder().decode(buf.slice(0, 15)) === 'SQLite format 3', 'es un archivo SQLite')
    const { Database } = await import('bun:sqlite')
    const copy = new Database(`${process.env.LAVANDERIA_BACKUPS}/${name}`, { readonly: true })
    ok(copy.query('SELECT COUNT(*) n FROM Orders').get().n === db.query('SELECT COUNT(*) n FROM Orders').get().n, 'la copia tiene los mismos pedidos que la base')
    copy.close()
    ok((await c.get('/backups/..%2Ftest.db')).status === 404, 'traversal rechazado')
    ok((await c.get('/backups/otro.db')).status === 404, 'nombre ajeno rechazado')
    html = await (await c.post('/backups')).text()
    ok((html.match(/Descargar/g) || []).length === 2, 'segundo respaldo en el mismo minuto no choca')
  })
})
