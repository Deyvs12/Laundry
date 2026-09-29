// Cambio de contraseña, aviso de contraseña por defecto e índices
import { describe, test, beforeAll, afterAll } from 'bun:test'
import { db, startServer, stopServer, resetDb, login, client, ok } from './_helpers.js'
import * as sessions from '../src/services/sessions.js'

let base, c
beforeAll(async () => { resetDb(); base = startServer(); c = client(base, await login(base)) })
afterAll(stopServer)

describe('migración v5', () => {
  test('índices creados sobre las claves foráneas', () => {
    ok(db.query('PRAGMA user_version').get().user_version === 5, 'user_version = 5')
    const idx = db.query("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'").all().map((r) => r.name)
    for (const name of ['idx_order_services_order', 'idx_orders_client', 'idx_orders_shift', 'idx_orders_status',
                        'idx_movements_order', 'idx_movements_shift', 'idx_logs_order', 'idx_clients_name']) {
      ok(idx.includes(name), `falta ${name}`)
    }
  })

  test('el planificador los usa de verdad', () => {
    const plan = (sql, ...p) => db.query(`EXPLAIN QUERY PLAN ${sql}`).all(...p).map((r) => r.detail).join(' | ')
    ok(plan('SELECT * FROM Order_services WHERE id_orders = 1').includes('idx_order_services_order'), 'líneas de un pedido')
    ok(plan("SELECT * FROM Cash_movements WHERE order_id = 1 AND type = 'refund'").includes('idx_movements_order'), 'devolución de un pedido')
    ok(plan('SELECT * FROM Orders WHERE cash_shift_id = 1').includes('idx_orders_shift'), 'cobros de un turno')
    ok(plan('SELECT * FROM Logs WHERE order_id = 1').includes('idx_logs_order'), 'bitácora de un pedido')
  })

  test('Logs acepta USER_PASSWORD_CHANGED', () => {
    ok(db.query("SELECT sql FROM sqlite_master WHERE name = 'Logs'").get().sql.includes('USER_PASSWORD_CHANGED'), 'CHECK')
  })
})

describe('cambio de contraseña', () => {
  const change = (d) => c.post('/account/password', d)
  const good = { current_password: 'admin123', new_password: 'lavanderia2026', confirm_password: 'lavanderia2026' }

  test('la página existe y el nav enlaza a ella', async () => {
    const html = await (await c.get('/account')).text()
    ok(html.includes('Mi cuenta') && html.includes('name="current_password"'), 'formulario')
    ok(html.includes('href="/account"'), 'enlace en el nav')
    ok((await fetch(`${base}/account`, { redirect: 'manual' })).status === 302, 'protegida')
  })

  test('validaciones', async () => {
    const cases = [
      [{ ...good, current_password: '' }, 'Completa los tres campos'],
      [{ ...good, new_password: 'corta1', confirm_password: 'corta1' }, 'al menos 8 caracteres'],
      [{ ...good, confirm_password: 'otra-distinta' }, 'no coinciden'],
      [{ current_password: 'admin123', new_password: 'admin123', confirm_password: 'admin123' }, 'distinta de la actual'],
      [{ ...good, current_password: 'equivocada' }, 'contraseña actual no es correcta']
    ]
    for (const [data, expected] of cases) {
      const html = await (await change(data)).text()
      ok(html.includes(expected), `esperaba "${expected}"`)
    }
    ok(await Bun.password.verify('admin123', db.query("SELECT password FROM Users WHERE username = 'admin'").get().password), 'la contraseña no cambió')
    ok(db.query("SELECT COUNT(*) n FROM Logs WHERE action = 'USER_PASSWORD_CHANGED'").get().n === 0, 'sin registros en bitácora')
  })

  test('cambio correcto: guarda, registra, cierra otras sesiones y deja entrar', async () => {
    const otra = await login(base)
    const otraSid = otra.split('=')[1]
    ok(sessions.get(otraSid) !== null, 'segunda sesión abierta')

    const html = await (await change(good)).text()
    ok(html.includes('Contraseña actualizada'), 'confirma')
    ok(await Bun.password.verify('lavanderia2026', db.query("SELECT password FROM Users WHERE username = 'admin'").get().password), 'guardada y hasheada')
    ok(db.query("SELECT message FROM Logs WHERE action = 'USER_PASSWORD_CHANGED'").get().message.includes('admin'), 'bitácora')
    ok(sessions.get(otraSid) === null, 'la otra sesión se cerró')
    ok((await c.get('/orders')).status === 200, 'la sesión actual sigue viva')
    ok(await login(base, 'admin', 'lavanderia2026') !== null, 'entra con la nueva')
    ok(await login(base, 'admin', 'admin123') === null, 'la vieja ya no sirve')
  })
})

describe('aviso de contraseña por defecto', () => {
  test('aparece con la de fábrica y desaparece al cambiarla', async () => {
    resetDb()
    const cc = client(base, await login(base))
    let html = await (await cc.get('/orders')).text()
    ok(html.includes('Estás usando la contraseña por defecto') && html.includes('href="/account"'), 'banner visible')

    await cc.post('/account/password', { current_password: 'admin123', new_password: 'otra-buena-123', confirm_password: 'otra-buena-123' })
    html = await (await cc.get('/orders')).text()
    ok(!html.includes('Estás usando la contraseña por defecto'), 'banner fuera sin volver a entrar')

    const nueva = client(base, await login(base, 'admin', 'otra-buena-123'))
    ok(!(await (await nueva.get('/orders')).text()).includes('contraseña por defecto'), 'tampoco al entrar de nuevo')
  })
})
