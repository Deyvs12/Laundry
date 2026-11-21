import { escapeHtml } from '../_helpers.js'
import { alert, btn } from '../components.js'

// Aviso de un trabajo de impresión. Se coloca en cualquier pantalla después de
// una operación que imprime (crear pedido, cobrar, cerrar caja). Al cargarse,
// pide el resultado y se reemplaza a sí mismo con él.
export function printJobStatus(jobId) {
  if (!jobId) return ''
  return `
    <div class="print-job" hx-get="/print-jobs/${encodeURIComponent(jobId)}" hx-trigger="load" hx-swap="outerHTML">
      ${alert({ tone: 'info', message: 'Imprimiendo…' })}
    </div>
  `
}

export function printJobResult(job) {
  // Trabajo vencido o de antes de un reinicio: no hay nada que decir, y la
  // pantalla ya tiene su botón para reimprimir.
  if (!job) return ''

  if (job.status === 'done') {
    return `<div class="print-job">${alert({ tone: 'success', message: `${escapeHtml(job.label)}: impreso.` })}</div>`
  }

  return `
    <div class="print-job">
      ${alert({ tone: 'danger', title: `${escapeHtml(job.label)}: no se imprimió`, message: escapeHtml(job.error) })}
      <div class="mt-2">
        ${btn({
          label: 'Reintentar',
          variant: 'secondary',
          size: 'sm',
          // Reemplaza todo el aviso con el de un trabajo nuevo, que a su vez
          // pide su resultado.
          attrs: `hx-post="/print-jobs/${encodeURIComponent(job.id)}/retry" hx-target="closest .print-job" hx-swap="outerHTML" hx-disabled-elt="this"`
        })}
      </div>
    </div>
  `
}

export function printJobGone() {
  return `<div class="print-job">${alert({
    tone: 'warning',
    message: 'Ese trabajo de impresión ya no está disponible. Usa el botón para reimprimir de esta pantalla.'
  })}</div>`
}
