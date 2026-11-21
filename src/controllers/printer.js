import { print, devicePath, PrinterError } from '../printer/device.js'
import { testTicket, commandsTestTicket } from '../printer/test-ticket.js'
import { business, missingBusinessVars } from '../printer/business.js'
import { render } from '../render.js'
import { printerPage, printResult } from '../views/printer/index.js'

export function index(c) {
  return render(c, { title: 'Impresora — Laundry', body: printerPage({ path: devicePath(), business: business(), missing: missingBusinessVars() }) })
}

// Siempre responde 200: HTMX no pinta las respuestas con código de error, y el
// mensaje tiene que verse en la pantalla (ver DESIGN.md).
export const test = (c) => printAndReport(c, testTicket)
export const testCommands = (c) => printAndReport(c, commandsTestTicket)

async function printAndReport(c, build) {
  try {
    await print(build())
    return c.html(printResult())
  } catch (err) {
    if (!(err instanceof PrinterError)) console.error('[printer]', err)
    return c.html(printResult({ error: err.message }))
  }
}
