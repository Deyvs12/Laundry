import { Hono } from 'hono'
import { index } from '../controllers/logs.js'

const logsRoutes = new Hono()
logsRoutes.get('/logs', index)

export default logsRoutes
