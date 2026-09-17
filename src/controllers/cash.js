import * as cashShifts from '../services/cash_shifts.js'
import { render } from '../render.js'
import { cashPage } from '../views/cash/index.js'
import { shiftDetail } from '../views/cash/detail.js'

function readMoney(value) {
  return Number((value ?? '').toString().trim().replace(',', '.'))
}

function pageData(error = null) {
  const shift = cashShifts.findOpen()
  return {
    shift,
    summary: shift ? cashShifts.summary(shift.id) : null,
    payments: shift ? cashShifts.paymentsOf(shift.id) : [],
    history: cashShifts.list(),
    unassigned: cashShifts.unassignedPayments(),
    unassignedSummary: cashShifts.unassignedSummary(),
    error
  }
}

export function index(c) {
  return render(c, { title: 'Caja — Laundry', body: cashPage(pageData()) })
}

// Abrir y cerrar cambian el indicador del nav, así que se recarga la página
// completa con HX-Redirect en vez de devolver un fragmento.
export async function open(c) {
  const body = await c.req.parseBody()
  try {
    cashShifts.open({ userId: c.get('user').userId, initialCash: readMoney(body.initial_cash) })
  } catch (e) {
    if (!(e instanceof cashShifts.ShiftError)) throw e
    return c.html(cashPage(pageData(e.message)))
  }
  c.header('HX-Redirect', '/cash')
  return c.body(null, 200)
}

export async function close(c) {
  const body = await c.req.parseBody()
  const shiftId = Number(c.req.param('id'))
  try {
    cashShifts.close({ shiftId, userId: c.get('user').userId, actualCash: readMoney(body.actual_cash) })
  } catch (e) {
    if (!(e instanceof cashShifts.ShiftError)) throw e
    return c.html(cashPage(pageData(e.message)))
  }
  c.header('HX-Redirect', `/cash/${shiftId}`)
  return c.body(null, 200)
}

export function show(c) {
  const shift = cashShifts.findById(Number(c.req.param('id')))
  if (!shift) return c.text('Turno no encontrado', 404)
  const body = shiftDetail(shift, cashShifts.summary(shift.id), cashShifts.paymentsOf(shift.id))
  return render(c, { title: `Turno #${shift.id} — Laundry`, body })
}
