import { Hono } from 'hono'
import { index } from '../controllers/clients.js'

const clientsRoutes = new Hono()

clientsRoutes.get('/clients', index)

export default clientsRoutes
