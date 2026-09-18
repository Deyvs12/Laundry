import db from '../db/database.js'
import * as logs from './logs.js'
import { round2 } from '../money.js'

export class ShiftError extends Error {}

const COLUMNS = `
  s.id, s.user_id, s.opening_time, s.closing_time, s.initial_cash,
  s.expected_cash, s.actual_cash, s.difference, s.status, s.closed_by,
  u.name AS opened_by_name, c.name AS closed_by_name`

const FROM = `
  FROM Cash_shifts s
  JOIN Users u ON u.id = s.user_id
  LEFT JOIN Users c ON c.id = s.closed_by`

// Solo puede haber un turno abierto a la vez.
export function findOpen() {
  return db.query(`SELECT ${COLUMNS} ${FROM} WHERE s.status = 'open' ORDER BY s.id DESC LIMIT 1`).get() || null
}

export function findById(id) {
  return db.query(`SELECT ${COLUMNS} ${FROM} WHERE s.id = ?`).get(id)
}

export function list({ limit = 60 } = {}) {
  return db.query(`SELECT ${COLUMNS} ${FROM} ORDER BY s.id DESC LIMIT ?`).all(limit)
}

// Totales de lo cobrado durante el turno. Solo el efectivo entra al cajón;
// las transferencias se reportan aparte y no cuentan para el arqueo.
export function summary(shiftId) {
  const row = db
    .query(
      `SELECT
         COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total END), 0)     AS cash_total,
         COALESCE(SUM(payment_method = 'cash'), 0)                              AS cash_count,
         COALESCE(SUM(CASE WHEN payment_method = 'transfer' THEN total END), 0) AS transfer_total,
         COALESCE(SUM(payment_method = 'transfer'), 0)                          AS transfer_count
       FROM Orders
       WHERE cash_shift_id = ? AND paid = 1`
    )
    .get(shiftId)

  return {
    cash_total: round2(row.cash_total),
    cash_count: row.cash_count,
    transfer_total: round2(row.transfer_total),
    transfer_count: row.transfer_count
  }
}

export function paymentsOf(shiftId) {
  return db
    .query(
      `SELECT o.id, o.total, o.payment_method, o.payment_day, o.status,
              c.name AS client_name, st.name AS staff_name
       FROM Orders o
       JOIN Clients c ON c.id = o.id_client
       LEFT JOIN Staff st ON st.id = o.id_staff
       WHERE o.cash_shift_id = ? AND o.paid = 1
       ORDER BY o.payment_day, o.id`
    )
    .all(shiftId)
}

// Cobros registrados sin turno abierto. No entran en ningún corte, así que se
// muestran aparte para que no pasen desapercibidos. Solo los de HOY: no se
// borra nada, pero la sección no debe crecer sin límite. Los anteriores siguen
// en el listado de pedidos.
const TODAY_UNASSIGNED = `o.paid = 1 AND o.cash_shift_id IS NULL
       AND date(o.payment_day, 'localtime') = date('now', 'localtime')`

export function unassignedPayments() {
  return db
    .query(
      `SELECT o.id, o.total, o.payment_method, o.payment_day, o.status,
              c.name AS client_name, st.name AS staff_name
       FROM Orders o
       JOIN Clients c ON c.id = o.id_client
       LEFT JOIN Staff st ON st.id = o.id_staff
       WHERE ${TODAY_UNASSIGNED}
       ORDER BY o.payment_day DESC, o.id DESC`
    )
    .all()
}

export function unassignedSummary() {
  const row = db
    .query(
      `SELECT
         COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total END), 0)     AS cash_total,
         COALESCE(SUM(payment_method = 'cash'), 0)                              AS cash_count,
         COALESCE(SUM(CASE WHEN payment_method = 'transfer' THEN total END), 0) AS transfer_total,
         COALESCE(SUM(payment_method = 'transfer'), 0)                          AS transfer_count
       FROM Orders o
       WHERE ${TODAY_UNASSIGNED}`
    )
    .get()
  return {
    cash_total: round2(row.cash_total),
    cash_count: row.cash_count,
    transfer_total: round2(row.transfer_total),
    transfer_count: row.transfer_count
  }
}

export const open = db.transaction(({ userId, initialCash }) => {
  if (findOpen()) throw new ShiftError('Ya hay un turno abierto. Ciérralo antes de abrir otro.')
  if (!(Number.isFinite(initialCash) && initialCash >= 0)) {
    throw new ShiftError('El fondo inicial debe ser un número mayor o igual a 0')
  }

  const { lastInsertRowid: id } = db
    .query('INSERT INTO Cash_shifts (user_id, initial_cash) VALUES (?, ?)')
    .run(userId, round2(initialCash))

  logs.insert({
    userId,
    cashShiftId: id,
    action: 'SHIFT_OPENED',
    message: `Turno #${id} abierto con un fondo de ${round2(initialCash).toFixed(2)}`
  })

  return id
})

// expected = fondo inicial + efectivo cobrado. difference = contado − esperado:
// positivo sobra dinero, negativo falta.
export const close = db.transaction(({ shiftId, userId, actualCash }) => {
  const shift = findById(shiftId)
  if (!shift) throw new ShiftError('Turno no encontrado')
  if (shift.status !== 'open') throw new ShiftError('Ese turno ya está cerrado')
  if (!(Number.isFinite(actualCash) && actualCash >= 0)) {
    throw new ShiftError('El efectivo contado debe ser un número mayor o igual a 0')
  }

  const { cash_total } = summary(shiftId)
  const expected = round2(shift.initial_cash + cash_total)
  const actual = round2(actualCash)
  const difference = round2(actual - expected)

  db.query(
    `UPDATE Cash_shifts
     SET status = 'closed', closing_time = CURRENT_TIMESTAMP,
         expected_cash = ?, actual_cash = ?, difference = ?, closed_by = ?
     WHERE id = ?`
  ).run(expected, actual, difference, userId, shiftId)

  logs.insert({
    userId,
    cashShiftId: shiftId,
    action: 'SHIFT_CLOSED',
    message: `Turno #${shiftId} cerrado: esperado ${expected.toFixed(2)}, contado ${actual.toFixed(2)}, diferencia ${difference >= 0 ? '+' : ''}${difference.toFixed(2)}`
  })

  return { expected, actual, difference }
})
