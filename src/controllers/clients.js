import * as clients from '../services/clients.js'
import { layout } from '../views/layout.js'
import { clientsList } from '../views/clients/list.js'

export function index(c) {
  const user = c.get('user')
  const rows = clients.list()
  const body = clientsList(rows)
  return c.html(layout({ title: 'Clientes — Laundry', body, user }))
}
