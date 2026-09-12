import * as clients from '../services/clients.js'
import { layout } from '../views/layout.js'
import { clientsList, renderTbody, renderRow } from '../views/clients/list.js'
import { clientNewForm, clientEditRow } from '../views/clients/form.js'

export function index(c) {
  const user = c.get('user')
  const rows = clients.list()
  const body = clientsList(rows)
  return c.html(layout({ title: 'Clientes — Laundry', body, user }))
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
  const { values, error } = readForm(await c.req.parseBody())
  const tbody = renderTbody(clients.list())

  // 200 a propósito: htmx no hace swap en respuestas de error, así que un 400
  // dejaría la pantalla congelada sin explicar nada.
  if (error) {
    return c.html(
      `${tbody}<div id="form-area" class="mb-4" hx-swap-oob="true">${clientNewForm({ values, error })}</div>`
    )
  }

  clients.create(values)

  // OOB para limpiar el form-area junto con la respuesta del tbody
  return c.html(
    `${renderTbody(clients.list())}<div id="form-area" class="mb-4" hx-swap-oob="true"></div>`
  )
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
  return c.html(renderTbody(clients.list()))
}
