import { mkdirSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import db, { DB_PATH } from '../db/database.js'

// Los respaldos van junto a la base, en backups/. Desde ahí se copian a un
// USB o se descargan desde otra PC de la red.
export const BACKUP_DIR = process.env.LAVANDERIA_BACKUPS || join(dirname(DB_PATH), 'backups')

const NAME_RE = /^lavanderia-\d{4}-\d{2}-\d{2}-\d{4}\.db$/

function stamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

// VACUUM INTO produce una copia consistente aunque la base esté en uso, y
// además compactada. Es la forma recomendada por SQLite de respaldar en caliente.
export function create() {
  mkdirSync(BACKUP_DIR, { recursive: true })
  let name = `lavanderia-${stamp()}.db`
  let path = join(BACKUP_DIR, name)
  // Dos respaldos en el mismo minuto: VACUUM INTO falla si el archivo existe.
  if (existsSync(path)) {
    name = name.replace('.db', `-${Date.now() % 1000}.db`)
    path = join(BACKUP_DIR, name)
  }
  db.query('VACUUM INTO ?').run(path)
  return name
}

export function list() {
  if (!existsSync(BACKUP_DIR)) return []
  return readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.db'))
    .map((name) => {
      const st = statSync(join(BACKUP_DIR, name))
      return { name, size: st.size, createdAt: st.mtime }
    })
    .sort((a, b) => b.createdAt - a.createdAt)
}

// Solo nombres con la forma exacta que generamos: ni rutas, ni "..", ni nada.
export function resolve(name) {
  if (!NAME_RE.test(name.replace(/-\d{1,3}\.db$/, '.db'))) return null
  const path = join(BACKUP_DIR, name)
  return existsSync(path) ? path : null
}
