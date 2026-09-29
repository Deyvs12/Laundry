import { escapeHtml, renderPager } from '../_helpers.js'

export function clientsList(result, filters) {
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

    <div id="clients-filters" class="mb-4">
      <input
        id="clients-q"
        name="q"
        type="text"
        value="${escapeHtml(filters.q)}"
        placeholder="Buscar por nombre o teléfono…"
        autocomplete="off"
        hx-get="/clients/list"
        hx-trigger="input changed delay:300ms"
        hx-target="#clients-results"
        hx-swap="outerHTML"
        class="w-full md:w-80 border border-slate-300 rounded px-3 py-2 text-sm">
    </div>

    <div id="form-area" class="mb-4"></div>

    ${renderResults(result, filters)}
  `
}

// Tabla + paginador. Es lo que se reemplaza al buscar, paginar, crear o borrar.
export function renderResults(result, filters) {
  const href = (p) => `/clients/list?${new URLSearchParams({ q: filters.q, page: String(p) })}`
  return `<div id="clients-results">
    <table class="w-full border border-slate-300 text-sm">
      <thead class="bg-slate-100 text-left">
        <tr>
          <th class="border border-slate-300 px-3 py-2">Nombre</th>
          <th class="border border-slate-300 px-3 py-2">Teléfono</th>
          <th class="border border-slate-300 px-3 py-2">Notas</th>
          <th class="border border-slate-300 px-3 py-2 w-40">Acciones</th>
        </tr>
      </thead>
      ${renderTbody(result.rows)}
    </table>
    ${renderPager({ ...result, href, attrs: 'hx-target="#clients-results" hx-swap="outerHTML"' })}
  </div>`
}

export function renderTbody(clients) {
  if (clients.length === 0) {
    return `<tbody id="clients-tbody">
      <tr><td colspan="4" class="border border-slate-300 px-3 py-3 text-center text-slate-500">No hay clientes que coincidan.</td></tr>
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
          hx-include="#clients-filters"
          hx-target="#clients-results"
          hx-swap="outerHTML"
          hx-confirm="¿Eliminar a ${safeName}?"
          class="text-red-600">Eliminar</button>
      </td>
    </tr>
  `
}
