import * as orders from '../services/orders.js'
import * as clients from '../services/clients.js'
import * as servicesRepo from '../services/services.js'
import * as cashShifts from '../services/cash_shifts.js'
import * as staffRepo from '../services/staff.js'
import { render } from '../render.js'
import { escapeHtml, todayLocal } from '../views/_helpers.js'
import { ordersList, renderTbody as renderOrdersTbody } from '../views/orders/list.js'
import { orderDetail } from '../views/orders/detail.js'
import { isServiceType, quantityUnit, isOrderStatus } from '../constants.js'
import { round2 } from '../money.js'
import {
  orderNewPage,
  renderLinesBody,
  orderSummary,
  clientBox,
  clientResults,
  serviceResults
} from '../views/orders/new.js'

// Los campos repetidos llegan como arreglo, pero con una sola línea Hono puede
// devolver un escalar. Normalizar evita tratar "3" como ['3'].
const toArray = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v])

function readNumber(value) {
  // Se acepta coma decimal: es lo que se teclea de forma natural aquí.
  return Number((value ?? '').toString().trim().replace(',', '.'))
}

// Reconstruye las líneas a partir de los hidden del formulario.
function readLines(body) {
  const ids = toArray(body['line_service_id[]'] ?? body.line_service_id)
  const quantities = toArray(body['line_quantity[]'] ?? body.line_quantity)

  return ids
    .map((id, i) => ({ serviceId: Number(id), quantity: readNumber(quantities[i]) }))
    .filter((l) => Number.isInteger(l.serviceId) && Number.isFinite(l.quantity) && l.quantity > 0)
}

function readDiscount(body) {
  const discount = readNumber(body.discount)
  return Number.isFinite(discount) && discount > 0 ? round2(discount) : 0
}

// 'YYYY-MM-DD' y además una fecha que exista: new Date('2026-02-31') no falla,
// se convierte en silencio en el 3 de marzo.
function isValidDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

// Mensaje del buscador de servicios. Se manda siempre (vacío limpia el anterior).
function lineErrorOob(message) {
  return `<div id="line-error" class="text-sm text-red-600" hx-swap-oob="true">${message ? escapeHtml(message) : ''}</div>`
}

// El resumen viaja fuera de banda en cada cambio de líneas, para que los
// totales no se queden desfasados de la tabla.
function summaryOob(lines, discount) {
  const totals = orders.totalsFor(lines, discount)
  const warning =
    totals.total < 0 ? 'El descuento supera el subtotal del pedido.' : null

  return orderSummary({ ...totals, warning }).replace(
    '<div id="order-summary"',
    '<div id="order-summary" hx-swap-oob="true"'
  )
}

function readFilters(query) {
  const status = (query.status || 'active').toString()
  return {
    status: status === 'all' || isOrderStatus(status) ? status : 'active',
    client: (query.client || '').toString().trim()
  }
}

export function index(c) {
  const filters = readFilters(c.req.query())
  const body = ordersList(orders.list(filters), filters)
  return render(c, { title: 'Pedidos — Laundry', body })
}

// Fragmento del tbody: lo piden los filtros al cambiar.
export function listFragment(c) {
  return c.html(renderOrdersTbody(orders.list(readFilters(c.req.query()))))
}

export function newPage(c) {
  const body = orderNewPage(servicesRepo.searchActive(), staffRepo.listActive())
  return render(c, { title: 'Nuevo pedido — Laundry', body })
}

export function searchServices(c) {
  const type = (c.req.query('service_type') || '').toString()

  return c.html(
    serviceResults(
      servicesRepo.searchActive({
        term: (c.req.query('service_search') || '').trim(),
        type: isServiceType(type) ? type : null
      })
    )
  )
}

export function show(c) {
  const order = orders.findById(Number(c.req.param('id')))
  if (!order) return c.text('Pedido no encontrado', 404)

  const body = orderDetail(order, orders.linesOf(order.id), { shift: c.get('shift') })
  return render(c, { title: `Pedido #${order.id} — Laundry`, body })
}

/* ---------- ciclo de vida ---------- */

// Todas las acciones devuelven el detalle completo. Si la transición no es
// válida, el mismo detalle con el motivo arriba: nunca un error sin pintar.
function withOrder(c, run) {
  const id = Number(c.req.param('id'))
  if (!orders.findById(id)) return c.text('Pedido no encontrado', 404)

  let error = null
  try {
    run(id, c.get('user').userId)
  } catch (e) {
    if (!(e instanceof orders.OrderError)) throw e
    error = e.message
  }

  // El turno se vuelve a consultar: un cobro pudo cambiar lo que hay que mostrar.
  const order = orders.findById(id)
  return c.html(orderDetail(order, orders.linesOf(id), { error, shift: cashShifts.findOpen() }))
}

export const start = (c) => withOrder(c, (id, userId) => orders.start(id, userId))
export const readyAll = (c) => withOrder(c, (id, userId) => orders.markAllReady(id, userId))
export const deliver = (c) => withOrder(c, (id, userId) => orders.deliver(id, userId))
export const cancel = (c) => withOrder(c, (id, userId) => orders.cancel(id, userId))

export const toggleLine = (c) =>
  withOrder(c, (id, userId) => orders.toggleLine(id, Number(c.req.param('lineId')), userId))

