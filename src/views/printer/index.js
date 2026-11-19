import { escapeHtml } from '../_helpers.js'
import { alert, btn, card, pageHeader } from '../components.js'

export function printerPage({ path }) {
  return `
    ${pageHeader({
      title: 'Impresora de tickets',
      subtitle: 'Prueba de conexión con la ticketera.'
    })}

    ${card({
      title: 'Ticket de prueba',
      body: `
        <p class="text-sm text-slate-600 mb-4">
          Dispositivo: <code>${escapeHtml(path)}</code>.
          El ticket trae acentos, una regla de 32 columnas y renglones con precio.
          Revisa que no falte ningún carácter.
        </p>
        <div class="mb-4">
          ${btn({
            label: 'Imprimir ticket de prueba',
            iconName: 'check',
            size: 'lg',
            // hx-disabled-elt evita mandar dos tickets por un doble toque.
            attrs: 'hx-post="/printer/test" hx-target="#printer-result" hx-disabled-elt="this"'
          })}
        </div>
        <div id="printer-result" aria-live="polite"></div>
      `
    })}
  `
}

export function printResult({ error = null } = {}) {
  return error
    ? alert({ tone: 'danger', title: 'No se imprimió', message: escapeHtml(error) })
    : alert({ tone: 'success', message: 'Ticket enviado a la impresora.' })
}
