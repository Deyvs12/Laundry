import * as logs from '../services/logs.js'
import { isLogAction } from '../constants.js'
import { render } from '../render.js'
import { logsPage } from '../views/logs/index.js'

const ISO = /^\d{4}-\d{2}-\d{2}$/

function readFilters(q) {
  const action = isLogAction(q.action) ? q.action : ''
  const from = ISO.test(q.from || '') ? q.from : ''
  const to = ISO.test(q.to || '') ? q.to : ''
  const orderNum = Number(q.order)
  const order = Number.isInteger(orderNum) && orderNum > 0 ? String(orderNum) : ''
  const beforeNum = Number(q.before)
  const before = Number.isInteger(beforeNum) && beforeNum > 0 ? beforeNum : null
  return { action, from, to, order, before }
}

export function index(c) {
  const filters = readFilters(c.req.query())
  const { rows, hasMore } = logs.list({
    action: filters.action || null,
    from: filters.from || null,
    to: filters.to || null,
    orderId: filters.order ? Number(filters.order) : null,
    before: filters.before
  })
  return render(c, { title: 'Bitácora — Laundry', body: logsPage({ filters, rows, hasMore }) })
}
