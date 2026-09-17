// Preload de bun test: cada ejecución usa una base de datos temporal propia.
// Nunca toca lavanderia.db del proyecto.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.LAVANDERIA_DB = join(mkdtempSync(join(tmpdir(), 'lavanderia-test-')), 'test.db')
