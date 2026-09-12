// Fuente única de los valores permitidos por los CHECK del schema.
// Los controladores validan contra estas listas y las vistas sacan de aquí
// tanto las etiquetas como las opciones de los <select>.
// Si cambia un CHECK en schema.js, tiene que cambiar aquí.

export const SERVICE_TYPES = [
  { value: 'laundry', label: 'Lavandería' },
  { value: 'ironing', label: 'Planchado' },
  { value: 'dry_cleaning', label: 'Tintorería' }
]

export const PRICE_TYPES = [
  { value: 'kilo', label: 'Por kilo' },
  { value: 'unit', label: 'Por prenda' },
  { value: 'service', label: 'Por servicio' }
]

export const ORDER_STATUSES = [
  { value: 'received', label: 'Recibido' },
  { value: 'in_process', label: 'En proceso' },
  { value: 'ready', label: 'Listo' },
  { value: 'delivered', label: 'Entregado' },
  { value: 'cancelled', label: 'Cancelado' }
]

export const LINE_STATUSES = [
  { value: 'in_process', label: 'En proceso' },
  { value: 'ready', label: 'Listo' }
]

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'transfer', label: 'Transferencia' }
]

function labelOf(list, value) {
  return list.find((o) => o.value === value)?.label ?? value
}

export const isServiceType = (v) => SERVICE_TYPES.some((o) => o.value === v)
export const isPriceType = (v) => PRICE_TYPES.some((o) => o.value === v)

export const serviceTypeLabel = (v) => labelOf(SERVICE_TYPES, v)
export const priceTypeLabel = (v) => labelOf(PRICE_TYPES, v)
export const orderStatusLabel = (v) => labelOf(ORDER_STATUSES, v)
export const lineStatusLabel = (v) => labelOf(LINE_STATUSES, v)
export const paymentMethodLabel = (v) => labelOf(PAYMENT_METHODS, v)

// Unidad con la que se captura la cantidad, según cómo se cobre el servicio.
export const quantityUnit = (priceType) =>
  ({ kilo: 'kg', unit: 'pz', service: '' })[priceType] ?? ''

export const isOrderStatus = (v) => ORDER_STATUSES.some((o) => o.value === v)
export const isPaymentMethod = (v) => PAYMENT_METHODS.some((o) => o.value === v)
