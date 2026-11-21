// Fase 1 de la impresión: folio en código de barras, datos del negocio y
// trabajos en segundo plano. Sin impresora: escribe en archivos temporales.
import { describe, test, beforeAll, afterAll } from 'bun:test'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { startServer, stopServer, resetDb, login, client, ok } from './_helpers.js'
import { folioCode, parseFolio, FOLIO_BARCODE } from '../src/printer/folio.js'
import { business, missingBusinessVars, BUSINESS_VARS } from '../src/printer/business.js'
import * as jobs from '../src/printer/jobs.js'
import { Ticket } from '../src/printer/escpos.js'

const dir = mkdtempSync(join(tmpdir(), 'impresion-'))
const fresh = (name) => {
  const p = join(dir, name)
  writeFileSync(p, '')
  return p
}
const ticket = (text) => new Ticket().line(text).build()

describe('folio', () => {
  test('el código es P + folio y se puede imprimir con el formato elegido', () => {
    ok(folioCode(123) === 'P123', folioCode(123))
    new Ticket().barcode(folioCode(98765), FOLIO_BARCODE) // no lanza
  })

  test('se lee lo que escribe el lector o lo que se teclea', () => {
    for (const [input, id] of [['P123', 123], ['p123', 123], ['123', 123], ['P000123', 123], ['  P7 ', 7]]) {
      ok(parseFolio(input) === id, `${JSON.stringify(input)} → ${id}`)
    }
  })

  test('rechaza lo que no es un folio', () => {
    for (const input of ['', 'P', 'P0', 'X123', 'P12a', '6141234567890', null, undefined]) {
      ok(parseFolio(input) === null, JSON.stringify(input))
    }
  })
})

describe('datos del negocio', () => {
  test('lee las variables y parte en renglones con |', () => {
    const b = business({
      LAVANDERIA_NEGOCIO: ' Lavandería La Burbuja ',
      LAVANDERIA_DIRECCION: 'Av. Juárez 123 | Col. Centro',
      LAVANDERIA_TELEFONO: '614 123 4567',
      LAVANDERIA_PIE_TICKET: '¡Gracias!|Sin ticket no se entrega ropa'
    })
    ok(b.name === 'Lavandería La Burbuja', b.name)
    ok(b.address.join('/') === 'Av. Juárez 123/Col. Centro', b.address.join('/'))
    ok(b.phone === '614 123 4567', b.phone)
    ok(b.footer.length === 2, b.footer.join('/'))
  })

  test('sin variables: todo vacío y se reportan como faltantes', () => {
    const b = business({})
    ok(b.name === '' && b.address.length === 0 && b.phone === '' && b.footer.length === 0, JSON.stringify(b))
    ok(missingBusinessVars({}).length === Object.keys(BUSINESS_VARS).length, 'faltan las cuatro')
    ok(missingBusinessVars({ LAVANDERIA_NEGOCIO: 'X' }).length === 3, 'falta una menos')
  })
})

describe('trabajos de impresión', () => {
  test('imprime en segundo plano y queda como hecho', async () => {
    const p = fresh('job-ok')
    const id = jobs.submit(ticket('hola'), { label: 'Prueba', print: (b) => Bun.write(p, b) })
    ok(jobs.get(id).status === 'pending', 'empieza pendiente')
    const job = await jobs.settle(id)
    ok(job.status === 'done' && job.error === null, JSON.stringify(job.status))
    ok(readFileSync(p).length > 0, 'se escribió')
  })

  test('varios documentos salen en una sola escritura, en orden', async () => {
    const writes = []
    const id = jobs.submit([ticket('uno'), ticket('dos')], { print: async (b) => writes.push(Buffer.from(b)) })
    await jobs.settle(id)
    ok(writes.length === 1, `${writes.length} escrituras`)
    const text = writes[0].toString('latin1')
    ok(text.indexOf('uno') < text.indexOf('dos'), 'comprobante y etiqueta en orden')
  })

  test('un error queda guardado con su mensaje y settle no lanza', async () => {
    const id = jobs.submit(ticket('x'), { label: 'Comprobante', print: async () => { throw new Error('sin papel') } })
    const job = await jobs.settle(id)
    ok(job.status === 'error' && job.error === 'sin papel', JSON.stringify(job))
  })

  test('reintentar crea otro trabajo con los mismos bytes', async () => {
    let calls = 0
    const seen = []
    const flaky = async (b) => { seen.push(Buffer.from(b)); if (++calls === 1) throw new Error('apagada') }
    const first = jobs.submit(ticket('mismo'), { label: 'Etiqueta', print: flaky })
    await jobs.settle(first)
    const second = jobs.retry(first)
    ok(second && second !== first, 'id nuevo')
    const job = await jobs.settle(second)
    ok(job.status === 'done' && job.label === 'Etiqueta', job.status)
    ok(Buffer.compare(seen[0], seen[1]) === 0, 'mismos bytes')
  })

  test('un id desconocido no truena', async () => {
    ok(jobs.get('no-existe') === null, 'get')
    ok((await jobs.settle('no-existe')) === null, 'settle')
    ok(jobs.retry('no-existe') === null, 'retry')
  })

  test('por defecto usa la impresora configurada', async () => {
    const p = fresh('job-env')
    process.env.LAVANDERIA_TICKETERA = p
    try {
      await jobs.settle(jobs.submit(ticket('env')))
      ok(readFileSync(p).length > 0, 'escribió en LAVANDERIA_TICKETERA')
    } finally {
      delete process.env.LAVANDERIA_TICKETERA
    }
  })
})

