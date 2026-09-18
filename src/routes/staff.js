import { Hono } from 'hono'
import { index, newForm, create, editForm, showRow, update, toggleActive } from '../controllers/staff.js'

const staffRoutes = new Hono()

staffRoutes.get('/staff', index)
staffRoutes.get('/staff/new', newForm)
staffRoutes.post('/staff', create)
staffRoutes.get('/staff/:id/edit', editForm)
staffRoutes.get('/staff/:id/row', showRow)
staffRoutes.put('/staff/:id', update)
staffRoutes.post('/staff/:id/toggle', toggleActive)

export default staffRoutes
