import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import db from './db/database.js'
import { seedAdmin } from './db/seed.js'
import { requireAuth } from './middleware/auth.js'
import { layout } from './views/layout.js'
import authRoutes from './routes/auth.js'
import clientsRoutes from './routes/clients.js'
import servicesRoutes from './routes/services.js'

await seedAdmin()

const app = new Hono()

app.use('/public/*', serveStatic({ root: './' }))

app.get('/ping', (c) => c.text('ok'))

app.use('*', requireAuth)

app.route('/', authRoutes)
app.route('/', clientsRoutes)
app.route('/', servicesRoutes)

app.get('/', (c) => {
  const user = c.get('user')
  const body = `
    <h1 class="text-2xl font-semibold mb-4">Bienvenido, ${user.name}</h1>
    <p class="text-slate-600">Sistema operativo. Próximamente: clientes, servicios, pedidos.</p>
  `
  return c.html(layout({ title: 'Inicio — Laundry', body, user }))
})

export default {
  port: 3000,
  fetch: app.fetch
}
