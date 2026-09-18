import * as staff from '../services/staff.js'
import { render } from '../render.js'
import { staffList, renderTbody, renderRow } from '../views/staff/list.js'
import { staffNewForm, staffEditRow } from '../views/staff/form.js'

function readForm(form) {
  const values = { name: (form.name || '').toString().trim() }
  if (!values.name) return { values, error: 'El nombre es obligatorio' }
  return { values, error: null }
}

export function index(c) {
  return render(c, { title: 'Personal — Laundry', body: staffList(staff.list()) })
}

export const newForm = (c) => c.html(staffNewForm())

export async function create(c) {
  const { values, error } = readForm(await c.req.parseBody())
  if (error) {
    return c.html(`${renderTbody(staff.list())}<div id="form-area" class="mb-4" hx-swap-oob="true">${staffNewForm({ values, error })}</div>`)
  }
  staff.create(values)
  return c.html(`${renderTbody(staff.list())}<div id="form-area" class="mb-4" hx-swap-oob="true"></div>`)
}

export function editForm(c) {
  const person = staff.findById(Number(c.req.param('id')))
  if (!person) return c.text('Persona no encontrada', 404)
  return c.html(staffEditRow(person))
}

export function showRow(c) {
  const person = staff.findById(Number(c.req.param('id')))
  if (!person) return c.text('Persona no encontrada', 404)
  return c.html(renderRow(person))
}

export async function update(c) {
  const id = Number(c.req.param('id'))
  const person = staff.findById(id)
  if (!person) return c.text('Persona no encontrada', 404)
  const { values, error } = readForm(await c.req.parseBody())
  if (error) return c.html(staffEditRow(person, { values, error }))
  staff.update(id, values)
  return c.html(renderRow(staff.findById(id)))
}

export function toggleActive(c) {
  const id = Number(c.req.param('id'))
  if (!staff.findById(id)) return c.text('Persona no encontrada', 404)
  staff.toggleActive(id)
  return c.html(renderRow(staff.findById(id)))
}
