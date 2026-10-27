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

describe('menos toques en la captura', () => {
  test('el tipo de servicio son botones, no un desplegable', async () => {
    const html = await (await c.get('/')).text()
    ok(!html.includes('<select id="service_type"') && !html.includes('name="service_type" class="input"'), 'ya no es <select>')
    ok(html.includes('role="radiogroup"') && (html.match(/name="service_type"/g) || []).length === 4, 'cuatro radios')
    for (const label of ['Todos', 'Lavandería', 'Planchado', 'Tintorería']) {
      ok(html.includes(`>${label}</label>`), `falta ${label}`)
    }
    // "Todos" es el único que arranca marcado.
    const marcados = html.match(/<input type="radio"[^>]*name="service_type"[^>]*checked/g) || []
    ok(marcados.length === 1 && marcados[0].includes('value=""'), '"Todos" viene marcado y es el único')
    ok(/class="seg"[^>]*hx-trigger="change"[^>]*hx-get="\/orders\/new\/services"/.test(html), 'filtra al cambiar')
  })

  test('el filtro por botones sigue llegando al servidor', async () => {
    await addService(c, 'Traje', 'dry_cleaning', '180', 'service')
    const html = await (await c.get('/orders/new/services?service_type=dry_cleaning')).text()
    ok(html.includes('Traje') && !html.includes('Lavado por kilo'), 'filtra por tipo')
  })

  test('sin coincidencias avisa y marca qué se tecleó', async () => {
    await addClient(c, 'Rosa Pérez', '555-4321')

    let html = await (await c.get('/orders/new/clients?client_search=555-0000')).text()
    ok(html.includes('id="client-no-match"') && html.includes('Sin coincidencias'), 'avisa')
    ok(html.includes('data-kind="phone"') && html.includes('data-term="555-0000"'), 'reconoce un teléfono')
    ok(html.includes('este teléfono') && html.includes('Enter'), 'dice qué hace Enter')

    html = await (await c.get('/orders/new/clients?client_search=Zulema')).text()
    ok(html.includes('data-kind="name"') && html.includes('este nombre'), 'reconoce un nombre')
  })

  test('con coincidencias, la lista es enganchable para elegir la primera', async () => {
    const html = await (await c.get('/orders/new/clients?client_search=Rosa')).text()
    ok(html.includes('id="client-matches"') && !html.includes('client-no-match'), 'lista identificada')
  })

  test('la fecha de entrega tiene atajos y eco en español', async () => {
    const html = await (await c.get('/')).text()
    for (const label of ['Hoy', 'Mañana', 'En 2 días', 'En 3 días']) {
      ok(html.includes(`>${label}</button>`), `falta el atajo ${label}`)
    }
    ok(html.includes('window.fijarEntrega(0)') && html.includes('window.fijarEntrega(3)'), 'atajos enganchados')
    ok(html.includes('id="expected-echo"'), 'hueco para el eco')
    // El calendario nativo sale en el idioma del navegador; el eco no depende
    // de eso porque usa Intl, que trae los idiomas incorporados.
    ok(html.includes("toLocaleDateString('es-MX'"), 'el eco se escribe en español')
    ok(html.includes('hx-on:change="window.mostrarEntrega()"'), 'se actualiza al elegir en el calendario')
  })

  test('la página trae los atajos de teclado', async () => {
    const html = await (await c.get('/')).text()
    ok(html.includes('window.clienteEnter') && html.includes("event.key==='Enter'"), 'Enter en el buscador')
    ok(html.includes('window.limpiarBusquedaCliente'), 'limpieza tras elegir')
    ok(html.includes('id="new-client-submit"'), 'el alta se puede disparar con Enter')
    ok(html.includes('new_client_phone') && html.includes('new_client_name'), 'campos del alta presentes para prellenar')
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
