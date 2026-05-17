import { escapeHtml } from '../_helpers.js'

export function clientNewForm() {
  return `
    <div class="border border-slate-300 rounded p-4 bg-slate-50">
      <h2 class="font-semibold mb-3">Nuevo cliente</h2>
      <form
        hx-post="/clients"
        hx-target="#clients-tbody"
        hx-swap="outerHTML"
        class="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <input name="name" type="text" required placeholder="Nombre"
          class="border border-slate-300 rounded px-3 py-2">
        <input name="phone" type="text" placeholder="Teléfono"
          class="border border-slate-300 rounded px-3 py-2">
        <input name="notes" type="text" placeholder="Notas"
          class="border border-slate-300 rounded px-3 py-2">
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

export function clientEditRow(client) {
  return `
    <tr id="client-${client.id}">
      <td colspan="4" class="border border-slate-300 p-3 bg-slate-50">
        <form
          hx-put="/clients/${client.id}"
          hx-target="#client-${client.id}"
          hx-swap="outerHTML"
          class="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
          <input name="name" type="text" required value="${escapeHtml(client.name)}"
            class="border border-slate-300 rounded px-3 py-2">
          <input name="phone" type="text" value="${escapeHtml(client.phone || '')}"
            class="border border-slate-300 rounded px-3 py-2">
          <input name="notes" type="text" value="${escapeHtml(client.notes || '')}"
            class="border border-slate-300 rounded px-3 py-2">
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
