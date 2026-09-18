import { escapeHtml, formatMoney, renderOptions, todayLocal } from '../_helpers.js'
import {
  SERVICE_TYPES,
  quantityUnit,
  priceTypeLabel,
  serviceTypeLabel
} from '../../constants.js'

// La pantalla completa es un <div>, no un <form>. Con hx-include el botón de
// guardar recoge igual todos los campos, y a cambio evitamos dos problemas:
// formularios anidados (el alta de cliente al vuelo vive aquí dentro) y envíos
// accidentales al pulsar Enter en el mostrador.
export function orderNewPage(initialServices, staff) {
  return `
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-semibold">Nuevo pedido</h1>
      <a href="/orders" class="text-sm text-slate-600 hover:text-slate-900">Volver a pedidos</a>
    </div>

    <div id="order-form" class="space-y-6">

      <section class="border border-slate-300 rounded p-4">
        <h2 class="font-semibold mb-3">1. Cliente</h2>

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
          class="w-full border border-slate-300 rounded px-3 py-2">

        <div id="client-results" class="mt-2"></div>

        ${clientBox(null)}

        <div id="new-client" class="mt-3 pt-3 border-t border-slate-200">
          <p class="text-sm text-slate-500 mb-2">¿Cliente nuevo?</p>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input name="new_client_name" type="text" placeholder="Nombre"
              class="border border-slate-300 rounded px-3 py-2">
            <input name="new_client_phone" type="text" placeholder="Teléfono"
              class="border border-slate-300 rounded px-3 py-2">
            <button
              hx-post="/orders/new/clients"
              hx-include="#new-client"
              hx-target="#client-box"
              hx-swap="outerHTML"
              class="bg-slate-200 px-3 py-2 rounded">Crear y usar</button>
          </div>
        </div>
      </section>

      <section class="border border-slate-300 rounded p-4">
        <h2 class="font-semibold mb-3">2. Servicios</h2>

        ${servicePicker(initialServices)}

        <table class="w-full border border-slate-300 text-sm mt-4">
          <thead class="bg-slate-100 text-left">
            <tr>
              <th class="border border-slate-300 px-3 py-2">Servicio</th>
              <th class="border border-slate-300 px-3 py-2 w-32">Cantidad</th>
              <th class="border border-slate-300 px-3 py-2 w-32">Precio</th>
              <th class="border border-slate-300 px-3 py-2 w-32">Subtotal</th>
              <th class="border border-slate-300 px-3 py-2 w-24"></th>
            </tr>
          </thead>
          ${renderLinesBody([])}
        </table>
      </section>

      <section class="border border-slate-300 rounded p-4">
        <h2 class="font-semibold mb-3">3. Totales</h2>

        <div class="mb-3">
          <label class="block text-sm font-medium mb-1" for="discount">Descuento</label>
          <input
            id="discount"
            name="discount"
            type="text"
            inputmode="decimal"
            value="0"
            hx-post="/orders/new/summary"
            hx-include="#order-form"
            hx-target="#order-summary"
            hx-swap="outerHTML"
            hx-trigger="input changed delay:400ms"
            class="border border-slate-300 rounded px-3 py-2 w-40">
          <p class="text-xs text-slate-500 mt-1">Monto fijo sobre el total. Queda registrado en la bitácora.</p>
        </div>

        ${orderSummary({ subtotal: 0, discount: 0, total: 0 })}
      </section>

      <section class="border border-slate-300 rounded p-4">
        <h2 class="font-semibold mb-3">4. Datos del pedido</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium mb-1" for="expected">Entrega estimada</label>
            <input id="expected" name="expected_delivery_date" type="date" min="${todayLocal()}"
              class="border border-slate-300 rounded px-3 py-2">
          </div>
          <div>
            <label class="block text-sm font-medium mb-1" for="notes">Notas</label>
            <input id="notes" name="notes" type="text" placeholder="Manchas, indicaciones…"
              class="w-full border border-slate-300 rounded px-3 py-2">
          </div>
        </div>
      </section>

      <section class="border border-slate-300 rounded p-4">
        <h2 class="font-semibold mb-3">5. ¿Quién atendió?</h2>
        ${staffPicker(staff)}
      </section>

    </div>

    <div class="flex items-center gap-4 mt-4">
      <button
        hx-post="/orders"
        hx-include="#order-form"
        hx-target="#order-error"
        hx-swap="innerHTML"
        class="bg-slate-800 text-white px-4 py-2 rounded">Crear pedido</button>
      <div id="order-error" class="text-sm text-red-600"></div>
    </div>
  `
}

