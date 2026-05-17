import { escapeHtml } from '../_helpers.js'

export function clientsList(clients) {
  return `
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-semibold">Clientes</h1>
      <button
        hx-get="/clients/new"
        hx-target="#form-area"
        hx-swap="innerHTML"
        class="bg-slate-800 text-white px-3 py-1 rounded">
        Nuevo cliente
      </button>
    </div>

    <div id="form-area" class="mb-4"></div>

    <table class="w-full border border-slate-300 text-sm">
      <thead class="bg-slate-100 text-left">
        <tr>
          <th class="border border-slate-300 px-3 py-2">Nombre</th>
          <th class="border border-slate-300 px-3 py-2">Teléfono</th>
          <th class="border border-slate-300 px-3 py-2">Notas</th>
          <th class="border border-slate-300 px-3 py-2 w-40">Acciones</th>
        </tr>
      </thead>
      ${renderTbody(clients)}
    </table>
  `
}

export function renderTbody(clients) {
  if (clients.length === 0) {
    return `<tbody id="clients-tbody">
      <tr><td colspan="4" class="border border-slate-300 px-3 py-3 text-center text-slate-500">Aún no hay clientes registrados.</td></tr>
    </tbody>`
  }
  return `<tbody id="clients-tbody">
    ${clients.map(renderRow).join('')}
  </tbody>`
}

export function renderRow(client) {
  const safeName = escapeHtml(client.name)
  return `
    <tr id="client-${client.id}">
      <td class="border border-slate-300 px-3 py-2">${safeName}</td>
      <td class="border border-slate-300 px-3 py-2">${escapeHtml(client.phone || '—')}</td>
      <td class="border border-slate-300 px-3 py-2">${escapeHtml(client.notes || '—')}</td>
      <td class="border border-slate-300 px-3 py-2">
        <button
          hx-get="/clients/${client.id}/edit"
          hx-target="#client-${client.id}"
          hx-swap="outerHTML"
          class="text-blue-600 mr-3">Editar</button>
        <button
          hx-delete="/clients/${client.id}"
          hx-target="#clients-tbody"
          hx-swap="outerHTML"
          hx-confirm="¿Eliminar a ${safeName}?"
          class="text-red-600">Eliminar</button>
      </td>
    </tr>
  `
}
