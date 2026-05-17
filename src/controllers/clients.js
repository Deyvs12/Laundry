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

export function newForm(c) {
  return c.html(clientNewForm())
}

export async function create(c) {
  const form = await c.req.parseBody()
  const name = (form.name || '').toString().trim()

  if (!name) return c.text('El nombre es obligatorio', 400)

  clients.create({
    name,
    phone: (form.phone || '').toString().trim(),
    notes: (form.notes || '').toString().trim()
  })

  const tbody = renderTbody(clients.list())
  // OOB para limpiar el form-area junto con la respuesta del tbody
  return c.html(`${tbody}<div id="form-area" hx-swap-oob="true"></div>`)
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

  const form = await c.req.parseBody()
  const name = (form.name || '').toString().trim()
  if (!name) return c.text('El nombre es obligatorio', 400)

  clients.update(id, {
    name,
    phone: (form.phone || '').toString().trim(),
    notes: (form.notes || '').toString().trim()
  })

  const updated = clients.findById(id)
  return c.html(renderRow(updated))
}

export function destroy(c) {
  const id = Number(c.req.param('id'))
  clients.softDelete(id)
  return c.html(renderTbody(clients.list()))
}
