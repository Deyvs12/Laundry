import db from '../db/database.js'

export function insert({ userId, action, message, orderId = null, cashShiftId = null }) {
  db.query(
    `INSERT INTO Logs (user_id, order_id, cash_shift_id, action, message)
     VALUES (?, ?, ?, ?, ?)`
  ).run(userId, orderId, cashShiftId, action, message)
}

export const PAGE_SIZE = 100

// Lectura para la bitácora. Paginación por cursor (before = último id visto):
// con miles de filas es más barata y estable que OFFSET.
export function list({ action = null, from = null, to = null, orderId = null, before = null } = {}) {
  const where = []
  const params = []

  if (action) { where.push('l.action = ?'); params.push(action) }
  if (from) { where.push(`date(l.created_at, 'localtime') >= ?`); params.push(from) }
  if (to) { where.push(`date(l.created_at, 'localtime') <= ?`); params.push(to) }
  if (orderId) { where.push('l.order_id = ?'); params.push(orderId) }
  if (before) { where.push('l.id < ?'); params.push(before) }

  // Se pide una fila de más para saber si hay página siguiente.
  const rows = db
    .query(
      `SELECT l.id, l.action, l.message, l.order_id, l.cash_shift_id, l.created_at,
              u.name AS user_name
       FROM Logs l
       JOIN Users u ON u.id = l.user_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY l.id DESC
       LIMIT ?`
    )
    .all(...params, PAGE_SIZE + 1)

  const hasMore = rows.length > PAGE_SIZE
  return { rows: hasMore ? rows.slice(0, PAGE_SIZE) : rows, hasMore }
}
