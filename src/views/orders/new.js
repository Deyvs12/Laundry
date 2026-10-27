import { escapeHtml, formatMoney, todayLocal } from '../_helpers.js'
import { SERVICE_TYPES, quantityUnit, priceTypeLabel, serviceTypeLabel } from '../../constants.js'
import { card, btn, field, selectField, segmented, icon, alert, emptyState, pageHeader } from '../components.js'

// La pantalla completa es un <div>, no un <form>. Con hx-include el botón de
// guardar recoge igual todos los campos, y a cambio evitamos dos problemas:
// formularios anidados (el alta de cliente al vuelo vive aquí dentro) y envíos
// accidentales al pulsar Enter en el mostrador.
//
// Disposición de punto de venta: a la izquierda se busca y se arma, a la
// derecha el ticket queda siempre a la vista con su total. En tablet vertical
// y en teléfono se apila en ese mismo orden.
//
// Sirve para crear y para editar: en edición llega el pedido, sus líneas (ya
// en formato buildLines) y el cliente, y el botón hace PUT en vez de POST.
export function orderNewPage(initialServices, staff, { order = null, lines = [], client = null } = {}) {
  const editing = Boolean(order)
  const discount = editing ? order.discount : 0
  const totals = { subtotal: 0, discount, total: 0 }
  if (editing) {
    totals.subtotal = lines.reduce((sum, l) => sum + l.sub_total, 0)
    totals.total = totals.subtotal - discount
  }
  // min del calendario: hoy, salvo que el pedido ya tuviera una fecha anterior
  // (se creó otro día); esa se puede conservar pero no elegir otra pasada.
  const today = todayLocal()
  const minDate =
    editing && order.expected_delivery_date && order.expected_delivery_date < today
      ? order.expected_delivery_date
      : today

  return `
    ${pageHeader({
      title: editing ? `Editar pedido #${order.id}` : 'Nuevo pedido',
      subtitle: editing ? null : 'Elige el cliente, agrega los servicios y confirma.',
      actions: `<a href="${editing ? `/orders/${order.id}` : '/orders'}" class="btn btn-ghost btn-sm">${
        editing ? 'Volver al pedido' : 'Ver pedidos'
      }</a>`
    })}

    ${
      editing
        ? `<div class="mb-5">${alert({ tone: 'warning', message: 'Al guardar, los servicios capturados reemplazan a los anteriores.' })}</div>`
        : ''
    }

    <div id="order-form" class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-5 items-start">

      <div class="space-y-5 min-w-0">
        ${clientCard(client)}
        ${servicesCard(initialServices)}
      </div>

      <div class="lg:sticky lg:top-28 space-y-5">
        ${ticketCard({ lines, totals, discount, staff, editing, order, minDate })}
      </div>

    </div>

    ${clientScript()}
  `
}

/* ============================ 1. cliente ============================ */

function clientCard(client) {
  const body = `
    <div class="relative">
      <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
        ${icon('search', 'w-[18px] h-[18px]')}
      </span>
      <input
        id="client-search"
        name="client_search"
        type="text"
        placeholder="Buscar por nombre o teléfono…"
        autocomplete="off"
        hx-get="/orders/new/clients"
        hx-trigger="input changed delay:300ms"
        hx-target="#client-results"
        hx-swap="innerHTML"
        hx-on:keydown="if(event.key==='Enter'){event.preventDefault();window.clienteEnter()}"
        class="input pl-10">
    </div>

    <div id="client-results" class="mt-2" hx-on::after-request="window.limpiarBusquedaCliente()"></div>

    ${clientBox(client)}

    <details id="new-client" class="mt-4 pt-4 border-t border-slate-200">
      <summary class="flex items-center gap-2 text-sm font-medium text-brand-700 cursor-pointer list-none select-none py-1">
        ${icon('plus', 'w-4 h-4')} ¿Cliente nuevo?
      </summary>
      <div class="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 mt-3"
        hx-on:keydown="if(event.key==='Enter'){event.preventDefault();document.getElementById('new-client-submit').click()}">
        <input name="new_client_name" type="text" placeholder="Nombre" class="input">
        <input name="new_client_phone" type="text" placeholder="Teléfono" class="input">
        ${btn({
          label: 'Crear y usar',
          variant: 'secondary',
          attrs:
            'id="new-client-submit" hx-post="/orders/new/clients" hx-include="#new-client" hx-target="#client-box" hx-swap="outerHTML" hx-on::after-request="window.limpiarBusquedaCliente()"'
        })}
      </div>
    </details>
  `
  return card({ title: '1. Cliente', body })
}

// El calendario de <input type="date"> es nativo: sale en el idioma del
// navegador o del sistema, e ignora el lang="es" de la página. En un equipo con
// locale en inglés eso significa nombres en inglés y, peor, formato MM/DD, que
// para una fecha como 05/09 es ambiguo y se puede leer al revés.
//
// Se resuelve sin depender de la configuración del equipo:
//   - Atajos para los casos habituales, que evitan abrir el calendario.
//   - Un eco de la fecha elegida escrito en español, que quita toda duda.
// El eco usa Intl del navegador, que trae todos los idiomas incorporados y no
// depende de los locales instalados en el sistema.
const DELIVERY_SHORTCUTS = [
  ['Hoy', 0],
  ['Mañana', 1],
  ['En 2 días', 2],
  ['En 3 días', 3]
]

function deliveryField({ value, minDate }) {
  return `
    <div>
      <label class="label" for="expected">Entrega estimada</label>

      <div class="flex flex-wrap gap-1.5 mb-2">
        ${DELIVERY_SHORTCUTS.map(
          ([label, days]) =>
            `<button type="button" class="btn btn-secondary btn-sm"
              hx-on:click="window.fijarEntrega(${days})">${label}</button>`
        ).join('')}
      </div>

      <input id="expected" name="expected_delivery_date" type="date"
        min="${minDate}" value="${escapeHtml(value)}"
        class="input" hx-on:change="window.mostrarEntrega()">

      <p id="expected-echo" class="hint empty:hidden"></p>
    </div>
  `
}

// Atajos de teclado del buscador de clientes. Cada uno ahorra un toque en el
// mostrador, que es donde se nota.
function clientScript() {
  return `<script>
    // Enter en el buscador: si hay resultados, elige el primero. Si no hay
    // ninguno, abre el alta con lo tecleado ya puesto en el campo que toca.
    window.clienteEnter = function () {
      var primero = document.querySelector('#client-matches button')
      if (primero) { primero.click(); return }

      var aviso = document.getElementById('client-no-match')
      if (!aviso) return

      var alta = document.getElementById('new-client')
      alta.open = true

      var esTelefono = aviso.dataset.kind === 'phone'
      var puesto = esTelefono ? 'new_client_phone' : 'new_client_name'
      var falta  = esTelefono ? 'new_client_name'  : 'new_client_phone'
      alta.querySelector('[name=' + puesto + ']').value = aviso.dataset.term
      alta.querySelector('[name=' + falta + ']').focus()
    }

    // Con el cliente ya elegido, la búsqueda y el alta sobran en pantalla.
    // Si la petición falló, no hay hidden id_client y no se toca nada.
    window.limpiarBusquedaCliente = function () {
      if (!document.querySelector('#client-box input[name=id_client]')) return

      var buscador = document.getElementById('client-search')
      if (buscador) buscador.value = ''

      var resultados = document.getElementById('client-results')
      if (resultados) resultados.innerHTML = ''

      var alta = document.getElementById('new-client')
      if (alta) {
        alta.open = false
        alta.querySelectorAll('input').forEach(function (i) { i.value = '' })
      }
    }

    // Fecha de entrega a N días de hoy, sin abrir el calendario.
    window.fijarEntrega = function (dias) {
      var d = new Date()
      d.setDate(d.getDate() + dias)
      var p = function (n) { return String(n).padStart(2, '0') }
      document.getElementById('expected').value =
        d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
      window.mostrarEntrega()
    }

    // Escribe la fecha elegida en español bajo el campo.
    window.mostrarEntrega = function () {
      var input = document.getElementById('expected')
      var eco = document.getElementById('expected-echo')
      if (!input || !eco) return
      if (!input.value) { eco.textContent = ''; return }

      // Con componentes locales: new Date('2026-09-30') se interpreta en UTC y
      // en México mostraría el día anterior.
      var t = input.value.split('-')
      var d = new Date(Number(t[0]), Number(t[1]) - 1, Number(t[2]))
      eco.textContent = d.toLocaleDateString('es-MX', {
        weekday: 'long', day: 'numeric', month: 'long'
      })
    }

    window.mostrarEntrega()
  </script>`
}

// Lleva el hidden id_client. Si no hay cliente elegido, va vacío y el servidor
// rechaza el pedido.
export function clientBox(client, { error = null } = {}) {
  if (!client) {
    return `<div id="client-box" class="mt-3">
      ${
        error
          ? alert({ tone: 'danger', message: escapeHtml(error) })
          : '<p class="text-sm text-slate-500">Ningún cliente seleccionado.</p>'
      }
    </div>`
  }

  return `<div id="client-box" class="mt-3 flex items-center justify-between gap-3 rounded-lg bg-brand-50 border border-brand-200 px-3 py-2.5">
    <input type="hidden" name="id_client" value="${client.id}">
    <span class="flex items-center gap-2 min-w-0">
      <span class="grid place-items-center w-8 h-8 rounded-full bg-brand-600 text-white shrink-0">
        ${icon('user', 'w-4 h-4')}
      </span>
      <span class="min-w-0">
        <span class="block font-medium text-slate-900 truncate">${escapeHtml(client.name)}</span>
        ${client.phone ? `<span class="block text-xs text-slate-500">${escapeHtml(client.phone)}</span>` : ''}
      </span>
    </span>
    <button
      hx-get="/orders/new/clients/clear"
      hx-target="#client-box"
      hx-swap="outerHTML"
      class="btn btn-ghost btn-sm shrink-0">Cambiar</button>
  </div>`
}

// Un texto de solo dígitos y separadores se trata como teléfono. El dato viaja
// en data-kind para que el guion de Enter no tenga que volver a adivinarlo.
const looksLikePhone = (term) => /^[\d\s()+-]{3,}$/.test(term)

export function clientResults(clients, term) {
  if (!term) return ''

  if (clients.length === 0) {
    const kind = looksLikePhone(term) ? 'phone' : 'name'
    return `<div id="client-no-match" data-kind="${kind}" data-term="${escapeHtml(term)}"
      class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm">
      <p class="text-amber-900">Sin coincidencias para "${escapeHtml(term)}".</p>
      <p class="text-amber-800 mt-0.5">
        Pulsa <kbd class="px-1.5 py-0.5 rounded border border-amber-300 bg-white text-xs font-semibold">Enter</kbd>
        para darlo de alta con ${kind === 'phone' ? 'este teléfono' : 'este nombre'}.
      </p>
    </div>`
  }

  return `<ul id="client-matches" class="rounded-lg border border-slate-200 divide-y divide-slate-100 overflow-hidden">
    ${clients
      .map(
        (c) => `<li>
      <button
        hx-get="/orders/new/clients/${c.id}"
        hx-target="#client-box"
        hx-swap="outerHTML"
        class="pick-row">
        <span class="font-medium text-slate-900 truncate">${escapeHtml(c.name)}</span>
        ${c.phone ? `<span class="text-sm text-slate-500 shrink-0">${escapeHtml(c.phone)}</span>` : ''}
      </button>
    </li>`
      )
      .join('')}
  </ul>`
}

/* ============================ 2. servicios ============================ */

function servicesCard(initialServices) {
  return card({ title: '2. Servicios', body: servicePicker(initialServices) })
}

// Buscador en lugar de un <select>: con un catálogo de 200 precios, recorrer
// una lista desplegable es inservible en el mostrador. Se filtra por tipo y
// por nombre, y cada resultado se agrega con un solo toque.
function servicePicker({ rows, total }) {
  if (total === 0) {
    return alert({
      tone: 'danger',
      message:
        'No hay servicios activos en el catálogo. <a href="/services" class="underline font-medium">Carga la lista de precios</a> antes de registrar pedidos.'
    })
  }

  const hx = 'hx-get="/orders/new/services" hx-include="#service-picker" hx-target="#service-results" hx-swap="innerHTML"'

  return `
    <div id="service-picker">
      ${segmented({
        name: 'service_type',
        label: 'Tipo de servicio',
        options: [{ value: '', label: 'Todos' }, ...SERVICE_TYPES],
        selected: '',
        // El evento change de los radios burbujea hasta este contenedor.
        attrs: `hx-trigger="change" ${hx}`,
        className: 'mb-3'
      })}

      <div class="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
        ${field({
          label: 'Buscar',
          name: 'service_search',
          placeholder: 'Nombre del servicio…',
          attrs: `autocomplete="off" hx-trigger="input changed delay:250ms" ${hx}`
        })}
        ${field({
          label: 'Cantidad',
          name: 'pick_quantity',
          id: 'pick-quantity',
          value: '1',
          inputmode: 'decimal'
        })}
      </div>

      <div id="line-error" class="text-sm text-rose-600 mt-2 empty:hidden"></div>
      <div id="service-results" class="mt-3">${serviceResults({ rows, total })}</div>
    </div>
  `
}

// Cada resultado manda su id con hx-vals; la cantidad viaja en el hx-include.
export function serviceResults({ rows, total }) {
  if (rows.length === 0) {
    return emptyState({
      iconName: 'search',
      title: 'Sin servicios que coincidan con la búsqueda.',
      message: 'Prueba con otro nombre o cambia el tipo.'
    })
  }

  const extra =
    total > rows.length
      ? `<p class="text-xs text-slate-500 mt-2 px-1">Mostrando ${rows.length} de ${total}. Afina la búsqueda para ver el resto.</p>`
      : ''

  return `
    <ul class="rounded-lg border border-slate-200 divide-y divide-slate-100 overflow-hidden max-h-[26rem] overflow-y-auto">
      ${rows
        .map(
          (s) => `<li>
        <button
          hx-post="/orders/new/lines"
          hx-vals='{"pick_service_id": ${s.id}}'
          hx-include="#order-form"
          hx-target="#lines-body"
          hx-swap="outerHTML"
          class="pick-row group">
          <span class="min-w-0">
            <span class="block font-medium text-slate-900 truncate">${escapeHtml(s.name)}</span>
            <span class="block text-xs text-slate-500">${escapeHtml(serviceTypeLabel(s.type))}</span>
          </span>
          <span class="flex items-center gap-3 shrink-0">
            <span class="text-right">
              <span class="block font-semibold text-slate-900">${formatMoney(s.price)}</span>
              <span class="block text-xs text-slate-500">${escapeHtml(priceTypeLabel(s.price_type).toLowerCase())}</span>
            </span>
            <span class="grid place-items-center w-8 h-8 rounded-full bg-brand-100 text-brand-700 group-hover:bg-brand-600 group-hover:text-white transition-colors">
              ${icon('plus', 'w-4 h-4')}
            </span>
          </span>
        </button>
      </li>`
        )
        .join('')}
    </ul>${extra}
  `
}

/* ============================ ticket ============================ */

function ticketCard({ lines, totals, discount, staff, editing, order, minDate }) {
  const body = `
    <table class="w-full text-sm">
      ${renderLinesBody(lines)}
    </table>

    <div class="border-t border-slate-200 px-4 sm:px-5 py-4 space-y-4">
      ${field({
        label: 'Descuento',
        name: 'discount',
        id: 'discount',
        value: String(discount),
        inputmode: 'decimal',
        attrs:
          'hx-post="/orders/new/summary" hx-include="#order-form" hx-target="#order-summary" hx-swap="outerHTML" hx-trigger="input changed delay:400ms"',
        hint: 'Monto fijo sobre el total. Queda registrado en la bitácora.'
      })}

      ${orderSummary(totals)}
    </div>

    <div class="border-t border-slate-200 px-4 sm:px-5 py-4 space-y-4">
      ${deliveryField({ value: editing ? order.expected_delivery_date || '' : '', minDate })}

      ${staffPicker(staff, editing ? String(order.id_staff ?? '') : '')}

      ${field({
        label: 'Notas',
        name: 'notes',
        id: 'notes',
        value: editing ? order.notes || '' : '',
        placeholder: 'Manchas, indicaciones…'
      })}
    </div>

    <div class="border-t border-slate-200 px-4 sm:px-5 py-4">
      <div id="order-error" class="text-sm text-rose-600 mb-3 empty:hidden"></div>
      ${btn({
        label: editing ? 'Guardar cambios' : 'Crear pedido',
        size: 'lg',
        block: true,
        iconName: 'check',
        attrs: `${editing ? `hx-put="/orders/${order.id}"` : 'hx-post="/orders"'} hx-include="#order-form" hx-target="#order-error" hx-swap="innerHTML"`
      })}
    </div>
  `

  return card({ title: editing ? 'Pedido' : 'Resumen del pedido', body, pad: false })
}

// Cada línea guarda únicamente servicio y cantidad. El precio no viaja en el
// formulario: se vuelve a leer del catálogo en el servidor.
export function renderLinesBody(lines) {
  if (lines.length === 0) {
    return `<tbody id="lines-body">
      <tr><td class="px-4 sm:px-5 py-8 text-center">
        <p class="text-sm text-slate-500">Aún no has agregado servicios.</p>
        <p class="text-xs text-slate-400 mt-1">Búscalos en el panel de la izquierda.</p>
      </td></tr>
    </tbody>`
  }

  return `<tbody id="lines-body">
    ${lines
      .map(
        (line, index) => `
      <tr class="border-b border-slate-100 last:border-b-0">
        <td class="px-4 sm:px-5 py-3">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="font-medium text-slate-900 leading-tight">${escapeHtml(line.name)}</p>
              <p class="text-xs text-slate-500 mt-0.5">
                ${line.quantity} ${escapeHtml(quantityUnit(line.price_type))} × ${formatMoney(line.unit_price)}
              </p>
              <input type="hidden" name="line_service_id[]" value="${line.id_services}">
              <input type="hidden" name="line_quantity[]" value="${line.quantity}">
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <span class="font-semibold text-slate-900 tabular-nums">${formatMoney(line.sub_total)}</span>
              <button
                hx-post="/orders/new/lines/remove"
                hx-vals='{"remove_index": ${index}}'
                hx-include="#order-form"
                hx-target="#lines-body"
                hx-swap="outerHTML"
                aria-label="Quitar ${escapeHtml(line.name)}"
                class="grid place-items-center w-8 h-8 rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors">
                ${icon('trash', 'w-4 h-4')}
              </button>
            </div>
          </div>
        </td>
      </tr>`
      )
      .join('')}
  </tbody>`
}

export function orderSummary({ subtotal, discount, total, warning = null }) {
  return `<div id="order-summary" class="space-y-1.5">
    <div class="flex justify-between text-sm">
      <span class="text-slate-500">Subtotal</span>
      <span class="text-slate-900 tabular-nums">${formatMoney(subtotal)}</span>
    </div>
    <div class="flex justify-between text-sm">
      <span class="text-slate-500">Descuento</span>
      <span class="${discount > 0 ? 'text-rose-600' : 'text-slate-900'} tabular-nums">${discount > 0 ? '-' : ''}${formatMoney(discount)}</span>
    </div>
    <div class="flex justify-between items-baseline pt-2 mt-2 border-t border-slate-200">
      <span class="font-medium text-slate-700">Total</span>
      <span class="text-2xl font-semibold text-brand-700 tabular-nums">${formatMoney(total)}</span>
    </div>
    ${warning ? `<p class="text-sm text-rose-600 pt-1">${escapeHtml(warning)}</p>` : ''}
  </div>`
}

/* ============================ ¿quién atendió? ============================ */

// Un solo usuario inicia sesión, así que la persona que atendió se elige aquí.
// Sin valor por defecto a propósito: una atribución equivocada es peor que un
// toque más.
function staffPicker(staff, selected = '') {
  if (staff.length === 0) {
    return alert({
      tone: 'danger',
      message:
        'No hay personal registrado. <a href="/staff" class="underline font-medium">Da de alta a las personas que atienden</a> antes de registrar pedidos.'
    })
  }
  return selectField({
    label: '¿Quién atendió?',
    name: 'id_staff',
    options: staff.map((p) => ({ value: String(p.id), label: p.name })),
    selected,
    placeholder: 'Selecciona una persona…',
    required: true
  })
}
