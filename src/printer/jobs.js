// Trabajos de impresión en segundo plano.
//
// Guardar un pedido, cobrar o cerrar la caja no puede esperar a la impresora:
// si no responde, print() tarda hasta 10 s en rendirse. Así que la operación
// se guarda, el ticket se manda aquí y se responde de inmediato con el id del
// trabajo. La pantalla pide después el resultado (GET /print-jobs/:id) y lo
// muestra: "impreso" o el error con un botón para reintentar.
//
// Recargar la página no vuelve a imprimir: solo consulta un trabajo que ya
// existe. Los trabajos viven en memoria; si el servidor se reinicia se
// pierden, y entonces queda el botón "Reimprimir" de cada pantalla.
import { randomUUID } from 'node:crypto'
import { print as printBytes } from './device.js'

// Lo suficiente para que la pantalla alcance a preguntar, aunque haya varios
// trabajos en cola por delante.
export const JOB_TTL_MS = 15 * 60 * 1000

const jobs = new Map()

// `documents`: uno o varios tickets ya armados (Ticket#build()). Se mandan en
// una sola escritura, así el comprobante y la etiqueta de un pedido salen
// juntos aunque otra pantalla pida imprimir al mismo tiempo.
//
// `label` describe el trabajo en los mensajes: "Comprobante del pedido #12".
// `print` se puede reemplazar en las pruebas.
export function submit(documents, { label, print = printBytes } = {}) {
  purgeExpired()

  const bytes = concat(Array.isArray(documents) ? documents : [documents])
  const job = {
    id: randomUUID(),
    label: label || 'Ticket',
    bytes,
    print,
    status: 'pending',
    error: null,
    createdAt: Date.now()
  }
  job.done = print(bytes).then(
    () => {
      job.status = 'done'
    },
    (err) => {
      job.status = 'error'
      job.error = err?.message || String(err)
    }
  )
  jobs.set(job.id, job)
  return job.id
}

export function get(id) {
  purgeExpired()
  return jobs.get(id) || null
}

// Espera a que el trabajo termine, bien o mal. Nunca lanza: el resultado va en
// job.status y job.error.
export async function settle(id) {
  const job = get(id)
  if (!job) return null
  await job.done
  return job
}

// Vuelve a mandar los mismos bytes como un trabajo nuevo. No es una copia: el
// original no salió, así que no lleva la marca "COPIA".
export function retry(id) {
  const job = get(id)
  if (!job) return null
  return submit(job.bytes, { label: job.label, print: job.print })
}

function purgeExpired(now = Date.now()) {
  for (const [id, job] of jobs) {
    // Uno pendiente no se borra aunque sea viejo: alguien puede estar
    // esperando su resultado.
    if (job.status !== 'pending' && now - job.createdAt > JOB_TTL_MS) jobs.delete(id)
  }
}

function concat(parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}