// Un solo usuario inicia sesión, así que la persona que atendió se elige aquí.
// Sin valor por defecto a propósito: una atribución equivocada es peor que un
// clic más.
function staffPicker(staff) {
  if (staff.length === 0) {
    return `<p class="text-sm text-red-600">
      No hay personal registrado.
      <a href="/staff" class="underline">Da de alta a las personas que atienden</a> antes de registrar pedidos.
    </p>`
  }
  return `
    <select name="id_staff" required class="border border-slate-300 rounded px-3 py-2 w-full md:w-72">
      ${renderOptions(staff.map((p) => ({ value: String(p.id), label: p.name })), '', 'Selecciona una persona…')}
    </select>
  `
}

// Buscador en lugar de un <select>: con un catálogo de 200 precios, recorrer
// una lista desplegable es inservible en el mostrador. Se filtra por tipo y
// por nombre, y cada resultado se agrega con un solo clic.
function servicePicker({ rows, total }) {
  if (total === 0) {
    return `<p class="text-sm text-red-600">
      No hay servicios activos en el catálogo.
      <a href="/services" class="underline">Carga la lista de precios</a> antes de registrar pedidos.
    </p>`
  }

  return `
    <div id="service-picker" class="space-y-3">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
        <select
          name="service_type"
          hx-get="/orders/new/services"
          hx-include="#service-picker"
          hx-target="#service-results"
          hx-swap="innerHTML"
          class="border border-slate-300 rounded px-3 py-2">
          ${renderOptions(SERVICE_TYPES, '', 'Todos los tipos')}
        </select>

        <input
          name="service_search"
          type="text"
          placeholder="Buscar servicio por nombre…"
          autocomplete="off"
          hx-get="/orders/new/services"
          hx-include="#service-picker"
          hx-trigger="input changed delay:250ms"
          hx-target="#service-results"
          hx-swap="innerHTML"
          class="border border-slate-300 rounded px-3 py-2">

        <div>
          <label class="block text-xs text-slate-500 mb-1" for="pick-quantity">Cantidad a agregar</label>
          <input id="pick-quantity" name="pick_quantity" type="text" inputmode="decimal"
            value="1"
            class="w-full border border-slate-300 rounded px-3 py-2">
        </div>
      </div>

      <div id="line-error" class="text-sm text-red-600"></div>
      <div id="service-results">${serviceResults({ rows, total })}</div>
    </div>
  `
}

// Cada resultado reutiliza el mismo endpoint que tenía el botón "Agregar":
// manda su id con hx-vals y la cantidad viaja en el hx-include.
export function serviceResults({ rows, total }) {
  if (rows.length === 0) {
    return `<p class="text-sm text-slate-500">Sin servicios que coincidan con la búsqueda.</p>`
  }

  const extra =
    total > rows.length
      ? `<p class="text-xs text-slate-500 mt-1">Mostrando ${rows.length} de ${total}. Afina la búsqueda para ver el resto.</p>`
      : ''

  return `
    <ul class="border border-slate-300 rounded divide-y divide-slate-200 max-h-72 overflow-y-auto">
      ${rows
        .map(
          (s) => `<li>
        <button
          hx-post="/orders/new/lines"
          hx-vals='{"pick_service_id": ${s.id}}'
          hx-include="#order-form"
          hx-target="#lines-body"
          hx-swap="outerHTML"
          class="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex justify-between gap-3">
          <span>${escapeHtml(s.name)}</span>
          <span class="text-slate-500 whitespace-nowrap">
            ${formatMoney(s.price)} ${escapeHtml(priceTypeLabel(s.price_type).toLowerCase())}
            · ${escapeHtml(serviceTypeLabel(s.type))}
          </span>
        </button>
      </li>`
        )
        .join('')}
    </ul>${extra}
  `
}

