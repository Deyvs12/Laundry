import { escapeHtml } from '../_helpers.js'

const errorBox = (error) => (error ? `<p class="text-sm text-red-600 mb-3">${escapeHtml(error)}</p>` : '')

export function staffNewForm({ values = {}, error = null } = {}) {
  return `
    <div class="border border-slate-300 rounded p-4 bg-slate-50">
      <h2 class="font-semibold mb-3">Nueva persona</h2>
      ${errorBox(error)}
      <form hx-post="/staff" hx-target="#staff-tbody" hx-swap="outerHTML" class="flex gap-2 items-end">
        <input name="name" type="text" required placeholder="Nombre" value="${escapeHtml(values.name || '')}"
          class="border border-slate-300 rounded px-3 py-2 flex-1">
        <button type="submit" class="bg-slate-800 text-white px-3 py-2 rounded">Crear</button>
        <button type="button" hx-on:click="document.getElementById('form-area').innerHTML=''"
          class="bg-slate-200 px-3 py-2 rounded">Cancelar</button>
      </form>
    </div>
  `
}

export function staffEditRow(person, { values = null, error = null } = {}) {
  return `
    <tr id="staff-${person.id}">
      <td colspan="3" class="border border-slate-300 p-3 bg-slate-50">
        ${errorBox(error)}
        <form hx-put="/staff/${person.id}" hx-target="#staff-${person.id}" hx-swap="outerHTML" class="flex gap-2 items-end">
          <input name="name" type="text" required value="${escapeHtml((values || person).name || '')}"
            class="border border-slate-300 rounded px-3 py-2 flex-1">
          <button type="submit" class="bg-slate-800 text-white px-3 py-2 rounded">Guardar</button>
          <button type="button" hx-get="/staff/${person.id}/row" hx-target="#staff-${person.id}" hx-swap="outerHTML"
            class="bg-slate-200 px-3 py-2 rounded">Cancelar</button>
        </form>
      </td>
    </tr>
  `
}
