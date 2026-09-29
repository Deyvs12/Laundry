// Preload de bun test: cada ejecución usa una base de datos temporal propia.
// Nunca toca lavanderia.db del proyecto.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// `bun test` pone el reloj de JavaScript en UTC, pero SQLite sigue leyendo la
// zona del sistema. Con esa mezcla, 'hoy' según JavaScript y 'hoy' según
// date(...,'localtime') dejan de coincidir entre las 18:00 y la medianoche en
// México, y las pruebas de reportes y de caja fallaban según la hora a la que
// se corrieran. Fijar la zona alinea a los dos, igual que en producción.
process.env.TZ = 'America/Mexico_City'

const dir = mkdtempSync(join(tmpdir(), 'lavanderia-test-'))
process.env.LAVANDERIA_DB = join(dir, 'test.db')
process.env.LAVANDERIA_BACKUPS = join(dir, 'backups')
