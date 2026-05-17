import { Hono } from 'hono'
import {
  index,
  newForm,
  create,
  editForm,
  showRow,
  update,
  destroy
} from '../controllers/clients.js'

const clientsRoutes = new Hono()

clientsRoutes.get('/clients', index)
clientsRoutes.get('/clients/new', newForm)
clientsRoutes.post('/clients', create)
clientsRoutes.get('/clients/:id/edit', editForm)
clientsRoutes.get('/clients/:id/row', showRow)
clientsRoutes.put('/clients/:id', update)
clientsRoutes.delete('/clients/:id', destroy)

export default clientsRoutes
