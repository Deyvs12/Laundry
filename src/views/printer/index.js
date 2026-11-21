import { escapeHtml } from '../_helpers.js'
import { alert, btn, card, dataRow, pageHeader } from '../components.js'

export function printerPage({ path, business, missing = [] }) {
  return `
    ${pageHeader({
      title: 'Impresora de tickets',
      subtitle: 'Datos de los tickets y pruebas de la ticketera.'
    })}

    ${businessCard(business, missing)}

    ${card({
      title: 'Ticket de prueba',
      className: 'mt-5',
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

    ${card({
      title: 'Tamaños de letra y códigos de barras',
      className: 'mt-5',
      body: `
        <p class="text-sm text-slate-600 mb-4">
          Comandos que todavía no se han probado en esta impresora: letra al doble
          y al triple, y el folio en código de barras CODE128 y CODE39. Cada bloque
          dice qué debería verse. Los códigos se pueden comprobar con la cámara de
          un teléfono si no hay lector a la mano.
        </p>
        <div class="mb-4">
          ${btn({
            label: 'Imprimir prueba de comandos',
            iconName: 'check',
            size: 'lg',
            variant: 'secondary',
            attrs: 'hx-post="/printer/test-commands" hx-target="#printer-commands-result" hx-disabled-elt="this"'
          })}
        </div>
        <div id="printer-commands-result" aria-live="polite"></div>
      `
    })}
  `
}

// Lo que va a salir en el encabezado y el pie de cada ticket. Se edita en el
// archivo .env del servidor (README, "Impresora de tickets") y se aplica al
// reiniciarlo.
function businessCard(b, missing) {
  const show = (v) => (v ? escapeHtml(v) : '<span class="text-slate-400">—</span>')
  const many = (list) => (list.length ? list.map(escapeHtml).join('<br>') : show(''))
  return card({
    title: 'Datos del negocio en los tickets',
    body: `
      ${missing.length
        ? `<div class="mb-4">${alert({
            tone: 'warning',
            title: 'Faltan datos',
            message: `Sin valor: ${missing.map((m) => `<code>${m}</code>`).join(', ')}. Esas líneas no se imprimen.`
          })}</div>`
        : ''}
      ${dataRow('Nombre', show(b.name))}
      ${dataRow('Dirección', many(b.address))}
      ${dataRow('Teléfono', show(b.phone))}
      ${dataRow('Pie del ticket', many(b.footer))}
    `
  })
}

export function printResult({ error = null } = {}) {
  return error
    ? alert({ tone: 'danger', title: 'No se imprimió', message: escapeHtml(error) })
    : alert({ tone: 'success', message: 'Ticket enviado a la impresora.' })
}
