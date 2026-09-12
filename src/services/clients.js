import db from '../db/database.js'

export function list() {
  return db
    .query(
      `SELECT id, name, phone, notes, created_at
       FROM Clients
       WHERE is_active = 1
       ORDER BY name`
    )
    .all()
}

export function findById(id) {
  return db
    .query(
      `SELECT id, name, phone, notes, created_at
       FROM Clients
       WHERE id = ? AND is_active = 1`
    )
    .get(id)
}

// Búsqueda del mostrador: por nombre o por teléfono, en la misma caja.
export function search(term, limit = 8) {
  // \ escapa los comodines para que un "%" tecleado no traiga toda la tabla.
  const like = `%${term.replace(/[\\%_]/g, (m) => '\\' + m)}%`
  return db
    .query(
      `SELECT id, name, phone FROM Clients
       WHERE is_active = 1 AND (name LIKE ?1 ESCAPE '\\' OR phone LIKE ?1 ESCAPE '\\')
       ORDER BY name
       LIMIT ?2`
    )
    .all(like, limit)
}

export function create({ name, phone, notes }) {
  const result = db
    .query('INSERT INTO Clients (name, phone, notes) VALUES (?, ?, ?)')
    .run(name, phone || null, notes || null)
  return result.lastInsertRowid
}

export function update(id, { name, phone, notes }) {
  db.query(
    `UPDATE Clients
     SET name = ?, phone = ?, notes = ?
     WHERE id = ? AND is_active = 1`
  ).run(name, phone || null, notes || null, id)
}

export function softDelete(id) {
  db.query('UPDATE Clients SET is_active = 0 WHERE id = ?').run(id)
}
