import { Hono } from 'hono'
import { index, open, close, show } from '../controllers/cash.js'

const cashRoutes = new Hono()

cashRoutes.get('/cash', index)
cashRoutes.post('/cash/open', open)
cashRoutes.post('/cash/:id/close', close)
cashRoutes.get('/cash/:id', show)

export default cashRoutes
