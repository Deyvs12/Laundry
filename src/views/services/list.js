import { escapeHtml, formatMoney, renderOptions } from '../_helpers.js'
import { SERVICE_TYPES, serviceTypeLabel, priceTypeLabel } from '../../constants.js'

export function servicesList(services, { filterType = '' } = {}) {
  return `
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-semibold">Servicios</h1>
      <button
        hx-get="/services/new"
        hx-target="#form-area"
        hx-swap="innerHTML"
        class="bg-slate-800 text-white px-3 py-1 rounded">
        Nuevo servicio
      </button>
    </div>

    <div class="mb-4">
      <label class="text-sm text-slate-600 mr-2" for="filter-type">Tipo</label>
      <select
        id="filter-type"
        name="filter_type"
        hx-get="/services/list"
        hx-target="#services-tbody"
        hx-swap="outerHTML"
        class="border border-slate-300 rounded px-3 py-2 text-sm">
        ${renderOptions(SERVICE_TYPES, filterType, 'Todos')}
      </select>
    </div>

    <div id="form-area" class="mb-4"></div>

    <table class="w-full border border-slate-300 text-sm">
      <thead class="bg-slate-100 text-left">
        <tr>
          <th class="border border-slate-300 px-3 py-2">Nombre</th>
          <th class="border border-slate-300 px-3 py-2">Tipo</th>
          <th class="border border-slate-300 px-3 py-2">Precio</th>
          <th class="border border-slate-300 px-3 py-2">Cobro</th>
          <th class="border border-slate-300 px-3 py-2">Estado</th>
          <th class="border border-slate-300 px-3 py-2 w-48">Acciones</th>
        </tr>
      </thead>
      ${renderTbody(services)}
    </table>
  `
}

// Repone siempre id="services-tbody": los swaps que lo apuntan usan outerHTML,
// así que el fragmento tiene que traer su propio id o el siguiente swap se
// queda sin destino.
export function renderTbody(services) {
  if (services.length === 0) {
    return `<tbody id="services-tbody">
      <tr><td colspan="6" class="border border-slate-300 px-3 py-3 text-center text-slate-500">No hay servicios en el catálogo.</td></tr>
    </tbody>`
  }

  return `<tbody id="services-tbody">
    ${services.map(renderRow).join('')}
  </tbody>`
}

export function renderRow(service) {
  const active = service.is_active === 1
  const safeName = escapeHtml(service.name)
  const rowClass = active ? '' : ' class="text-slate-400"'

  return `
    <tr id="service-${service.id}"${rowClass}>
      <td class="border border-slate-300 px-3 py-2">${safeName}</td>
      <td class="border border-slate-300 px-3 py-2">${escapeHtml(serviceTypeLabel(service.type))}</td>
      <td class="border border-slate-300 px-3 py-2">${formatMoney(service.price)}</td>
      <td class="border border-slate-300 px-3 py-2">${escapeHtml(priceTypeLabel(service.price_type))}</td>
      <td class="border border-slate-300 px-3 py-2">${active ? 'Activo' : 'Inactivo'}</td>
      <td class="border border-slate-300 px-3 py-2">
        <button
          hx-get="/services/${service.id}/edit"
          hx-target="#service-${service.id}"
          hx-swap="outerHTML"
          class="text-blue-600 mr-3">Editar</button>
        <button
          hx-post="/services/${service.id}/toggle"
          hx-target="#service-${service.id}"
          hx-swap="outerHTML"
          hx-confirm="${active ? `¿Desactivar ${safeName}?` : `¿Activar ${safeName}?`}"
          class="${active ? 'text-red-600' : 'text-green-700'}">${active ? 'Desactivar' : 'Activar'}</button>
      </td>
    </tr>
  `
}
