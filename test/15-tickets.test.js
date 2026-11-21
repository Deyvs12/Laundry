// Fase 2 de la impresión: los cinco tickets. Se revisan interpretando los
// bytes (src/printer/preview.js), igual que los leería la impresora.
import { describe, test, beforeAll, afterAll } from 'bun:test'
import { db, startServer, stopServer, resetDb, login, client, ok, addService, addClient, createOrder } from './_helpers.js'
import { parse, render } from '../src/printer/preview.js'
import { COLS, row } from '../src/printer/columns.js'
import { folioBarcode } from '../src/printer/folio.js'
import { orderTicket, orderLabel } from '../src/printer/tickets/order.js'
import { paymentReceipt, refundReceipt } from '../src/printer/tickets/payment.js'
import { shiftReport } from '../src/printer/tickets/shift.js'
import * as orders from '../src/services/orders.js'
import * as cashShifts from '../src/services/cash_shifts.js'
import * as cashMovements from '../src/services/cash_movements.js'

const BIZ = {
  name: 'Lavandería La Burbuja',
  address: ['Av. Juárez 123', 'Col. Centro, Chihuahua'],
  phone: '614 123 4567',
  footer: ['¡Gracias por su preferencia!']
}
const NO_BIZ = { name: '', address: [], phone: '', footer: [] }
const NOW = new Date(2026, 10, 19, 20, 0)

const LONG = 'María Fernanda de los Ángeles González Ruiz de la Garza'
const ORDER = {
  id: 1234, client_name: 'Juan Pérez', client_phone: '614 555 1234', staff_name: 'Ana',
  created_at: '2026-11-19 17:30:00', expected_delivery_date: '2026-11-21',
  discount: 0, total: 290, paid: 0, payment_method: null, payment_day: null, cash_shift_id: null,
  status: 'received', notes: null, refund_id: null
}
const LINES = [
  { name: 'Lavado por kilo', quantity: 3, unit_price: 85, sub_total: 255, price_type: 'kilo' },
  { name: 'Planchado camisa', quantity: 1, unit_price: 35, sub_total: 35, price_type: 'unit' }
]
const PAID = { ...ORDER, paid: 1, payment_method: 'cash', payment_day: '2026-11-19 17:31:00', cash_shift_id: 5 }
const REFUNDED = { ...PAID, status: 'cancelled', refund_id: 1, refund_amount: 290, refund_method: 'cash', refund_day: '2026-11-19 18:00:00' }
const SHIFT = {
  id: 5, status: 'closed', opened_by_name: 'Administrador', closed_by_name: 'Administrador',
  opening_time: '2026-11-19 14:00:00', closing_time: '2026-11-20 02:00:00',
  initial_cash: 500, expected_cash: 790, actual_cash: 790, difference: 0
}
const SUMMARY = { cash_total: 290, cash_count: 1, transfer_total: 0, transfer_count: 0, cash_refunds: 0, transfer_refunds: 0, refund_count: 0, cash_net: 290 }

const text = (bytes) => parse(bytes).filter((l) => !l.barcode).map((l) => l.text).join('\n')
const barcodes = (bytes) => parse(bytes).filter((l) => l.barcode)

// Cada renglón, multiplicado por el ancho de letra con que se imprime, cabe
// en el papel. Es la propiedad que más importa: un desborde parte el ticket.
function fits(bytes, name) {
  for (const l of parse(bytes)) {
    if (l.barcode) continue
    ok([...l.text].length * l.width <= COLS, `${name}: "${l.text}" a ancho ${l.width} no cabe`)
  }
}

