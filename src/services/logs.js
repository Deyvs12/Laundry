import db from '../db/database.js'

export function insert({ userId, action, message, orderId = null, cashShiftId = null }) {
  db.query(
    `INSERT INTO Logs (user_id, order_id, cash_shift_id, action, message)
     VALUES (?, ?, ?, ?, ?)`
  ).run(userId, orderId, cashShiftId, action, message)
}