describe('/print-jobs', () => {
  let base, c
  beforeAll(async () => { resetDb(); base = startServer(); c = client(base, await login(base)) })
  afterAll(() => { stopServer(); delete process.env.LAVANDERIA_TICKETERA })

  test('éxito: aviso de impreso con el nombre del trabajo', async () => {
    const id = jobs.submit(ticket('a'), { label: 'Comprobante del pedido #1', print: async () => {} })
    const html = await (await c.get(`/print-jobs/${id}`)).text()
    ok(html.includes('Comprobante del pedido #1: impreso'), html)
  })

  test('error: mensaje y botón de reintentar, con código 200', async () => {
    const id = jobs.submit(ticket('a'), { label: 'Corte', print: async () => { throw new Error('No se encontró la impresora') } })
    const r = await c.get(`/print-jobs/${id}`)
    const html = await r.text()
    ok(r.status === 200, `status ${r.status}`)
    ok(html.includes('Corte: no se imprimió') && html.includes('No se encontró la impresora'), html)
    ok(html.includes(`/print-jobs/${id}/retry`), 'botón reintentar')
  })

  test('reintentar devuelve un aviso nuevo que se consulta solo', async () => {
    const id = jobs.submit(ticket('a'), { print: async () => { throw new Error('x') } })
    await jobs.settle(id)
    const html = await (await c.post(`/print-jobs/${id}/retry`)).text()
    ok(html.includes('Imprimiendo') && html.includes('hx-trigger="load"') && !html.includes(`/print-jobs/${id}"`), html)
  })

  test('trabajo desconocido: consulta vacía, reintento con aviso', async () => {
    ok((await (await c.get('/print-jobs/no-existe')).text()).trim() === '', 'consulta vacía')
    ok((await (await c.post('/print-jobs/no-existe/retry')).text()).includes('ya no está disponible'), 'reintento')
  })

  test('el texto del error se escapa', async () => {
    const id = jobs.submit(ticket('a'), { label: '<b>x</b>', print: async () => { throw new Error('<script>') } })
    const html = await (await c.get(`/print-jobs/${id}`)).text()
    ok(!html.includes('<script>') && !html.includes('<b>x</b>'), html)
  })

  test('/printer muestra los datos del negocio y avisa lo que falta', async () => {
    const saved = Object.fromEntries(Object.values(BUSINESS_VARS).map((k) => [k, process.env[k]]))
    try {
      for (const k of Object.values(BUSINESS_VARS)) delete process.env[k]
      process.env.LAVANDERIA_NEGOCIO = 'Lavandería La Burbuja'
      const html = await (await c.get('/printer')).text()
      ok(html.includes('Lavandería La Burbuja'), 'nombre')
      ok(html.includes('Faltan datos') && html.includes('LAVANDERIA_TELEFONO') && !html.includes('<code>LAVANDERIA_NEGOCIO'), 'faltantes')
    } finally {
      for (const [k, v] of Object.entries(saved)) v === undefined ? delete process.env[k] : (process.env[k] = v)
    }
  })

  test('requiere sesión', async () => {
    const r = await fetch(`${base}/print-jobs/x`, { redirect: 'manual' })
    ok(r.status !== 200, `status ${r.status}`)
  })
})
