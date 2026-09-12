import { Database } from 'bun:sqlite'
import { schema } from './schema.js'
import { runMigrations } from './migrations.js'

const db = new Database('lavanderia.db')

// Va en su propio exec y se verifica: foreign_keys es por conexión, y el
// PRAGMA es no-op silencioso si cae dentro de una transacción. Si alguna vez
// deja de aplicarse, preferimos que el servidor no arranque a que borre datos
// en silencio.
db.exec('PRAGMA foreign_keys = ON')

const { foreign_keys } = db.query('PRAGMA foreign_keys').get()
if (foreign_keys !== 1) {
  throw new Error('No se pudo activar PRAGMA foreign_keys — abortando')
}

db.exec(schema)
runMigrations(db)

export default db
