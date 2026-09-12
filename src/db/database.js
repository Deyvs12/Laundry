import { Database } from 'bun:sqlite'
import { join } from 'node:path'
import { schema } from './schema.js'
import { runMigrations } from './migrations.js'

// Ruta absoluta: si el servidor arranca desde otro directorio (systemd, un
// atajo del escritorio), una ruta relativa crearía una base vacía en silencio.
// LAVANDERIA_DB permite apuntar a otra base (pruebas, restaurar un respaldo).
export const DB_PATH =
  process.env.LAVANDERIA_DB || join(import.meta.dir, '..', '..', 'lavanderia.db')

const db = new Database(DB_PATH)

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