// Cada línea guarda únicamente servicio y cantidad. El precio no viaja en el
// formulario: se vuelve a leer del catálogo en el servidor.
export function renderLinesBody(lines) {
  if (lines.length === 0) {
    return `<tbody id="lines-body">
      <tr><td colspan="5" class="border border-slate-300 px-3 py-3 text-center text-slate-500">Aún no has agregado servicios.</td></tr>
    </tbody>`
  }

  return `<tbody id="lines-body">
    ${lines
      .map(
        (line, index) => `
      <tr>
        <td class="border border-slate-300 px-3 py-2">
          ${escapeHtml(line.name)}
          <input type="hidden" name="line_service_id[]" value="${line.id_services}">
        </td>
        <td class="border border-slate-300 px-3 py-2">
          ${line.quantity} ${escapeHtml(quantityUnit(line.price_type))}
          <input type="hidden" name="line_quantity[]" value="${line.quantity}">
        </td>
        <td class="border border-slate-300 px-3 py-2">${formatMoney(line.unit_price)}</td>
        <td class="border border-slate-300 px-3 py-2">${formatMoney(line.sub_total)}</td>
        <td class="border border-slate-300 px-3 py-2">
          <button
            hx-post="/orders/new/lines/remove"
            hx-vals='{"remove_index": ${index}}'
            hx-include="#order-form"
            hx-target="#lines-body"
            hx-swap="outerHTML"
            class="text-red-600">Quitar</button>
        </td>
      </tr>`
      )
      .join('')}
  </tbody>`
}

export function orderSummary({ subtotal, discount, total, warning = null }) {
  return `<div id="order-summary" class="text-sm space-y-1">
    <div class="flex justify-between max-w-xs">
      <span class="text-slate-600">Subtotal</span>
      <span>${formatMoney(subtotal)}</span>
    </div>
    <div class="flex justify-between max-w-xs">
      <span class="text-slate-600">Descuento</span>
      <span>${discount > 0 ? '-' : ''}${formatMoney(discount)}</span>
    </div>
    <div class="flex justify-between max-w-xs font-semibold text-base border-t border-slate-300 pt-1">
      <span>Total</span>
      <span>${formatMoney(total)}</span>
    </div>
    ${warning ? `<p class="text-red-600">${escapeHtml(warning)}</p>` : ''}
  </div>`
}

// Lleva el hidden id_client. Si no hay cliente elegido, va vacío y el servidor
// rechaza el pedido.
export function clientBox(client, { error = null } = {}) {
  if (!client) {
    return `<div id="client-box" class="mt-2 text-sm">
      ${error ? `<p class="text-red-600">${escapeHtml(error)}</p>` : '<p class="text-slate-500">Ningún cliente seleccionado.</p>'}
    </div>`
  }

  return `<div id="client-box" class="mt-2 text-sm flex items-center gap-3">
    <input type="hidden" name="id_client" value="${client.id}">
    <span class="px-2 py-1 rounded bg-slate-100 border border-slate-300">
      ${escapeHtml(client.name)}${client.phone ? ` · ${escapeHtml(client.phone)}` : ''}
    </span>
    <button
      hx-get="/orders/new/clients/clear"
      hx-target="#client-box"
      hx-swap="outerHTML"
      class="text-slate-600 underline">Cambiar</button>
  </div>`
}

export function clientResults(clients, term) {
  if (!term) return ''

  if (clients.length === 0) {
    return `<p class="text-sm text-slate-500">Sin coincidencias para "${escapeHtml(term)}".</p>`
  }

  return `<ul class="border border-slate-300 rounded divide-y divide-slate-200">
    ${clients
      .map(
        (c) => `<li>
      <button
        hx-get="/orders/new/clients/${c.id}"
        hx-target="#client-box"
        hx-swap="outerHTML"
        class="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">
        ${escapeHtml(c.name)}${c.phone ? ` · ${escapeHtml(c.phone)}` : ''}
      </button>
    </li>`
      )
      .join('')}
  </ul>`
}
