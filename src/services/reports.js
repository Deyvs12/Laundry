import db from '../db/database.js'
import { round2 } from '../money.js'

// Todo reporte de ingresos se basa en pedidos COBRADOS y en la fecha de cobro
// (payment_day), no en la de creación: lo que importa es cuándo entró el
// dinero. Las fechas se guardan en UTC, así que siempre 'localtime'.
const PAID_IN_RANGE = `o.paid = 1 AND date(o.payment_day, 'localtime') BETWEEN ?1 AND ?2`

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

  return {
    orders: row.orders,
    revenue: round2(row.revenue),
    discounts: round2(row.discounts),
    average: row.orders ? round2(row.revenue / row.orders) : 0
  }
}

// group: 'day' | 'week' | 'month'. La semana va de lunes a domingo y se
// etiqueta con la fecha de su lunes.
const GROUP_EXPR = {
  day: `date(o.payment_day, 'localtime')`,
  week: `date(o.payment_day, 'localtime', 'weekday 0', '-6 days')`,
  month: `strftime('%Y-%m', o.payment_day, 'localtime')`
}

export function revenueByPeriod({ from, to, group = 'day' }) {
  const expr = GROUP_EXPR[group] ?? GROUP_EXPR.day
  return db
    .query(
      `SELECT ${expr} AS period,
              COUNT(*) AS orders,
              COALESCE(SUM(CASE WHEN o.payment_method = 'cash' THEN o.total END), 0) AS cash,
              COALESCE(SUM(CASE WHEN o.payment_method = 'transfer' THEN o.total END), 0) AS transfer,
              COALESCE(SUM(o.total), 0) AS total
       FROM Orders o
       WHERE ${PAID_IN_RANGE}
       GROUP BY period
       ORDER BY period DESC`
    )
    .all(from, to)
    .map((r) => ({ ...r, cash: round2(r.cash), transfer: round2(r.transfer), total: round2(r.total) }))
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
  return db
    .query(
      `SELECT o.payment_method AS method, COUNT(*) AS orders, COALESCE(SUM(o.total), 0) AS total
       FROM Orders o
       WHERE ${PAID_IN_RANGE}
       GROUP BY o.payment_method
       ORDER BY total DESC`
    )
    .all(from, to)
    .map((r) => ({ ...r, total: round2(r.total) }))
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