export async function pay(c) {
  const body = await c.req.parseBody()
  const method = (body.payment_method || '').toString()
  return withOrder(c, (id, userId) => orders.pay(id, method, userId))
}

/* ---------- cliente ---------- */

export function searchClients(c) {
  const term = (c.req.query('client_search') || '').trim()
  if (!term) return c.html('')
  return c.html(clientResults(clients.search(term), term))
}

export function selectClient(c) {
  const client = clients.findById(Number(c.req.param('id')))
  if (!client) return c.html(clientBox(null, { error: 'Ese cliente ya no está disponible' }))
  return c.html(clientBox(client))
}

export function clearClient(c) {
  return c.html(clientBox(null))
}

export async function createClient(c) {
  const body = await c.req.parseBody()
  const name = (body.new_client_name || '').toString().trim()
  const phone = (body.new_client_phone || '').toString().trim()

  if (!name) return c.html(clientBox(null, { error: 'El nombre del cliente es obligatorio' }))

  const id = clients.create({ name, phone, notes: '' })
  return c.html(clientBox(clients.findById(Number(id))))
}

/* ---------- líneas ---------- */

export async function addLine(c) {
  const body = await c.req.parseBody({ all: true })

  const current = readLines(body)
  const serviceId = Number(body.pick_service_id)
  const quantity = readNumber(body.pick_quantity)

  // Si la línea no entra, se dice por qué. Antes se ignoraba en silencio y la
  // tabla simplemente no cambiaba.
  let error = null
  const service = Number.isInteger(serviceId) ? servicesRepo.findById(serviceId) : null

  if (!service || service.is_active !== 1) {
    error = 'Ese servicio ya no está disponible.'
  } else if (!(quantity > 0)) {
    error = 'Indica una cantidad mayor a 0.'
  } else if (service.price_type !== 'kilo' && !Number.isInteger(quantity)) {
    error = `${service.name} se cobra por ${quantityUnit(service.price_type) || 'servicio'}: la cantidad debe ser un número entero.`
  } else {
    current.push({ serviceId, quantity })
  }

  const lines = orders.buildLines(current)
  return c.html(
    renderLinesBody(lines) + summaryOob(lines, readDiscount(body)) + lineErrorOob(error)
  )
}

export async function removeLine(c) {
  const body = await c.req.parseBody({ all: true })
  const index = Number(body.remove_index)

  // El índice que manda el botón es el de la tabla pintada, que sale de
  // buildLines. Se filtra DESPUÉS de construir, para que coincidan aunque
  // buildLines haya descartado alguna línea por el camino.
  const lines = orders.buildLines(readLines(body)).filter((_, i) => i !== index)

  return c.html(
    renderLinesBody(lines) + summaryOob(lines, readDiscount(body)) + lineErrorOob(null)
  )
}

export async function refreshSummary(c) {
  const body = await c.req.parseBody({ all: true })
  const lines = orders.buildLines(readLines(body))
  const totals = orders.totalsFor(lines, readDiscount(body))
  const warning = totals.total < 0 ? 'El descuento supera el subtotal del pedido.' : null

  return c.html(orderSummary({ ...totals, warning }))
}

/* ---------- alta ---------- */

export async function create(c) {
  const body = await c.req.parseBody({ all: true })
  const user = c.get('user')

  const idClient = Number(body.id_client)
  const client = Number.isInteger(idClient) ? clients.findById(idClient) : null
  if (!client) return c.html('Selecciona un cliente antes de crear el pedido')

  const rawLines = readLines(body)
  if (rawLines.length === 0) return c.html('Agrega al menos un servicio al pedido')

  const lines = orders.buildLines(rawLines)
  // buildLines descarta lo que ya no existe o fue desactivado mientras se
  // capturaba. Si la cuenta no cuadra, avisamos en vez de cobrar de menos.
  if (lines.length !== rawLines.length) {
    return c.html('Alguno de los servicios dejó de estar disponible. Revisa las líneas del pedido.')
  }

  const discount = readDiscount(body)
  const { subtotal } = orders.totalsFor(lines, discount)
  if (discount > subtotal) {
    return c.html('El descuento no puede ser mayor que el subtotal')
  }

  const expectedDelivery = (body.expected_delivery_date || '').toString().trim()
  if (expectedDelivery && !isValidDate(expectedDelivery)) {
    return c.html('La fecha de entrega no es válida')
  }
  // Comparación de strings 'YYYY-MM-DD': funciona porque el formato es fijo.
  if (expectedDelivery && expectedDelivery < todayLocal()) {
    return c.html('La fecha de entrega no puede ser anterior a hoy')
  }

  const idStaff = Number(body.id_staff)
  const staff = Number.isInteger(idStaff) ? staffRepo.findById(idStaff) : null
  if (!staff || staff.is_active !== 1) return c.html('Selecciona quién atendió el pedido')

  // user viene de la sesión, donde el id se llama userId (no id).
  const orderId = orders.create({
    idClient,
    idUser: user.userId,
    idStaff,
    staffName: staff.name,
    lines,
    discount,
    notes: (body.notes || '').toString().trim(),
    expectedDelivery
  })

  c.header('HX-Redirect', `/orders/${orderId}`)
  return c.body(null, 200)
}
