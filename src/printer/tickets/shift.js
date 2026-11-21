// Corte de caja de un turno.
//
// `shift` tiene la forma de cashShifts.findById(), `summary` la de
// cashShifts.summary(), `payments` la de cashShifts.paymentsOf() y `refunds`
// la de cashMovements.refundsOfShift().
//
// Con el turno cerrado es el corte definitivo: esperado, contado y diferencia.
// Con el turno abierto es un corte parcial: lo que debería haber hasta ahora.
import { Ticket } from '../escpos.js'
import { round2 } from '../../money.js'
import { field, formatDateTime, header, money, nowText, row, rule, signature, title } from './common.js'

const METHOD_SHORT = { cash: 'E', transfer: 'T' }

export function shiftReport({ shift, summary, payments, refunds, business, copy = false, now = new Date() }) {
  const closed = shift.status === 'closed'
  const t = new Ticket()
  header(t, business, { copy, now })
  title(t, closed ? 'CORTE DE CAJA' : 'CORTE PARCIAL')
  t.align('center').bold().size(2, 2).line(`Turno #${shift.id}`).size().bold(false).align('left')
  if (!closed) t.align('center').line('(turno abierto)').align('left')
  t.line()

  field(t, 'Abrió', shift.opened_by_name)
  field(t, 'Apertura', formatDateTime(shift.opening_time))
  if (closed) {
    field(t, 'Cerró', shift.closed_by_name)
    field(t, 'Cierre', formatDateTime(shift.closing_time))
  } else {
    field(t, 'Hasta', nowText(now))
  }
  t.line(rule())

  // Efectivo: lo único que se cuenta en el cajón.
  t.bold().line('EFECTIVO').bold(false)
  t.lines(row('Fondo inicial', money(shift.initial_cash)))
  t.lines(row(`Cobros (${summary.cash_count})`, money(summary.cash_total)))
  if (summary.cash_refunds > 0) t.lines(row('Devoluciones', `-${money(summary.cash_refunds)}`))

  if (closed) {
    t.bold().lines(row('Esperado en caja', money(shift.expected_cash))).bold(false)
    t.lines(row('Contado', money(shift.actual_cash)))
    t.line()
    t.align('center').bold().size(1, 2).line(differenceText(shift.difference)).size().bold(false).align('left')
  } else {
    const expected = round2(shift.initial_cash + summary.cash_net)
    t.bold().lines(row('Debe haber en caja', money(expected))).bold(false)
  }
  t.line(rule())

  t.bold().line('TRANSFERENCIAS').bold(false).line('(no entran al cajón)')
  t.lines(row(`Cobros (${summary.transfer_count})`, money(summary.transfer_total)))
  if (summary.transfer_refunds > 0) t.lines(row('Devoluciones', `-${money(summary.transfer_refunds)}`))
  t.line(rule())

  // El detalle, para revisar contra la pantalla si algo no cuadra.
  t.bold().line(`COBROS DEL TURNO (${payments.length})`).bold(false)
  if (payments.length === 0) t.line('Ninguno')
  for (const p of payments) {
    t.lines(row(`#${p.id} ${p.client_name}`, `${money(p.total)} ${METHOD_SHORT[p.payment_method] ?? '?'}`))
  }
  if (payments.length) t.line('E = efectivo, T = transferencia')

  if (refunds.length) {
    t.line(rule()).bold().line(`DEVOLUCIONES (${refunds.length})`).bold(false)
    for (const r of refunds) {
      const who = r.order_id ? `#${r.order_id} ${r.client_name ?? ''}`.trim() : 'Sin pedido'
      t.lines(row(who, `-${money(r.amount)} ${METHOD_SHORT[r.method] ?? '?'}`))
    }
  }

  if (closed) signature(t, `Entrega: ${shift.closed_by_name ?? ''}`.trim())
  return t.build()
}

// La diferencia con palabra, no solo con signo: un "-" se pierde fácil en papel.
function differenceText(d) {
  const n = round2(d)
  if (n === 0) return 'CUADRA'
  return n > 0 ? `SOBRA ${money(n)}` : `FALTA ${money(-n)}`
}
