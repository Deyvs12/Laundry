import db from '../db/database.js'

export function findByUsername(username) {
  return db
    .query('SELECT id, username, name, password, role FROM Users WHERE username = ?')
    .get(username)
}

export function findById(id) {
  return db
    .query('SELECT id, username, name, role FROM Users WHERE id = ?')
    .get(id)
}

export function count() {
  return db.query('SELECT COUNT(*) AS n FROM Users').get().n
}

export function create({ username, name, password, role }) {
  const result = db
    .query(
      'INSERT INTO Users (username, name, password, role) VALUES (?, ?, ?, ?)'
    )
    .run(username, name, password, role)
  return result.lastInsertRowid
}

export function updatePassword(id, passwordHash) {
  db.query('UPDATE Users SET password = ? WHERE id = ?').run(passwordHash, id)
}
