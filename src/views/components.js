// Piezas de interfaz reutilizables.
//
// Regla: una vista nunca escribe clases de color sueltas. Si necesita un
// botón, un campo o un distintivo, lo pide aquí. Así un cambio de estilo se
// hace en un solo archivo y todas las pantallas quedan consistentes.
//
// Los estilos viven en public/css/main.css; aquí solo se arma el HTML.

import { escapeHtml, renderOptions } from './_helpers.js'
import { orderStatusLabel, lineStatusLabel, paymentMethodLabel } from '../constants.js'

/* ============================ iconos ============================ */
// Trazo de 1.75 para que se lean bien a 20px sin parecer pesados.

const PATHS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  user: '<path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/>',
  check: '<path d="m5 13 4 4L19 7"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3"/>',
  cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  tag: '<path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
  people: '<path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 7H6"/>'
}

export function icon(name, className = 'w-5 h-5') {
  const path = PATHS[name]
  if (!path) return ''
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`
}

/* ============================ botones ============================ */

export function btn({
  label,
  variant = 'primary',
  size = 'md',
  type = 'button',
  attrs = '',
  iconName = null,
  block = false,
  className = ''
} = {}) {
  const classes = [
    'btn',
    `btn-${variant}`,
    size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '',
    block ? 'btn-block' : '',
    className
  ]
    .filter(Boolean)
    .join(' ')

  return `<button type="${type}" class="${classes}" ${attrs}>${
    iconName ? icon(iconName, size === 'sm' ? 'w-4 h-4' : 'w-5 h-5') : ''
  }${label ? `<span>${label}</span>` : ''}</button>`
}

// Mismo aspecto que un botón pero navega.
export function linkBtn({ label, href, variant = 'secondary', size = 'md', iconName = null, className = '' } = {}) {
  const classes = ['btn', `btn-${variant}`, size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '', className]
    .filter(Boolean)
    .join(' ')
  return `<a href="${href}" class="${classes}">${iconName ? icon(iconName, 'w-5 h-5') : ''}<span>${label}</span></a>`
}

/* ============================ estructura ============================ */

export function pageHeader({ title, subtitle = null, actions = '' } = {}) {
  return `
    <header class="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div>
        <h1 class="text-2xl font-semibold text-slate-900 tracking-tight">${title}</h1>
        ${subtitle ? `<p class="text-sm text-slate-500 mt-1">${subtitle}</p>` : ''}
      </div>
      ${actions ? `<div class="flex flex-wrap items-center gap-2">${actions}</div>` : ''}
    </header>
  `
}

// pad=false cuando el contenido es una tabla o una lista a sangre.
export function card({ title = null, action = '', body = '', pad = true, className = '', id = null } = {}) {
  return `
    <section class="card ${className}"${id ? ` id="${id}"` : ''}>
      ${title ? `<div class="card-header"><h2 class="card-title">${title}</h2>${action}</div>` : ''}
      <div class="${pad ? 'card-pad' : ''}">${body}</div>
    </section>
  `
}

/* ============================ formularios ============================ */

export function field({
  label,
  name,
  type = 'text',
  value = '',
  placeholder = '',
  attrs = '',
  hint = null,
  required = false,
  id = null,
  inputmode = null,
  className = ''
} = {}) {
  const fieldId = id || name
  return `
    <div class="${className}">
      ${label ? `<label class="label" for="${fieldId}">${label}</label>` : ''}
      <input
        id="${fieldId}"
        name="${name}"
        type="${type}"
        value="${escapeHtml(value ?? '')}"
        ${placeholder ? `placeholder="${escapeHtml(placeholder)}"` : ''}
        ${inputmode ? `inputmode="${inputmode}"` : ''}
        ${required ? 'required' : ''}
        class="input"
        ${attrs}>
      ${hint ? `<p class="hint">${hint}</p>` : ''}
    </div>
  `
}

export function selectField({
  label,
  name,
  options,
  selected = '',
  placeholder = null,
  attrs = '',
  hint = null,
  required = false,
  id = null,
  className = ''
} = {}) {
  const fieldId = id || name
  return `
    <div class="${className}">
      ${label ? `<label class="label" for="${fieldId}">${label}</label>` : ''}
      <select id="${fieldId}" name="${name}" ${required ? 'required' : ''} class="input" ${attrs}>
        ${renderOptions(options, selected, placeholder)}
      </select>
      ${hint ? `<p class="hint">${hint}</p>` : ''}
    </div>
  `
}

/* ============================ estados ============================ */

export function badge(label, tone = 'neutral') {
  return `<span class="badge badge-${tone}">${escapeHtml(label)}</span>`
}

// El color comunica la urgencia: ámbar es trabajo pendiente, verde es que el
// cliente ya puede venir, gris es que el asunto se cerró.
const ORDER_TONES = {
  received: 'neutral',
  in_process: 'work',
  ready: 'ready',
  delivered: 'done',
  cancelled: 'danger'
}

export const orderStatusBadge = (status) => badge(orderStatusLabel(status), ORDER_TONES[status] || 'neutral')

export const lineStatusBadge = (status) =>
  badge(lineStatusLabel(status), status === 'ready' ? 'ready' : 'work')

export function paymentBadge(order) {
  if (order.refund_id) return badge('Devuelto', 'danger')
  if (!order.paid) return badge('Pendiente', 'work')
  return badge(order.payment_method ? `Pagado · ${paymentMethodLabel(order.payment_method)}` : 'Pagado', 'ready')
}

/* ============================ avisos ============================ */

export function alert({ tone = 'info', message, title = null } = {}) {
  if (!message && !title) return ''
  return `
    <div class="alert alert-${tone}">
      ${title ? `<p class="font-semibold mb-0.5">${title}</p>` : ''}
      <p>${message}</p>
    </div>
  `
}

export function emptyState({ title, message = null, action = '', iconName = null } = {}) {
  return `
    <div class="text-center py-10 px-4">
      ${iconName ? `<div class="flex justify-center text-slate-300 mb-3">${icon(iconName, 'w-10 h-10')}</div>` : ''}
      <p class="font-medium text-slate-700">${title}</p>
      ${message ? `<p class="text-sm text-slate-500 mt-1">${message}</p>` : ''}
      ${action ? `<div class="mt-4 flex justify-center">${action}</div>` : ''}
    </div>
  `
}

/* ============================ datos ============================ */

// Par etiqueta/valor, para los bloques de detalle.
export function dataRow(label, value) {
  return `
    <div class="flex items-baseline justify-between gap-4 py-1.5">
      <dt class="text-sm text-slate-500 shrink-0">${label}</dt>
      <dd class="text-sm text-slate-900 text-right">${value}</dd>
    </div>
  `
}

// Las tablas no caben en tablet vertical: se envuelven para poder deslizarlas.
export function tableWrap(inner) {
  return `<div class="overflow-x-auto">${inner}</div>`
}
