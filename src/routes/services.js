import { Hono } from 'hono'
import {
  index,
  listFragment,
  newForm,
  create,
  editForm,
  showRow,
  update,
  toggleActive
} from '../controllers/services.js'

const servicesRoutes = new Hono()

servicesRoutes.get('/services', index)
servicesRoutes.get('/services/list', listFragment)
servicesRoutes.get('/services/new', newForm)
servicesRoutes.post('/services', create)
servicesRoutes.get('/services/:id/edit', editForm)
servicesRoutes.get('/services/:id/row', showRow)
servicesRoutes.put('/services/:id', update)
servicesRoutes.post('/services/:id/toggle', toggleActive)

export default servicesRoutes
