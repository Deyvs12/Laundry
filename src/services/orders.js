import db from '../db/database.js'
import * as logs from './logs.js'
import * as servicesRepo from './services.js'
import { round2 } from '../money.js'
import * as cashShifts from './cash_shifts.js'
import { orderStatusLabel, paymentMethodLabel, isPaymentMethod } from '../constants.js'

export { round2 }

// Convierte [{ serviceId, quantity }] en líneas con precio.
//
// El precio SIEMPRE se lee del catálogo, nunca de lo que mandó el navegador:
// los campos ocultos del formulario son editables por el cliente. Esto también
// define la semántica de Order_services.unit_price — es una foto del precio
// vigente al crear el pedido, y por eso subir precios mañana no altera lo que
// ya se cobró ayer.
export function buildLines(rawLines) {
  const lines = []

  for (const raw of rawLines) {
    const service = servicesRepo.findById(raw.serviceId)
    if (!service || service.is_active !== 1) continue

    const quantity = round2(raw.quantity)
    if (!(quantity > 0)) continue
    // Por prenda o por servicio la cantidad es entera: no existen 2.5 camisas.
    // Solo el cobro por kilo admite decimales.
    if (service.price_type !== 'kilo' && !Number.isInteger(quantity)) continue

    lines.push({
      id_services: service.id,
      name: service.name,
      type: service.type,
      price_type: service.price_type,
      quantity,
      unit_price: service.price,
      sub_total: round2(quantity * service.price)
    })
  }

  return lines
}

export function totalsFor(lines, discount = 0) {
  const subtotal = round2(lines.reduce((sum, l) => sum + l.sub_total, 0))
  const safeDiscount = round2(discount)
  return { subtotal, discount: safeDiscount, total: round2(subtotal - safeDiscount) }
}

// Pedido + líneas + bitácora en una sola transacción: o queda todo, o no queda
// nada. Un pedido a medias (cabecera sin líneas) sería imposible de cuadrar.
const insertOrder = db.transaction(
  ({ idClient, idUser, lines, discount, notes, expectedDelivery }) => {
    const { subtotal, total } = totalsFor(lines, discount)

    const { lastInsertRowid: orderId } = db
      .query(
        `INSERT INTO Orders (id_client, id_user, discount, total, notes, expected_delivery_date)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(idClient, idUser, discount, total, notes || null, expectedDelivery || null)

    const insertLine = db.query(
      `INSERT INTO Order_services (id_orders, id_services, quantity, unit_price, sub_total)
       VALUES (?, ?, ?, ?, ?)`
    )
    for (const line of lines) {
      insertLine.run(orderId, line.id_services, line.quantity, line.unit_price, line.sub_total)
    }

    logs.insert({
      userId: idUser,
      orderId,
      action: 'ORDER_CREATED',
      message: `Pedido #${orderId} creado con ${lines.length} servicio(s) por un total de ${total.toFixed(2)}`
    })

    // El descuento se registra aparte: es justo lo que el dueño va a querer
    // auditar cuando no estuvo en el mostrador.
    if (discount > 0) {
      logs.insert({
        userId: idUser,
        orderId,
        action: 'ORDER_DISCOUNTED',
        message: `Descuento de ${discount.toFixed(2)} sobre un subtotal de ${subtotal.toFixed(2)} en el pedido #${orderId}`
      })
    }

    return orderId
  }
)

export function create(data) {
  return insertOrder(data)
}

const LIST_COLUMNS = `
  o.id, o.status, o.total, o.discount, o.paid, o.payment_method, o.payment_day,
  o.cash_shift_id, o.created_at, o.expected_delivery_date,
  c.name AS client_name, c.phone AS client_phone,
  u.name AS user_name`

export const ACTIVE_STATUSES = ['received', 'in_process', 'ready']

