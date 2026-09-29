import * as clients from '../services/clients.js'
import { render } from '../render.js'
import { clientsList, renderResults, renderRow } from '../views/clients/list.js'
import { clientNewForm, clientEditRow } from '../views/clients/form.js'

function readFilters(source) {
  const page = Number(source.page)
  return {
    q: (source.q || '').toString().trim(),
    page: Number.isInteger(page) && page > 0 ? page : 1
  }
}

export function index(c) {
  const filters = readFilters(c.req.query())
  return render(c, { title: 'Clientes — Laundry', body: clientsList(clients.list(filters), filters) })
}

// Fragmento (tabla + paginador): búsqueda y paginación.
export function listFragment(c) {
  const filters = readFilters(c.req.query())
  return c.html(renderResults(clients.list(filters), filters))
}

// Devuelve { values, error } — error null si todo está bien.
function readForm(form) {
  const values = {
    name: (form.name || '').toString().trim(),
    phone: (form.phone || '').toString().trim(),
    notes: (form.notes || '').toString().trim()
  }

  if (!values.name) return { values, error: 'El nombre es obligatorio' }
  return { values, error: null }
}

export function newForm(c) {
  return c.html(clientNewForm())
}

export async function create(c) {
  const body = await c.req.parseBody()
  const { values, error } = readForm(body)
  // El filtro de búsqueda viaja con el POST (hx-include) para repintar la
  // misma vista que el usuario tenía.
  const filters = readFilters(body)
  const results = () => renderResults(clients.list(filters), filters)

  // 200 a propósito: htmx no hace swap en respuestas de error, así que un 400
  // dejaría la pantalla congelada sin explicar nada.
  if (error) {
    return c.html(
      `${results()}<div id="form-area" class="mb-4" hx-swap-oob="true">${clientNewForm({ values, error })}</div>`
    )
  }

  clients.create(values)

  // OOB para limpiar el form-area junto con la respuesta de la tabla
  return c.html(`${results()}<div id="form-area" class="mb-4" hx-swap-oob="true"></div>`)
}

export function editForm(c) {
  const id = Number(c.req.param('id'))
  const client = clients.findById(id)
  if (!client) return c.text('Cliente no encontrado', 404)
  return c.html(clientEditRow(client))
}

export function showRow(c) {
  const id = Number(c.req.param('id'))
  const client = clients.findById(id)
  if (!client) return c.text('Cliente no encontrado', 404)
  return c.html(renderRow(client))
}

export async function update(c) {
  const id = Number(c.req.param('id'))
  const client = clients.findById(id)
  if (!client) return c.text('Cliente no encontrado', 404)

  const { values, error } = readForm(await c.req.parseBody())
  if (error) return c.html(clientEditRow(client, { values, error }))

  clients.update(id, values)
  return c.html(renderRow(clients.findById(id)))
}

export function destroy(c) {
  const id = Number(c.req.param('id'))
  clients.softDelete(id)
  // htmx manda los parámetros de un DELETE en la URL, no en el cuerpo.
  const filters = readFilters(c.req.query())
  return c.html(renderResults(clients.list(filters), filters))
}
