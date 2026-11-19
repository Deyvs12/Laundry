// Imprime el ticket de prueba sin levantar el servidor. Sirve para comprobar
// la instalación de la impresora en la computadora del cliente:
//
//   bun run scripts/print-test.js
//
// Usa LAVANDERIA_TICKETERA si está definida; si no, /dev/ticketera.
import { print, devicePath } from '../src/printer/device.js'
import { testTicket } from '../src/printer/test-ticket.js'

const path = devicePath()
console.log(`Imprimiendo ticket de prueba en ${path}...`)

try {
  await print(testTicket(), { path })
  console.log('Listo. Revisa el ticket.')
  process.exit(0)
} catch (err) {
  console.error(err.message)
  // Una escritura atorada mantendría vivo el proceso: se sale explícitamente.
  process.exit(1)
}