// status: 'active' (por defecto) | 'all' | uno concreto.
// client: texto libre contra nombre o teléfono.
export function list({ status = 'active', client = '', limit = 200 } = {}) {
  const where = []
  const params = []

  if (status === 'active') {
    where.push(`o.status IN (${ACTIVE_STATUSES.map(() => '?').join(',')})`)
    params.push(...ACTIVE_STATUSES)
  } else if (status !== 'all') {
    where.push('o.status = ?')
    params.push(status)
  }

  if (client) {
    const like = `%${client.replace(/[\\%_]/g, (m) => '\\' + m)}%`
    where.push(`(c.name LIKE ? ESCAPE '\\' OR c.phone LIKE ? ESCAPE '\\')`)
    params.push(like, like)
  }

  // Los activos se ordenan por fecha de entrega (lo más urgente arriba, sin
  // fecha al final). El histórico, por folio descendente.
  const order =
    status === 'active'
      ? `CASE WHEN o.expected_delivery_date IS NULL THEN 1 ELSE 0 END,
         o.expected_delivery_date, o.id DESC`
      : 'o.id DESC'

  return db
    .query(
      `SELECT ${LIST_COLUMNS}
       FROM Orders o
       JOIN Clients c ON c.id = o.id_client
       JOIN Users u ON u.id = o.id_user
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY ${order}
       LIMIT ?`
    )
    .all(...params, limit)
}

export function findById(id) {
  return db
    .query(
      `SELECT ${LIST_COLUMNS}, o.notes
       FROM Orders o
       JOIN Clients c ON c.id = o.id_client
       JOIN Users u ON u.id = o.id_user
       WHERE o.id = ?`
    )
    .get(id)
}

export function linesOf(orderId) {
  return db
    .query(
      `SELECT os.id, os.quantity, os.unit_price, os.sub_total, os.status,
              s.name, s.type, s.price_type
       FROM Order_services os
       JOIN Services s ON s.id = os.id_services
       WHERE os.id_orders = ?
       ORDER BY os.id`
    )
    .all(orderId)
}

/* ======================= ciclo de vida ======================= */
//
//   received ──(iniciar)──▶ in_process ──(todas las líneas listas)──▶ ready ──(entregar, pagado)──▶ delivered
//       │                       │                                       │
//       └──────────(cancelar, solo si no está pagado)───────────────────┘──▶ cancelled
//
//   Cobrar es independiente del estado: se puede en cualquier momento salvo
//   cancelado. Entregar exige pagado. delivered y cancelled son finales.

export class OrderError extends Error {}

export const isFinal = (status) => status === 'delivered' || status === 'cancelled'

function getRow(id) {
  return db.query('SELECT * FROM Orders WHERE id = ?').get(id)
}

function requireEditable(order) {
  if (!order) throw new OrderError('Pedido no encontrado')
  if (isFinal(order.status)) {
    throw new OrderError(
      `El pedido está ${orderStatusLabel(order.status).toLowerCase()} y ya no admite cambios`
    )
  }
}

function setStatus(order, next, userId, reason) {
  if (order.status === next) return
  db.query('UPDATE Orders SET status = ? WHERE id = ?').run(next, order.id)
  logs.insert({
    userId,
    orderId: order.id,
    action: 'ORDER_STATUS_CHANGED',
    message: `Pedido #${order.id}: ${orderStatusLabel(order.status)} → ${orderStatusLabel(next)} (${reason})`
  })
  order.status = next
}

// Regla 9 y su contrapartida. El estado del pedido se deriva de sus líneas
// mientras no sea final:
//   - todas listas            → ready
//   - estaba ready y una vuelve a proceso → in_process
//   - estaba received y ya hay alguna lista → in_process
function syncStatusFromLines(order, userId) {
  const { total, ready } = db
    .query(
      `SELECT COUNT(*) AS total, COALESCE(SUM(status = 'ready'), 0) AS ready
       FROM Order_services WHERE id_orders = ?`
    )
    .get(order.id)

  if (total > 0 && ready === total) {
    return setStatus(order, 'ready', userId, 'todos los servicios listos')
  }
  if (order.status === 'ready') {
    return setStatus(order, 'in_process', userId, 'un servicio volvió a proceso')
  }
  if (order.status === 'received' && ready > 0) {
    return setStatus(order, 'in_process', userId, 'primer servicio listo')
  }
}