describe('comprobante del pedido', () => {
  test('lleva negocio, folio grande, servicios, total, estado y código', () => {
    const b = orderTicket({ order: ORDER, lines: LINES, business: BIZ, now: NOW })
    const t = text(b)
    for (const s of ['Lavandería La Burbuja', 'Av. Juárez 123', 'Tel. 614 123 4567', 'Cliente: Juan Pérez',
                     'Entrega: 21/11/2026', 'Atendió: Ana', 'Lavado por kilo', '3 kg x $85.00', 'PENDIENTE DE PAGO',
                     '¡Gracias por su preferencia!']) {
      ok(t.includes(s), `falta "${s}"`)
    }
    const folio = parse(b).find((l) => l.text === '#1234')
    ok(folio && folio.width === 2 && folio.height === 2 && folio.bold, 'folio a doble tamaño')
    const total = parse(b).find((l) => l.text.startsWith('TOTAL'))
    ok(total && total.text.endsWith('$290.00') && total.bold, 'TOTAL en negritas a la derecha')
    ok(barcodes(b).length === 1 && barcodes(b)[0].text === 'P1234', 'código P1234')
    ok(!t.includes('COPIA'), 'el original no dice COPIA')
    fits(b, 'comprobante')
  })

  test('descuento: subtotal y descuento aparecen; sin descuento no', () => {
    const con = text(orderTicket({ order: { ...ORDER, discount: 20, total: 270 }, lines: LINES, business: BIZ }))
    ok(con.includes('Subtotal') && con.includes('-$20.00'), 'con descuento')
    const sin = text(orderTicket({ order: ORDER, lines: LINES, business: BIZ }))
    ok(!sin.includes('Descuento'), 'sin descuento')
  })

  test('estado de pago y cancelado', () => {
    ok(text(orderTicket({ order: PAID, lines: LINES, business: BIZ })).includes('PAGADO - Efectivo'), 'pagado')
    ok(text(orderTicket({ order: REFUNDED, lines: LINES, business: BIZ })).includes('CANCELADO'), 'cancelado')
  })

  test('copia: marca arriba y hora de reimpresión', () => {
    const lines = parse(orderTicket({ order: ORDER, lines: LINES, business: BIZ, copy: true, now: NOW }))
    ok(lines[0].text === '*** COPIA ***' && lines[0].bold, lines[0].text)
    ok(lines[1].text.startsWith('Reimpreso 19/11/2026'), lines[1].text)
  })

  test('datos largos se parten y nada se desborda', () => {
    const order = { ...ORDER, client_name: LONG, notes: 'x'.repeat(100) + ' ' + 'Camisa azul con mancha en el cuello' }
    const lines = [...LINES, { name: 'Tintorería: traje completo de dos piezas con chaleco y corbata', quantity: 12.5, unit_price: 1234.5, sub_total: 15431.25, price_type: 'kilo' }]
    fits(orderTicket({ order, lines, business: BIZ }), 'comprobante largo')
  })

  test('sin datos del negocio no deja renglones vacíos de más', () => {
    const lines = parse(orderTicket({ order: ORDER, lines: LINES, business: NO_BIZ }))
    ok(lines[0].text.startsWith('---'), `empieza con la regla: "${lines[0].text}"`)
  })
})

describe('etiqueta', () => {
  test('folio al triple, cliente, entrega, servicios, notas y código; sin negocio', () => {
    const b = orderLabel({ order: { ...ORDER, notes: 'Camisa azul' }, lines: LINES })
    const first = parse(b)[0]
    ok(first.text === '#1234' && first.width === 3 && first.height === 3, 'folio al triple, arriba de todo')
    const t = text(b)
    for (const s of ['Juan Pérez', 'Entrega: 21/11/2026', '3 kg Lavado por kilo', 'Notas: Camisa azul']) ok(t.includes(s), `falta "${s}"`)
    ok(!t.includes('Lavandería'), 'sin datos del negocio')
    ok(barcodes(b)[0].text === 'P1234', 'código')
    fits(b, 'etiqueta')
  })

  test('folio de 7 dígitos todavía cabe al triple', () => {
    fits(orderLabel({ order: { ...ORDER, id: 1234567 }, lines: LINES }), 'etiqueta folio largo')
  })
})

describe('comprobante de pago', () => {
  test('total pagado, forma de pago, turno y código', () => {
    const b = paymentReceipt({ order: PAID, business: BIZ })
    const t = text(b)
    for (const s of ['COMPROBANTE DE PAGO', 'Pedido #1234', 'Forma de pago: Efectivo', 'Turno de caja: #5', 'Entrega: 21/11/2026']) {
      ok(t.includes(s), `falta "${s}"`)
    }
    ok(parse(b).some((l) => l.text.startsWith('PAGADO') && l.text.endsWith('$290.00')), 'importe')
    ok(barcodes(b)[0].text === 'P1234', 'código')
    fits(b, 'pago')
  })

  test('sin turno lo dice; entregado no repite la fecha de entrega', () => {
    const t = text(paymentReceipt({ order: { ...PAID, cash_shift_id: null, status: 'delivered' }, business: BIZ }))
    ok(t.includes('Turno de caja: sin turno') && !t.includes('Entrega:'), t)
  })

  test('no se arma para un pedido sin pagar', () => {
    let threw = false
    try { paymentReceipt({ order: ORDER, business: BIZ }) } catch { threw = true }
    ok(threw, 'lanza')
  })
})

describe('comprobante de devolución', () => {
  test('monto, vía y renglón de firma con el nombre del cliente', () => {
    const b = refundReceipt({ order: REFUNDED, business: BIZ })
    const t = text(b)
    for (const s of ['COMPROBANTE DE DEVOLUCIÓN', 'Pedido #1234 - cancelado', 'Devuelto en: Efectivo', 'Recibí conforme: Juan Pérez']) {
      ok(t.includes(s), `falta "${s}"`)
    }
    ok(parse(b).some((l) => l.text === '_'.repeat(COLS)), 'renglón para firmar')
    fits(refundReceipt({ order: { ...REFUNDED, client_name: LONG }, business: BIZ }), 'devolución')
  })

  test('no se arma sin devolución', () => {
    let threw = false
    try { refundReceipt({ order: PAID, business: BIZ }) } catch { threw = true }
    ok(threw, 'lanza')
  })
})

