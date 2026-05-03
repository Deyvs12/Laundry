import { Database } from 'bun:sqlite'
import { schema } from './schema.js'

const db = new Database('lavanderia.db')
db.exec(schema)

export default db