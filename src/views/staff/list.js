import { escapeHtml } from '../_helpers.js'

export function staffList(rows) {
  return `
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-semibold">Personal</h1>
      <button hx-get="/staff/new" hx-target="#form-area" hx-swap="innerHTML"
        class="bg-slate-800 text-white px-3 py-1 rounded">Nueva persona</button>
    </div>
    <p class="text-sm text-slate-600 mb-4">Las personas que atienden el mostrador. Se eligen al crear un pedido para saber quién lo registró. No inician sesión.</p>

    <div id="form-area" class="mb-4"></div>

    <table class="w-full border border-slate-300 text-sm">
      <thead class="bg-slate-100 text-left">
        <tr>
          <th class="border border-slate-300 px-3 py-2">Nombre</th>
          <th class="border border-slate-300 px-3 py-2 w-28">Estado</th>
          <th class="border border-slate-300 px-3 py-2 w-48">Acciones</th>
        </tr>
      </thead>
      ${renderTbody(rows)}
    </table>
  `
}

export function renderTbody(rows) {
  if (rows.length === 0) {
    return `<tbody id="staff-tbody">
      <tr><td colspan="3" class="border border-slate-300 px-3 py-3 text-center text-slate-500">Aún no hay personal registrado.</td></tr>
    </tbody>`
  }
  return `<tbody id="staff-tbody">${rows.map(renderRow).join('')}</tbody>`
}

export function renderRow(person) {
  const active = person.is_active === 1
  const safeName = escapeHtml(person.name)
  return `
    <tr id="staff-${person.id}"${active ? '' : ' class="text-slate-400"'}>
      <td class="border border-slate-300 px-3 py-2">${safeName}</td>
      <td class="border border-slate-300 px-3 py-2">${active ? 'Activo' : 'Inactivo'}</td>
      <td class="border border-slate-300 px-3 py-2">
        <button hx-get="/staff/${person.id}/edit" hx-target="#staff-${person.id}" hx-swap="outerHTML"
          class="text-blue-600 mr-3">Editar</button>
        <button hx-post="/staff/${person.id}/toggle" hx-target="#staff-${person.id}" hx-swap="outerHTML"
          hx-confirm="${active ? `¿Desactivar a ${safeName}?` : `¿Activar a ${safeName}?`}"
          class="${active ? 'text-red-600' : 'text-green-700'}">${active ? 'Desactivar' : 'Activar'}</button>
      </td>
    </tr>
  `
}
