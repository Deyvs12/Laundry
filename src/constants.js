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

function labelOf(list, value) {
  return list.find((o) => o.value === value)?.label ?? value
}

export const isServiceType = (v) => SERVICE_TYPES.some((o) => o.value === v)
export const isPriceType = (v) => PRICE_TYPES.some((o) => o.value === v)

export const serviceTypeLabel = (v) => labelOf(SERVICE_TYPES, v)
export const priceTypeLabel = (v) => labelOf(PRICE_TYPES, v)
