import db from '../db/database.js'

const COLUMNS = 'id, name, type, price, price_type, is_active, created_at'

// Se listan también los inactivos: el catálogo es la lista de precios del
// negocio y hay que poder reactivar un servicio de temporada.
export function list({ type = null } = {}) {
  if (type) {
    return db
      .query(
        `SELECT ${COLUMNS} FROM Services
         WHERE type = ?
         ORDER BY is_active DESC, name`
      )
      .all(type)
  }

  return db
    .query(
      `SELECT ${COLUMNS} FROM Services
       ORDER BY is_active DESC, type, name`
    )
    .all()
}

export function findById(id) {
  return db.query(`SELECT ${COLUMNS} FROM Services WHERE id = ?`).get(id)
}

export function create({ name, type, price, price_type }) {
  const result = db
    .query(
      'INSERT INTO Services (name, type, price, price_type) VALUES (?, ?, ?, ?)'
    )
    .run(name, type, price, price_type)
  return result.lastInsertRowid
}

export function update(id, { name, type, price, price_type }) {
  db.query(
    `UPDATE Services
     SET name = ?, type = ?, price = ?, price_type = ?
     WHERE id = ?`
  ).run(name, type, price, price_type, id)
}

// No hay borrado: un servicio puede estar referenciado por pedidos históricos.
export function toggleActive(id) {
  db.query(
    `UPDATE Services
     SET is_active = CASE is_active WHEN 1 THEN 0 ELSE 1 END
     WHERE id = ?`
  ).run(id)
}
