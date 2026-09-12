import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { join } from 'node:path'
import db from './db/database.js'
import { seedAdmin } from './db/seed.js'
import { requireAuth } from './middleware/auth.js'
import { layout } from './views/layout.js'
import { escapeHtml } from './views/_helpers.js'
import authRoutes from './routes/auth.js'
import clientsRoutes from './routes/clients.js'
import servicesRoutes from './routes/services.js'
import ordersRoutes from './routes/orders.js'

await seedAdmin()

const app = new Hono()

app.use('/public/*', serveStatic({ root: join(import.meta.dir, '..') }))

app.get('/ping', (c) => c.text('ok'))

app.use('*', requireAuth)

app.route('/', authRoutes)
app.route('/', clientsRoutes)
app.route('/', servicesRoutes)
app.route('/', ordersRoutes)

app.get('/', (c) => {
  const user = c.get('user')
  const body = `
    <h1 class="text-2xl font-semibold mb-4">Bienvenido, ${escapeHtml(user.name)}</h1>
    <p class="text-slate-600 mb-4">Pedidos, clientes y catálogo de servicios disponibles.</p>
    <a href="/orders/new" class="inline-block bg-slate-800 text-white px-4 py-2 rounded">Nuevo pedido</a>
  `
  return c.html(layout({ title: 'Inicio — Laundry', body, user }))
})

export default {
  port: 3000,
  fetch: app.fetch
}
