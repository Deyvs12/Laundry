import db from '../db/database.js'
import { round2 } from '../money.js'

// Todo reporte de ingresos se basa en pedidos COBRADOS y en la fecha de cobro
// (payment_day), no en la de creación: lo que importa es cuándo entró el
// dinero. Las fechas se guardan en UTC, así que siempre 'localtime'.
const PAID_IN_RANGE = `o.paid = 1 AND date(o.payment_day, 'localtime') BETWEEN ?1 AND ?2`
const REFUND_IN_RANGE = `m.type = 'refund' AND date(m.created_at, 'localtime') BETWEEN ?1 AND ?2`

export function summary({ from, to }) {
  const row = db
    .query(
      `SELECT COUNT(*) AS orders,
              COALESCE(SUM(o.total), 0) AS revenue,
              COALESCE(SUM(o.discount), 0) AS discounts
       FROM Orders o
       WHERE ${PAID_IN_RANGE}`
    )
    .get(from, to)

  const ref = db
    .query(`SELECT COUNT(*) AS count, COALESCE(SUM(m.amount), 0) AS total FROM Cash_movements m WHERE ${REFUND_IN_RANGE}`)
    .get(from, to)

  // Ingresos netos = cobros − devoluciones del periodo. La devolución se resta
  // el día que se hizo, no el día del cobro original.
  return {
    orders: row.orders,
    gross: round2(row.revenue),
    refunds: round2(ref.total),
    refund_count: ref.count,
    revenue: round2(row.revenue - ref.total),
    discounts: round2(row.discounts),
    average: row.orders ? round2(row.revenue / row.orders) : 0
  }
}

// group: 'day' | 'week' | 'month'. La semana va de lunes a domingo y se
// etiqueta con la fecha de su lunes.
const groupExpr = (col, group) =>
  ({
    day: `date(${col}, 'localtime')`,
    week: `date(${col}, 'localtime', 'weekday 0', '-6 days')`,
    month: `strftime('%Y-%m', ${col}, 'localtime')`
  })[group] ?? `date(${col}, 'localtime')`

export function revenueByPeriod({ from, to, group = 'day' }) {
  const paid = db
    .query(
      `SELECT ${groupExpr('o.payment_day', group)} AS period,
              COUNT(*) AS orders,
              COALESCE(SUM(CASE WHEN o.payment_method = 'cash' THEN o.total END), 0) AS cash,
              COALESCE(SUM(CASE WHEN o.payment_method = 'transfer' THEN o.total END), 0) AS transfer,
              COALESCE(SUM(o.total), 0) AS total
       FROM Orders o
       WHERE ${PAID_IN_RANGE}
       GROUP BY period`
    )
    .all(from, to)

  const refunds = db
    .query(
      `SELECT ${groupExpr('m.created_at', group)} AS period, COALESCE(SUM(m.amount), 0) AS refunds
       FROM Cash_movements m
       WHERE ${REFUND_IN_RANGE}
       GROUP BY period`
    )
    .all(from, to)

  // Se mezclan en JS: un periodo puede tener devoluciones sin cobros.
  const byPeriod = new Map()
  for (const r of paid) byPeriod.set(r.period, { period: r.period, orders: r.orders, cash: r.cash, transfer: r.transfer, total: r.total, refunds: 0 })
  for (const r of refunds) {
    const row = byPeriod.get(r.period) ?? { period: r.period, orders: 0, cash: 0, transfer: 0, total: 0, refunds: 0 }
    row.refunds = r.refunds
    byPeriod.set(r.period, row)
  }

  return [...byPeriod.values()]
    .sort((a, b) => (a.period < b.period ? 1 : -1))
    .map((r) => ({
      ...r,
      cash: round2(r.cash),
      transfer: round2(r.transfer),
      total: round2(r.total),
      refunds: round2(r.refunds),
      net: round2(r.total - r.refunds)
    }))
}

// El descuento vive en la cabecera del pedido, así que por tipo se reporta la
// venta bruta (suma de subtotales). La suma de tipos puede superar los
// ingresos netos justo por los descuentos.
export function byServiceType({ from, to }) {
  return db
    .query(
      `SELECT s.type,
              COUNT(DISTINCT o.id) AS orders,
              SUM(os.quantity) AS quantity,
              COALESCE(SUM(os.sub_total), 0) AS gross
       FROM Order_services os
       JOIN Orders o ON o.id = os.id_orders
       JOIN Services s ON s.id = os.id_services
       WHERE ${PAID_IN_RANGE}
       GROUP BY s.type
       ORDER BY gross DESC`
    )
    .all(from, to)
    .map((r) => ({ ...r, quantity: round2(r.quantity), gross: round2(r.gross) }))
}

export function byPaymentMethod({ from, to }) {
  const rows = db
    .query(
      `SELECT o.payment_method AS method, COUNT(*) AS orders, COALESCE(SUM(o.total), 0) AS total
       FROM Orders o
       WHERE ${PAID_IN_RANGE}
       GROUP BY o.payment_method`
    )
    .all(from, to)
  const refunds = Object.fromEntries(
    db
      .query(`SELECT m.method, COALESCE(SUM(m.amount), 0) AS total FROM Cash_movements m WHERE ${REFUND_IN_RANGE} GROUP BY m.method`)
      .all(from, to)
      .map((r) => [r.method, r.total])
  )
  return rows
    .map((r) => ({ ...r, total: round2(r.total), refunds: round2(refunds[r.method] ?? 0), net: round2(r.total - (refunds[r.method] ?? 0)) }))
    .sort((a, b) => b.net - a.net)
}

export function topClients({ from, to, limit = 10 }) {
  return db
    .query(
      `SELECT c.id, c.name, c.phone, COUNT(*) AS orders, COALESCE(SUM(o.total), 0) AS total
       FROM Orders o
       JOIN Clients c ON c.id = o.id_client
       WHERE ${PAID_IN_RANGE}
       GROUP BY c.id
       ORDER BY total DESC, orders DESC
       LIMIT ?3`
    )
    .all(from, to, limit)
    .map((r) => ({ ...r, total: round2(r.total) }))
}
