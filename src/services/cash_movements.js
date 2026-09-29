import db from '../db/database.js'
import { round2 } from '../money.js'

// Salidas (y entradas) de dinero que no son ventas. Hoy solo devoluciones.
// El monto siempre es positivo; el tipo dice la dirección.

export function insert({ type, method, amount, orderId = null, cashShiftId = null, userId, note = null }) {
  return db
    .query(
      `INSERT INTO Cash_movements (type, method, amount, order_id, cash_shift_id, user_id, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(type, method, round2(amount), orderId, cashShiftId, userId, note).lastInsertRowid
}

export function refundOf(orderId) {
  return db
    .query(`SELECT id, method, amount, cash_shift_id, created_at FROM Cash_movements WHERE order_id = ? AND type = 'refund'`)
    .get(orderId)
}

const REFUND_COLUMNS = `
  m.id, m.method, m.amount, m.created_at, m.order_id, m.cash_shift_id,
  c.name AS client_name`
const REFUND_FROM = `
  FROM Cash_movements m
  LEFT JOIN Orders o ON o.id = m.order_id
  LEFT JOIN Clients c ON c.id = o.id_client`

export function refundsOfShift(shiftId) {
  return db
    .query(`SELECT ${REFUND_COLUMNS} ${REFUND_FROM} WHERE m.type = 'refund' AND m.cash_shift_id = ? ORDER BY m.created_at, m.id`)
    .all(shiftId)
}

export function refundsUnassignedToday() {
  return db
    .query(
      `SELECT ${REFUND_COLUMNS} ${REFUND_FROM}
       WHERE m.type = 'refund' AND m.cash_shift_id IS NULL
         AND date(m.created_at, 'localtime') = date('now', 'localtime')
       ORDER BY m.created_at DESC, m.id DESC`
    )
    .all()
}

// { cash, transfer } devueltos, para un turno o para los de hoy sin turno.
function totals(where, ...params) {
  const r = db
    .query(
      `SELECT COALESCE(SUM(CASE WHEN method = 'cash' THEN amount END), 0) AS cash,
              COALESCE(SUM(CASE WHEN method = 'transfer' THEN amount END), 0) AS transfer,
              COUNT(*) AS count
       FROM Cash_movements m
       WHERE m.type = 'refund' AND ${where}`
    )
    .get(...params)
  return { cash: round2(r.cash), transfer: round2(r.transfer), count: r.count }
}

export const refundTotalsOfShift = (shiftId) => totals('m.cash_shift_id = ?', shiftId)
export const refundTotalsUnassignedToday = () =>
  totals(`m.cash_shift_id IS NULL AND date(m.created_at, 'localtime') = date('now', 'localtime')`)
