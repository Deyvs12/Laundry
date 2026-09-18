import db from '../db/database.js'

const COLUMNS = 'id, name, is_active, created_at'

export function list() {
  return db.query(`SELECT ${COLUMNS} FROM Staff ORDER BY is_active DESC, name`).all()
}

export function listActive() {
  return db.query(`SELECT ${COLUMNS} FROM Staff WHERE is_active = 1 ORDER BY name`).all()
}

export function findById(id) {
  return db.query(`SELECT ${COLUMNS} FROM Staff WHERE id = ?`).get(id)
}

export function create({ name }) {
  return db.query('INSERT INTO Staff (name) VALUES (?)').run(name).lastInsertRowid
}

export function update(id, { name }) {
  db.query('UPDATE Staff SET name = ? WHERE id = ?').run(name, id)
}

// Sin borrado: los pedidos históricos siguen apuntando a la persona.
export function toggleActive(id) {
  db.query('UPDATE Staff SET is_active = CASE is_active WHEN 1 THEN 0 ELSE 1 END WHERE id = ?').run(id)
}
