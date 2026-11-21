import * as jobs from '../printer/jobs.js'
import { printJobStatus, printJobResult, printJobGone } from '../views/printer/job.js'

// Responde cuando el trabajo termina. Si hay tickets por delante en la cola,
// la petición espera con ellos; mientras tanto la pantalla sigue diciendo
// "Imprimiendo…" y se puede usar con normalidad.
export async function show(c) {
  const job = await jobs.settle(c.req.param('id'))
  return c.html(printJobResult(job))
}

export function retry(c) {
  const id = jobs.retry(c.req.param('id'))
  return c.html(id ? printJobStatus(id) : printJobGone())
}
