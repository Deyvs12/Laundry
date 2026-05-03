import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import db from './db/database.js'

const app = new Hono()

app.use('/public/*', serveStatic({ root: './' }))

app.get('/ping', (c) => c.json({ status: 'ok' }))

export default {
  port: 3000,
  fetch: app.fetch
}