describe('corte de caja', () => {
  const report = (shift, extra = {}) =>
    shiftReport({ shift, summary: SUMMARY, payments: [], refunds: [], business: BIZ, now: NOW, ...extra })

  test('diferencia con palabra: CUADRA, SOBRA, FALTA', () => {
    ok(text(report(SHIFT)).includes('CUADRA'), 'cuadra')
    ok(text(report({ ...SHIFT, difference: 12.5 })).includes('SOBRA $12.50'), 'sobra')
    ok(text(report({ ...SHIFT, difference: -10 })).includes('FALTA $10.00'), 'falta')
  })

  test('cerrado: esperado, contado y firma; lista de cobros y devoluciones', () => {
    const payments = [
      { id: 1, client_name: LONG, total: 200, payment_method: 'cash' },
      { id: 2, client_name: 'Pedro', total: 90, payment_method: 'transfer' }
    ]
    const refunds = [{ order_id: 3, client_name: 'Luis', amount: 50, method: 'cash' }]
    const b = report(SHIFT, { payments, refunds })
    const t = text(b)
    for (const s of ['CORTE DE CAJA', 'Esperado en caja', 'Contado', 'COBROS DEL TURNO (2)', '$90.00 T', 'DEVOLUCIONES (1)', '-$50.00 E', 'Entrega: Administrador']) {
      ok(t.includes(s), `falta "${s}"`)
    }
    fits(b, 'corte')
  })

  test('abierto: corte parcial con lo que debe haber, sin contado ni firma', () => {
    const t = text(report({ ...SHIFT, status: 'open', closing_time: null, closed_by_name: null }))
    ok(t.includes('CORTE PARCIAL') && t.includes('(turno abierto)'), 'título')
    ok(t.includes('Debe haber en caja') && t.includes('$790.00'), 'esperado hasta ahora')
    ok(!t.includes('Contado') && !t.includes('CUADRA') && !t.includes('Entrega:'), 'sin datos de cierre')
  })

  test('sin cobros lo dice', () => {
    ok(text(report(SHIFT)).includes('Ninguno'), 'ninguno')
  })
})

describe('piezas', () => {
  test('row respeta la sangría', () => {
    const [line] = row('  3 kg x $85.00', '$255.00')
    ok(line.startsWith('  3 kg') && line.endsWith('$255.00') && line.length === COLS, line)
  })

  test('folio larguísimo baja a grosor 2 en vez de cortarse', () => {
    ok(folioBarcode(1234567).options.width === 3, 'P1234567 a grosor 3')
    ok(folioBarcode(12345678).options.width === 2, 'P12345678 a grosor 2')
  })

  test('la vista previa en texto no truena', () => {
    ok(render(orderTicket({ order: ORDER, lines: LINES, business: BIZ })).includes('P1234'), 'render')
  })
})

describe('con datos reales de la base', () => {
  let base, c
  beforeAll(async () => { resetDb(); base = startServer(); c = client(base, await login(base)) })
  afterAll(stopServer)

  test('pedido, pago, devolución y corte salen de los servicios tal cual', async () => {
    await c.post('/cash/open', { initial_cash: '500' })
    const kilo = await addService(c, 'Lavado por kilo', 'laundry', 85, 'kilo')
    const client1 = await addClient(c, 'Cliente Ticket', '6141112233')
    const orderId = await createOrder(c, client1, [[kilo, 2]])
    const userId = db.query("SELECT id FROM Users WHERE username = 'admin'").get().id

    const order = orders.findById(orderId)
    const lines = orders.linesOf(orderId)
    const ticket = orderTicket({ order, lines, business: BIZ })
    ok(text(ticket).includes('Cliente Ticket') && text(ticket).includes('$170.00'), 'comprobante')
    fits(orderLabel({ order, lines }), 'etiqueta real')

    orders.pay(orderId, 'cash', userId)
    const paid = orders.findById(orderId)
    ok(text(paymentReceipt({ order: paid, business: BIZ })).includes('Turno de caja: #'), 'pago con turno')

    orders.cancel(orderId, userId)
    const cancelled = orders.findById(orderId)
    ok(text(refundReceipt({ order: cancelled, business: BIZ })).includes('$170.00'), 'devolución')

    const shift = cashShifts.findOpen()
    cashShifts.close({ shiftId: shift.id, userId, actualCash: 500 })
    const closed = cashShifts.findById(shift.id)
    const b = shiftReport({
      shift: closed,
      summary: cashShifts.summary(shift.id),
      payments: cashShifts.paymentsOf(shift.id),
      refunds: cashMovements.refundsOfShift(shift.id),
      business: BIZ
    })
    const t = text(b)
    ok(t.includes('CUADRA') && t.includes('COBROS DEL TURNO (1)') && t.includes('DEVOLUCIONES (1)'), t)
    fits(b, 'corte real')
  })
})