export const toggleLine = db.transaction((orderId, lineId, userId) => {
  const order = getRow(orderId)
  requireEditable(order)

  const line = db
    .query('SELECT id, status FROM Order_services WHERE id = ? AND id_orders = ?')
    .get(lineId, orderId)
  if (!line) throw new OrderError('Ese servicio no pertenece a este pedido')

  const next = line.status === 'ready' ? 'in_process' : 'ready'
  db.query('UPDATE Order_services SET status = ? WHERE id = ?').run(next, lineId)
  syncStatusFromLines(order, userId)
})

export const markAllReady = db.transaction((orderId, userId) => {
  const order = getRow(orderId)
  requireEditable(order)
  db.query(`UPDATE Order_services SET status = 'ready' WHERE id_orders = ?`).run(orderId)
  syncStatusFromLines(order, userId)
})

export const start = db.transaction((orderId, userId) => {
  const order = getRow(orderId)
  requireEditable(order)
  if (order.status !== 'received') throw new OrderError('El pedido ya está en proceso')
  setStatus(order, 'in_process', userId, 'inicio manual')
})

export const pay = db.transaction((orderId, method, userId) => {
  const order = getRow(orderId)
  if (!order) throw new OrderError('Pedido no encontrado')
  if (order.status === 'cancelled') throw new OrderError('Un pedido cancelado no se puede cobrar')
  if (order.paid) throw new OrderError('Este pedido ya está pagado')
  if (!isPaymentMethod(method)) throw new OrderError('Selecciona la forma de pago')

  // Se liga al turno abierto para que el corte lo sume. Sin turno, se cobra
  // igual (no se puede dejar al cliente sin su ropa) pero queda avisado en la
  // bitácora.
  const shift = cashShifts.findOpen()

  db.query(
    `UPDATE Orders
     SET paid = 1, payment_method = ?, payment_day = CURRENT_TIMESTAMP, cash_shift_id = ?
     WHERE id = ?`
  ).run(method, shift?.id ?? null, orderId)

  logs.insert({
    userId,
    orderId,
    cashShiftId: shift?.id ?? null,
    action: 'ORDER_PAID',
    message: `Pedido #${orderId} cobrado: ${order.total.toFixed(2)} en ${paymentMethodLabel(method).toLowerCase()}${
      shift ? ` (turno #${shift.id})` : ' — SIN turno de caja abierto'
    }`
  })
})

export const deliver = db.transaction((orderId, userId) => {
  const order = getRow(orderId)
  requireEditable(order)
  if (order.status !== 'ready') throw new OrderError('Solo se puede entregar un pedido que esté listo')
  if (!order.paid) throw new OrderError('Cobra el pedido antes de entregarlo')
  setStatus(order, 'delivered', userId, 'entregado al cliente')
})

export const cancel = db.transaction((orderId, userId) => {
  const order = getRow(orderId)
  requireEditable(order)
  // Cancelar algo ya cobrado implica devolver dinero, y eso toca la caja.
  // Se resuelve cuando exista el módulo de caja; mientras, se bloquea.
  if (order.paid) throw new OrderError('Un pedido ya pagado no se puede cancelar: requiere devolución')

  db.query(`UPDATE Orders SET status = 'cancelled' WHERE id = ?`).run(orderId)
  logs.insert({
    userId,
    orderId,
    action: 'ORDER_CANCELLED',
    message: `Pedido #${orderId} cancelado (estaba ${orderStatusLabel(order.status).toLowerCase()})`
  })
})
