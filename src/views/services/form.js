import { escapeHtml, renderOptions } from '../_helpers.js'
import { SERVICE_TYPES, PRICE_TYPES } from '../../constants.js'

function errorBox(error) {
  return error
    ? `<p class="text-sm text-red-600 mb-3">${escapeHtml(error)}</p>`
    : ''
}

function fields(values) {
  return `
    <input name="name" type="text" required placeholder="Nombre"
      value="${escapeHtml(values.name || '')}"
      class="border border-slate-300 rounded px-3 py-2">
    <select name="type" required
      class="border border-slate-300 rounded px-3 py-2">
      ${renderOptions(SERVICE_TYPES, values.type, 'Tipo…')}
    </select>
    <input name="price" type="text" inputmode="decimal" required placeholder="Precio"
      value="${escapeHtml(values.price ?? '')}"
      class="border border-slate-300 rounded px-3 py-2">
    <select name="price_type" required
      class="border border-slate-300 rounded px-3 py-2">
      ${renderOptions(PRICE_TYPES, values.price_type, 'Cobro…')}
    </select>
  `
}

// values se repuebla cuando la validación falla, para no perder lo capturado.
export function serviceNewForm({ values = {}, error = null } = {}) {
  return `
    <div class="border border-slate-300 rounded p-4 bg-slate-50">
      <h2 class="font-semibold mb-3">Nuevo servicio</h2>
      ${errorBox(error)}
      <form
        hx-post="/services"
        hx-target="#services-tbody"
        hx-swap="outerHTML"
        hx-include="#filter-type"
        class="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
        ${fields(values)}
        <div class="flex gap-2">
          <button type="submit" class="bg-slate-800 text-white px-3 py-1 rounded">Crear</button>
          <button type="button"
            hx-on:click="document.getElementById('form-area').innerHTML=''"
            class="bg-slate-200 px-3 py-1 rounded">Cancelar</button>
        </div>
      </form>
    </div>
  `
}

export function serviceEditRow(service, { values = null, error = null } = {}) {
  return `
    <tr id="service-${service.id}">
      <td colspan="6" class="border border-slate-300 p-3 bg-slate-50">
        ${errorBox(error)}
        <form
          hx-put="/services/${service.id}"
          hx-target="#service-${service.id}"
          hx-swap="outerHTML"
          class="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
          ${fields(values || service)}
          <div class="flex gap-2">
            <button type="submit" class="bg-slate-800 text-white px-3 py-1 rounded">Guardar</button>
            <button type="button"
              hx-get="/services/${service.id}/row"
              hx-target="#service-${service.id}"
              hx-swap="outerHTML"
              class="bg-slate-200 px-3 py-1 rounded">Cancelar</button>
          </div>
        </form>
      </td>
    </tr>
  `
}
