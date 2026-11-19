import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { join } from 'node:path'
import db from './db/database.js'
import { seedAdmin } from './db/seed.js'
import { requireAuth } from './middleware/auth.js'
import { newPage } from './controllers/orders.js'
import authRoutes from './routes/auth.js'
import clientsRoutes from './routes/clients.js'
import servicesRoutes from './routes/services.js'
import ordersRoutes from './routes/orders.js'
import cashRoutes from './routes/cash_shifts.js'
import staffRoutes from './routes/staff.js'
import reportsRoutes from './routes/reports.js'
import logsRoutes from './routes/logs.js'
import accountRoutes from './routes/account.js'
import printerRoutes from './routes/printer.js'

await seedAdmin()

const app = new Hono()

app.use('/public/*', serveStatic({ root: join(import.meta.dir, '..') }))

app.get('/ping', (c) => c.text('ok'))

app.use('*', requireAuth)

app.route('/', authRoutes)
app.route('/', clientsRoutes)
app.route('/', servicesRoutes)
app.route('/', ordersRoutes)
app.route('/', cashRoutes)
app.route('/', staffRoutes)
app.route('/', reportsRoutes)
app.route('/', logsRoutes)
app.route('/', accountRoutes)
app.route('/', printerRoutes)

// La portada es la captura de pedidos: es lo que se hace cien veces al día, y
// una pantalla de bienvenida solo añadiría un clic a cada pedido.
app.get('/', newPage)

export default {
  port: 3000,
  fetch: app.fetch
}
