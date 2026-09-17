import * as services from '../services/services.js'
import { isServiceType, isPriceType } from '../constants.js'
import { round2 } from '../money.js'
import { render } from '../render.js'
import { servicesList, renderTbody, renderRow } from '../views/services/list.js'
import { serviceNewForm, serviceEditRow } from '../views/services/form.js'

// Devuelve { values, error } — error null si todo está bien.
function readForm(form) {
  const values = {
    name: (form.name || '').toString().trim(),
    type: (form.type || '').toString(),
    price: (form.price || '').toString().trim(),
    price_type: (form.price_type || '').toString()
  }

  if (!values.name) return { values, error: 'El nombre es obligatorio' }
  if (!isServiceType(values.type)) return { values, error: 'Selecciona un tipo de servicio' }
  if (!isPriceType(values.price_type)) return { values, error: 'Selecciona una forma de cobro' }

  // Se acepta coma decimal porque es lo que se teclea de forma natural aquí.
  const price = Number(values.price.replace(',', '.'))
  if (!Number.isFinite(price) || price < 0) {
    return { values, error: 'El precio debe ser un número mayor o igual a 0' }
  }

  // A 2 decimales desde el alta: un precio de 25.555 haría que el subtotal de
  // 1 pieza (25.56) no coincidiera con el precio unitario mostrado.
  return { values, error: null, data: { ...values, price: round2(price) } }
}

function filterFrom(source) {
  const type = (source.filter_type || '').toString()
  return isServiceType(type) ? type : ''
}

export function index(c) {
  const filterType = filterFrom(c.req.query())
  const rows = services.list({ type: filterType || null })
  const body = servicesList(rows, { filterType })
  return render(c, { title: 'Servicios — Laundry', body })
}

// Fragmento del tbody: lo pide el <select> de filtro al cambiar.
export function listFragment(c) {
  const filterType = filterFrom(c.req.query())
  return c.html(renderTbody(services.list({ type: filterType || null })))
}

export function newForm(c) {
  return c.html(serviceNewForm())
}

export async function create(c) {
  const form = await c.req.parseBody()
  const { values, error, data } = readForm(form)

  // El filtro activo viaja con el POST vía hx-include, para que el tbody se
  // vuelva a pintar con el mismo filtro que el usuario tenía puesto.
  const filterType = filterFrom(form)
  const tbody = () => renderTbody(services.list({ type: filterType || null }))

  if (error) {
    // 200 a propósito: htmx no hace swap en respuestas de error, así que un 400
    // dejaría la pantalla congelada sin explicar nada.
    return c.html(
      `${tbody()}<div id="form-area" class="mb-4" hx-swap-oob="true">${serviceNewForm({ values, error })}</div>`
    )
  }

  services.create(data)

  return c.html(
    `${tbody()}<div id="form-area" class="mb-4" hx-swap-oob="true"></div>`
  )
}

export function editForm(c) {
  const service = services.findById(Number(c.req.param('id')))
  if (!service) return c.text('Servicio no encontrado', 404)
  return c.html(serviceEditRow(service))
}

export function showRow(c) {
  const service = services.findById(Number(c.req.param('id')))
  if (!service) return c.text('Servicio no encontrado', 404)
  return c.html(renderRow(service))
}

export async function update(c) {
  const id = Number(c.req.param('id'))
  const service = services.findById(id)
  if (!service) return c.text('Servicio no encontrado', 404)

  const { values, error, data } = readForm(await c.req.parseBody())
  if (error) return c.html(serviceEditRow(service, { values, error }))

  services.update(id, data)
  return c.html(renderRow(services.findById(id)))
}

export function toggleActive(c) {
  const id = Number(c.req.param('id'))
  if (!services.findById(id)) return c.text('Servicio no encontrado', 404)

  services.toggleActive(id)
  return c.html(renderRow(services.findById(id)))
}
