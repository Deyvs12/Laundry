import db from '../db/database.js'

// Solo puede haber un turno abierto a la vez. Si no hay ninguno, el cobro se
// registra igual pero sin turno: el corte de caja no lo verá.
export function findOpen() {
  return (
    db
      .query(
        `SELECT id, user_id, opening_time FROM Cash_shifts
         WHERE status = 'open'
         ORDER BY id DESC
         LIMIT 1`
      )
      .get() || null
  )
}
