// Bitácora: lectura con filtros y paginación
import { describe, test, beforeAll, afterAll } from 'bun:test'
import { db, startServer, stopServer, resetDb, login, client, ok, addService, addClient, createOrder, daysFromNow } from './_helpers.js'

let base, c, o1, o2
beforeAll(async () => {
  resetDb(); base = startServer(); c = client(base, await login(base))
  await addService(c, 'Lavado kg', 'laundry', '10', 'kilo')
  const cid = await addClient(c, 'Cliente <b>Log</b>')
  o1 = await createOrder(c, cid, [[1, 1]], { discount: '2' })
  o2 = await createOrder(c, cid, [[1, 1]])
  await c.post('/cash/open', { initial_cash: '100' })
  await c.post(`/orders/${o1}/pay`, { payment_method: 'cash' })
  await c.post(`/orders/${o2}/cancel`)
  await c.post('/cash/1/close', { actual_cash: '108' })
})
afterAll(stopServer)

describe('bitácora', () => {
  test('página completa, más recientes primero, enlaces y escapado', async () => {
    const html = await (await c.get('/logs')).text()
    ok(html.includes('Bitácora') && html.includes('Todo el historial'), 'carga sin filtros')
    const first = html.indexOf('Caja cerrada'), last = html.indexOf('Inicio de sesión')
    ok(first !== -1 && last !== -1 && first < last, 'orden descendente')
    ok(html.includes(`href="/orders/${o1}"`) && html.includes('href="/cash/1"'), 'enlaces a pedido y turno')
    ok(html.includes('Descuento') && html.includes('Cobro') && html.includes('Pedido cancelado'), 'etiquetas en español')
    ok(!html.includes('<b>Log</b>'), 'mensaje escapado')
  })

  // El <select> lista todas las acciones: las aserciones miran solo la tabla.
  const body = async (url) => { const h = await (await c.get(url)).text(); return h.slice(h.indexOf('<tbody>')) }

  test('filtros: acción, pedido, fechas, inválidos', async () => {
    let html = await body('/logs?action=ORDER_PAID')
    ok(html.includes('Cobro') && !html.includes('Caja cerrada') && !html.includes('Pedido creado'), 'por acción')
    html = await (await c.get(`/logs?order=${o2}`)).text()
    ok(html.includes(`Pedido #${o2}.`), 'encabezado del filtro')
    html = html.slice(html.indexOf('<tbody>'))
    ok(html.includes('Pedido cancelado') && !html.includes('Descuento'), 'por pedido')
    html = await (await c.get(`/logs?from=${daysFromNow(0)}&to=${daysFromNow(0)}`)).text()
    ok(html.includes('Caja cerrada'), 'hoy incluye todo')
    html = await (await c.get(`/logs?from=${daysFromNow(-10)}&to=${daysFromNow(-5)}`)).text()
    ok(html.includes('Sin movimientos con ese filtro'), 'rango pasado vacío')
    html = await (await c.get('/logs?action=HACK&order=abc&from=x&before=-1')).text()
    ok(html.includes('Todo el historial') && html.includes('Caja cerrada'), 'inválidos se ignoran')
    ok((await fetch(`${base}/logs`, { redirect: 'manual' })).status === 302, 'protegido')
  })

  test('paginación por cursor', async () => {
    const ins = db.query("INSERT INTO Logs (user_id, action, message) VALUES (1, 'USER_LOGIN', ?)")
    db.transaction(() => { for (let i = 1; i <= 150; i++) ins.run(`relleno ${i}`) })()
    let html = await (await c.get('/logs?action=USER_LOGIN')).text()
    ok((html.match(/relleno /g) || []).length === 100 && html.includes('Ver anteriores'), 'primera página de 100 con enlace')
    const next = html.match(/href="(\/logs\?[^"]*before=\d+)"/)[1].replaceAll('&amp;', '&')
    html = await (await c.get(next)).text()
    ok(html.includes('relleno 1<') && !html.includes('relleno 150<'), 'segunda página trae los viejos')
    ok(!html.includes('Ver anteriores'), 'última página sin enlace')
  })

  test('el detalle del pedido enlaza a su bitácora', async () => {
    ok((await (await c.get(`/orders/${o1}`)).text()).includes(`href="/logs?order=${o1}"`), 'enlace')
  })
})
