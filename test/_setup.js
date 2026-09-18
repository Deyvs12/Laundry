// Preload de bun test: cada ejecución usa una base de datos temporal propia.
// Nunca toca lavanderia.db del proyecto.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'lavanderia-test-'))
process.env.LAVANDERIA_DB = join(dir, 'test.db')
process.env.LAVANDERIA_BACKUPS = join(dir, 'backups')
