import { Hono } from 'hono'
import {
  index,
  listFragment,
  newPage,
  show,
  start,
  readyAll,
  toggleLine,
  pay,
  deliver,
  cancel,
  searchClients,
  selectClient,
  clearClient,
  createClient,
  searchServices,
  addLine,
  removeLine,
  refreshSummary,
  create,
  editPage,
  update
} from '../controllers/orders.js'

const ordersRoutes = new Hono()

ordersRoutes.get('/orders', index)
ordersRoutes.get('/orders/list', listFragment)

// Las rutas literales van antes que /orders/:id para que "new" no se lea
// nunca como un folio.
ordersRoutes.get('/orders/new', newPage)
ordersRoutes.get('/orders/new/clients', searchClients)
ordersRoutes.post('/orders/new/clients', createClient)
ordersRoutes.get('/orders/new/clients/clear', clearClient)
ordersRoutes.get('/orders/new/clients/:id', selectClient)
ordersRoutes.get('/orders/new/services', searchServices)
ordersRoutes.post('/orders/new/lines', addLine)
ordersRoutes.post('/orders/new/lines/remove', removeLine)
ordersRoutes.post('/orders/new/summary', refreshSummary)

ordersRoutes.post('/orders', create)
ordersRoutes.get('/orders/:id', show)
ordersRoutes.get('/orders/:id/edit', editPage)
ordersRoutes.put('/orders/:id', update)
ordersRoutes.post('/orders/:id/start', start)
ordersRoutes.post('/orders/:id/ready-all', readyAll)
ordersRoutes.post('/orders/:id/lines/:lineId/toggle', toggleLine)
ordersRoutes.post('/orders/:id/pay', pay)
ordersRoutes.post('/orders/:id/deliver', deliver)
ordersRoutes.post('/orders/:id/cancel', cancel)

export default ordersRoutes
