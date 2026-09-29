// Sistema de diseño: portada, barra de navegación y componentes compartidos
import { describe, test, beforeAll, afterAll } from 'bun:test'
import { db, startServer, stopServer, resetDb, login, client, ok, addService, addClient, ensureStaff } from './_helpers.js'
import { badge, orderStatusBadge, paymentBadge, lineStatusBadge, btn, field, selectField, alert, icon } from '../src/views/components.js'

let base, c
beforeAll(async () => {
  resetDb(); base = startServer(); c = client(base, await login(base))
  await addService(c, 'Lavado por kilo', 'laundry', '25.50', 'kilo')
  ensureStaff('María')
})
afterAll(stopServer)

describe('portada', () => {
  test('la raíz muestra la captura de pedidos, no una bienvenida', async () => {
    const r = await c.get('/')
    const html = await r.text()
    ok(r.status === 200, 'carga')
    ok(html.includes('id="order-form"') && html.includes('name="service_search"'), 'es la pantalla de captura')
    ok(!html.includes('Bienvenido'), 'sin pantalla de bienvenida intermedia')
  })

  test('/orders/new sigue funcionando y da lo mismo', async () => {
    const raiz = await (await c.get('/')).text()
    const nueva = await (await c.get('/orders/new')).text()
    // Solo difieren en qué enlace del nav va resaltado, y en ninguno.
    ok(nueva.includes('id="order-form"') && raiz.includes('id="order-form"'), 'ambas sirven la captura')
  })
})

describe('barra de navegación', () => {
  test('lleva las ocho secciones', async () => {
    const html = await (await c.get('/')).text()
    for (const [href, label] of [['/', 'Nuevo pedido'], ['/orders', 'Pedidos'], ['/clients', 'Clientes'],
                                 ['/services', 'Servicios'], ['/staff', 'Personal'], ['/cash', 'Caja'],
                                 ['/reports', 'Reportes'], ['/logs', 'Bitácora']]) {
      ok(html.includes(`href="${href}"`) && html.includes(`<span>${label}</span>`), `falta ${label}`)
    }
  })

  test('resalta la sección en la que estás', async () => {
    // Del enlace activo se extrae la etiqueta que lo acompaña.
    const activo = async (path) => {
      const html = await (await c.get(path)).text()
      const m = html.match(/nav-link nav-link-active[\s\S]*?<span>([^<]+)<\/span>/)
      return m?.[1] ?? null
    }
    ok((await activo('/')) === 'Nuevo pedido', 'raíz')
    ok((await activo('/orders/new')) === 'Nuevo pedido', 'captura')
    ok((await activo('/orders')) === 'Pedidos', 'listado')
    ok((await activo('/clients')) === 'Clientes', 'clientes')
    ok((await activo('/cash')) === 'Caja', 'caja')
    ok((await activo('/reports')) === 'Reportes', 'reportes')
    ok((await activo('/logs')) === 'Bitácora', 'bitácora')
  })

  test('un pedido concreto resalta Pedidos, no Nuevo pedido', async () => {
    const cid = await addClient(c, 'Ana')
    const r = await c.post('/orders', new URLSearchParams([
      ['line_service_id[]', '1'], ['line_quantity[]', '1'],
      ['id_client', String(cid)], ['id_staff', String(ensureStaff('María'))]
    ]))
    const id = Number(r.headers.get('hx-redirect').split('/').pop())
    const html = await (await c.get(`/orders/${id}`)).text()
    const m = html.match(/nav-link nav-link-active[\s\S]*?<span>([^<]+)<\/span>/)
    ok(m?.[1] === 'Pedidos', `resaltó ${m?.[1]}`)
  })

  test('el indicador de caja refleja su estado', async () => {
    ok((await (await c.get('/')).text()).includes('Caja cerrada'), 'cerrada')
    await c.post('/cash/open', { initial_cash: '100' })
    const html = await (await c.get('/')).text()
    ok(html.includes('Caja abierta') && html.includes('#1'), 'abierta con folio')
    await c.post('/cash/1/close', { actual_cash: '100' })
    ok((await (await c.get('/')).text()).includes('Caja cerrada'), 'cerrada de nuevo')
  })
})

describe('componentes', () => {
  test('cada estado de pedido tiene su color', () => {
    const tone = (html) => html.match(/badge-(\w+)/)?.[1]
    ok(tone(orderStatusBadge('received')) === 'neutral', 'recibido en gris')
    ok(tone(orderStatusBadge('in_process')) === 'work', 'en proceso en ámbar')
    ok(tone(orderStatusBadge('ready')) === 'ready', 'listo en verde')
    ok(tone(orderStatusBadge('delivered')) === 'done', 'entregado en marca')
    ok(tone(orderStatusBadge('cancelled')) === 'danger', 'cancelado en rojo')
    ok(orderStatusBadge('ready').includes('Listo'), 'con su etiqueta en español')
    ok(tone(lineStatusBadge('ready')) === 'ready' && tone(lineStatusBadge('in_process')) === 'work', 'líneas')
  })

  test('el distintivo de pago distingue los tres casos', () => {
    ok(paymentBadge({ paid: 0 }).includes('Pendiente'), 'pendiente')
    ok(paymentBadge({ paid: 1, payment_method: 'cash' }).includes('Efectivo'), 'pagado con su forma')
    ok(paymentBadge({ paid: 1, refund_id: 3 }).includes('Devuelto'), 'devuelto')
  })

  test('escapan el contenido que reciben', () => {
    ok(badge('<script>x</script>').includes('&lt;script&gt;'), 'distintivo')
    ok(field({ label: 'X', name: 'n', value: '"><b>' }).includes('&quot;&gt;&lt;b&gt;'), 'campo')
    ok(selectField({ label: 'X', name: 'n', options: [{ value: '<b>', label: '<i>' }] }).includes('&lt;i&gt;'), 'selector')
  })

  test('los botones cumplen el tamaño mínimo táctil', () => {
    ok(btn({ label: 'A' }).includes('btn btn-primary'), 'clases base')
    ok(btn({ label: 'A', size: 'lg', block: true }).includes('btn-lg btn-block'), 'grande y ancho')
    ok(btn({ label: 'A', iconName: 'check' }).includes('<svg'), 'con icono')
  })

  test('los avisos tienen tono y los iconos existen', () => {
    ok(alert({ tone: 'danger', message: 'x' }).includes('alert alert-danger'), 'aviso')
    ok(alert({ message: null }) === '', 'sin mensaje no pinta nada')
    ok(icon('cash').includes('<svg') && icon('inexistente') === '', 'iconos')
  })
})
