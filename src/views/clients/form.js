import { escapeHtml } from '../_helpers.js'

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
    <input name="phone" type="text" placeholder="Teléfono"
      value="${escapeHtml(values.phone || '')}"
      class="border border-slate-300 rounded px-3 py-2">
    <input name="notes" type="text" placeholder="Notas"
      value="${escapeHtml(values.notes || '')}"
      class="border border-slate-300 rounded px-3 py-2">
  `
}

// values se repuebla cuando la validación falla, para no perder lo capturado.
export function clientNewForm({ values = {}, error = null } = {}) {
  return `
    <div class="border border-slate-300 rounded p-4 bg-slate-50">
      <h2 class="font-semibold mb-3">Nuevo cliente</h2>
      ${errorBox(error)}
      <form
        hx-post="/clients"
        hx-target="#clients-tbody"
        hx-swap="outerHTML"
        class="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
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

export function clientEditRow(client, { values = null, error = null } = {}) {
  return `
    <tr id="client-${client.id}">
      <td colspan="4" class="border border-slate-300 p-3 bg-slate-50">
        ${errorBox(error)}
        <form
          hx-put="/clients/${client.id}"
          hx-target="#client-${client.id}"
          hx-swap="outerHTML"
          class="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
          ${fields(values || client)}
          <div class="flex gap-2">
            <button type="submit" class="bg-slate-800 text-white px-3 py-1 rounded">Guardar</button>
            <button type="button"
              hx-get="/clients/${client.id}/row"
              hx-target="#client-${client.id}"
              hx-swap="outerHTML"
              class="bg-slate-200 px-3 py-1 rounded">Cancelar</button>
          </div>
        </form>
      </td>
    </tr>
  `
}
