// Módulo de impresión de tickets. No necesita la impresora: escribe en un
// archivo temporal en su lugar y revisa los bytes.
import { describe, test, beforeAll, afterAll } from 'bun:test'
import { mkdtempSync, readFileSync, writeFileSync, chmodSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { startServer, stopServer, resetDb, login, client, ok } from './_helpers.js'
import { encode, normalize } from '../src/printer/cp850.js'
import { COLS, wrap, row, rule } from '../src/printer/columns.js'
import { Ticket, INIT, FEED_LINES } from '../src/printer/escpos.js'
import { print, PrinterError } from '../src/printer/device.js'
import { testTicket, commandsTestTicket } from '../src/printer/test-ticket.js'

const dir = mkdtempSync(join(tmpdir(), 'ticketera-'))
const fresh = (name) => {
  const p = join(dir, name)
  writeFileSync(p, '')
  return p
}
const bytesOf = (p) => new Uint8Array(readFileSync(p))
const startsWith = (b, prefix) => prefix.every((x, i) => b[i] === x)
const len = (s) => [...s].length

describe('cp850', () => {
  test('acentos, eñe y signos de apertura', () => {
    const cases = { 'á': 0xa0, 'é': 0x82, 'í': 0xa1, 'ó': 0xa2, 'ú': 0xa3, 'ü': 0x81, 'ñ': 0xa4, 'Ñ': 0xa5,
                    'Á': 0xb5, 'É': 0x90, 'Í': 0xd6, 'Ó': 0xe0, 'Ú': 0xe9, 'Ü': 0x9a, '¿': 0xa8, '¡': 0xad }
    for (const [ch, byte] of Object.entries(cases)) ok(encode(ch)[0] === byte, `${ch} → 0x${byte.toString(16)}`)
  })

  test('ASCII pasa igual y lo desconocido sale como ?', () => {
    ok(Buffer.from(encode('Total $85.00')).toString('latin1') === 'Total $85.00', 'ASCII')
    ok(encode('日')[0] === 0x3f && encode('日').length === 1, 'carácter sin equivalente')
  })

  test('acentos descompuestos (NFD) se juntan antes de codificar', () => {
    const nfd = 'ñ'
    ok(encode(nfd).length === 1 && encode(nfd)[0] === 0xa4, 'n + tilde combinante → ñ')
  })

  test('sustituciones y caracteres de control', () => {
    ok(normalize('“Hola” – adiós…') === '"Hola" - adiós...', 'comillas, guion y puntos')
    ok(normalize('a\x1b@b\x1dc') === 'a@bc', 'sin ESC ni GS: no se pueden inyectar comandos')
    ok(normalize('uno\ndos') === 'uno\ndos', 'el salto de línea se conserva')
  })
})

describe('columnas', () => {
  test('wrap nunca pasa de 32 y no corta palabras que caben', () => {
    const lines = wrap('Este renglón es largo a propósito para comprobar que el texto se parte entre palabras.')
    ok(lines.length > 1, 'se partió')
    ok(lines.every((l) => len(l) <= COLS), 'ninguna línea pasa de 32')
    ok(lines.join(' ') === 'Este renglón es largo a propósito para comprobar que el texto se parte entre palabras.', 'sin perder palabras')
  })

  test('wrap corta a la fuerza una palabra más larga que el renglón', () => {
    const word = 'x'.repeat(70)
    const lines = wrap(word)
    ok(lines.length === 3 && lines.every((l) => len(l) <= COLS), JSON.stringify(lines))
    ok(lines.join('') === word, 'no se pierde nada')
  })

  test('row pone el precio al margen derecho', () => {
    const [line] = row('Planchado camisa', '$35.00')
    ok(len(line) === COLS, `mide ${len(line)}`)
    ok(line.startsWith('Planchado camisa ') && line.endsWith('$35.00'), line)
  })

  test('row con concepto largo: varios renglones y el precio en el último', () => {
    const lines = row('Tintorería: traje completo de dos piezas con chaleco', '$420.00')
    ok(lines.length > 1, 'se partió')
    ok(lines.every((l) => len(l) <= COLS), 'ninguno pasa de 32')
    ok(lines.at(-1).endsWith('$420.00') && len(lines.at(-1)) === COLS, lines.at(-1))
    ok(lines.slice(0, -1).every((l) => !l.includes('$')), 'el precio solo en el último')
  })

  test('las columnas se miden ya normalizadas', () => {
    const [line] = row('Nota…', '$1.00')
    ok(len(line) === COLS && line.startsWith('Nota...'), line)
    ok(rule() === '-'.repeat(COLS), 'regla')
  })
})

describe('ESC/POS', () => {
  test('empieza con ESC @, FS . y ESC t 2, y termina con el avance', () => {
    const b = new Ticket().line('hola').build()
    ok(startsWith(b, [0x1b, 0x40, 0x1c, 0x2e, 0x1b, 0x74, 0x02]), 'secuencia de inicio')
    ok(b.slice(-FEED_LINES).every((x) => x === 0x0a), 'líneas en blanco al final')
  })

  test('alineación y negritas', () => {
    const b = [...new Ticket().align('center').bold().build().slice(INIT.length, INIT.length + 6)]
    ok(b.join() === [0x1b, 0x61, 1, 0x1b, 0x45, 1].join(), b.join())
  })

  test('el ticket de prueba no se desborda', () => {
    const b = testTicket(new Date(2026, 10, 18, 10, 30))
    // Se quitan los comandos (cada uno trae ESC + 2 bytes) para medir solo el texto.
    const text = []
    for (let i = 0; i < b.length; i++) {
      if (b[i] === 0x1b || b[i] === 0x1c) { i += b[i] === 0x1c ? 1 : 2; continue }
      text.push(b[i])
    }
    const lines = Buffer.from(text).toString('latin1').split('\n')
    ok(lines.every((l) => l.length <= COLS), lines.find((l) => l.length > COLS))
  })
})

describe('ESC/POS: tamaño y código de barras', () => {
  const body = (t) => [...t.build().slice(INIT.length, -FEED_LINES)]

  test('size() arma GS ! con ancho en el nibble alto y alto en el bajo', () => {
    ok(body(new Ticket().size(2, 1)).join() === [0x1d, 0x21, 0x10].join(), 'doble ancho')
    ok(body(new Ticket().size(1, 2)).join() === [0x1d, 0x21, 0x01].join(), 'doble alto')
    ok(body(new Ticket().size(3, 3)).join() === [0x1d, 0x21, 0x22].join(), 'triple')
    ok(body(new Ticket().size()).join() === [0x1d, 0x21, 0x00].join(), 'normal')
    let threw = false
    try { new Ticket().size(9, 1) } catch { threw = true }
    ok(threw, 'fuera de rango')
  })

  test('CODE128: GS w, GS h, GS H y GS k 73 con el prefijo {B', () => {
    const b = body(new Ticket().barcode('P123', { width: 3, height: 80 }))
    const expected = [0x1d, 0x77, 3, 0x1d, 0x68, 80, 0x1d, 0x48, 2, 0x1d, 0x6b, 73, 6, ...Buffer.from('{BP123')]
    ok(b.join() === expected.join(), b.join())
  })

  test('CODE39: GS k 69 sin prefijo', () => {
    const b = body(new Ticket().barcode('P123', { type: 'CODE39' }))
    ok(b.slice(9).join() === [0x1d, 0x6b, 69, 4, ...Buffer.from('P123')].join(), b.join())
  })

  test('rechaza lo que el código no puede representar', () => {
    const fails = (fn) => { try { fn(); return false } catch { return true } }
    ok(fails(() => new Ticket().barcode('p123', { type: 'CODE39' })), 'CODE39 sin minúsculas')
    ok(fails(() => new Ticket().barcode('Niño')), 'CODE128 solo ASCII')
    ok(fails(() => new Ticket().barcode('P1', { type: 'QR' })), 'tipo desconocido')
    ok(fails(() => new Ticket().barcode('P1', { width: 7 })), 'grosor')
  })

  test('el ticket de prueba de comandos se arma completo', () => {
    const b = commandsTestTicket(new Date(2026, 10, 18, 10, 30))
    const n = (m) => b.reduce((acc, x, i) => acc + (x === 0x1d && b[i + 1] === 0x6b && b[i + 2] === m ? 1 : 0), 0)
    ok(n(73) === 3 && n(69) === 3, `3 CODE128 y 3 CODE39 (hay ${n(73)} y ${n(69)})`)
  })
})

describe('dispositivo', () => {
  test('escribe el ticket completo', async () => {
    const p = fresh('uno')
    const bytes = testTicket()
    await print(bytes, { path: p })
    ok(Buffer.compare(bytesOf(p), Buffer.from(bytes)) === 0, 'mismos bytes')
  })

  test('cola serial: cinco tickets al mismo tiempo salen completos y en orden', async () => {
    const p = fresh('cola')
    const tickets = [1, 2, 3, 4, 5].map((n) => new Ticket().lines(Array(200).fill(`ticket ${n}`)).build())
    await Promise.all(tickets.map((t) => print(t, { path: p })))
    const expected = Buffer.concat(tickets.map((t) => Buffer.from(t)))
    ok(Buffer.compare(bytesOf(p), expected) === 0, 'sin intercalar')
  })

  test('sin dispositivo: mensaje claro y no crea el archivo', async () => {
    const p = join(dir, 'no-existe')
    let err
    try { await print(testTicket(), { path: p }) } catch (e) { err = e }
    ok(err instanceof PrinterError && err.code === 'NOT_FOUND', String(err))
    ok(err.message.includes('No se encontró la impresora'), err.message)
    ok(!existsSync(p), 'no se creó un archivo en su lugar')
  })

  test('sin permisos: mensaje que apunta al grupo lp', async () => {
    if (process.getuid?.() === 0) return // root escribe aunque no tenga permiso
    const p = fresh('sin-permiso')
    chmodSync(p, 0o444)
    let err
    try { await print(testTicket(), { path: p }) } catch (e) { err = e }
    ok(err?.code === 'NO_PERMISSION' && err.message.includes('grupo lp'), String(err))
  })

  test('un error no detiene la cola', async () => {
    const p = fresh('despues')
    const bad = print(testTicket(), { path: join(dir, 'tampoco') }).catch((e) => e)
    const good = print(new Ticket().line('sigue').build(), { path: p })
    ok((await bad) instanceof PrinterError, 'el primero falla')
    await good
    ok(bytesOf(p).length > 0, 'el segundo se imprime')
  })

  test('impresora que no responde: se agota el tiempo y no cuelga', async () => {
    // Un FIFO sin lector bloquea al abrirlo para escritura, igual que una
    // impresora atorada. Al final se abre un lector para soltarlo.
    const fifo = join(dir, 'fifo')
    Bun.spawnSync(['mkfifo', fifo])
    const started = Date.now()
    let err
    try { await print(testTicket(), { path: fifo, timeoutMs: 200 }) } catch (e) { err = e }
    ok(err?.code === 'TIMEOUT', String(err))
    ok(Date.now() - started < 2000, 'respondió a tiempo')

    // Mientras la escritura siga atorada, los siguientes se rechazan de inmediato.
    let again
    try { await print(new Ticket().build(), { path: fresh('otro') }) } catch (e) { again = e }
    ok(again?.code === 'TIMEOUT', 'rechazado mientras sigue atorada')

    // Se suelta el FIFO leyéndolo; la cola vuelve a funcionar.
    const reader = Bun.spawn(['cat', fifo], { stdout: 'ignore' })
    await reader.exited
    await Bun.sleep(50)
    const p = fresh('recuperada')
    await print(new Ticket().line('ok').build(), { path: p })
    ok(bytesOf(p).length > 0, 'se recupera cuando la escritura termina')
  })
})

describe('/printer', () => {
  let base, c
  beforeAll(async () => { resetDb(); base = startServer(); c = client(base, await login(base)) })
  afterAll(() => { stopServer(); delete process.env.LAVANDERIA_TICKETERA })

  test('la página muestra el dispositivo y el botón', async () => {
    process.env.LAVANDERIA_TICKETERA = '/dev/ticketera'
    const html = await (await c.get('/printer')).text()
    ok(html.includes('/dev/ticketera') && html.includes('hx-post="/printer/test"'), 'página')
  })

  test('imprime y avisa', async () => {
    const p = fresh('http')
    process.env.LAVANDERIA_TICKETERA = p
    const r = await c.post('/printer/test')
    ok(r.status === 200 && (await r.text()).includes('Ticket enviado'), 'éxito')
    ok(startsWith(bytesOf(p), [...INIT]), 'llegaron los bytes')
  })

  test('sin impresora: 200 con el mensaje en la página', async () => {
    process.env.LAVANDERIA_TICKETERA = join(dir, 'desconectada')
    const r = await c.post('/printer/test')
    const html = await r.text()
    ok(r.status === 200 && html.includes('No se imprimió') && html.includes('No se encontró la impresora'), html)
  })

  test('prueba de comandos: imprime y avisa', async () => {
    const p = fresh('http-comandos')
    process.env.LAVANDERIA_TICKETERA = p
    const r = await c.post('/printer/test-commands')
    ok((await r.text()).includes('Ticket enviado'), 'éxito')
    ok(bytesOf(p).length > 0, 'llegaron los bytes')
  })

  test('requiere sesión', async () => {
    const r = await fetch(`${base}/printer`, { redirect: 'manual' })
    ok(r.status !== 200, `status ${r.status}`)
  })
})
