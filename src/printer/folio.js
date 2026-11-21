// El folio del pedido en código de barras: se imprime en el comprobante y en la
// etiqueta de la bolsa, y al escanearlo se abre el pedido.
//
// El contenido es "P" + folio (P123). La letra distingue un folio de cualquier
// otro número que se teclee o se escanee, como un teléfono.

export const FOLIO_PREFIX = 'P'

// Formato probado en papel y con lector el 2026-11-19. CODE128 porque trae
// dígito verificador obligatorio: una lectura mala se rechaza en vez de abrir
// otro pedido. Grosor 3 (barras de 0.37 mm) porque la etiqueta vive en una
// bolsa de ropa, a veces arrugada o húmeda, y la barra gruesa aguanta más.
export const FOLIO_BARCODE = { type: 'CODE128', width: 3, height: 80 }

// Ancho imprimible: 48 mm a 203 dpi = 384 puntos. CODE128 ocupa
// 11 × (caracteres + 3) + 2 módulos (inicio, verificador y fin). A grosor 3
// cabe hasta P1234567; un folio más largo baja a grosor 2 en vez de cortarse.
const PRINTABLE_DOTS = 384
const code128Modules = (data) => 11 * (data.length + 3) + 2

export function folioBarcode(orderId) {
  const data = folioCode(orderId)
  const fits = code128Modules(data) * FOLIO_BARCODE.width <= PRINTABLE_DOTS
  return { data, options: fits ? FOLIO_BARCODE : { ...FOLIO_BARCODE, width: 2 } }
}

export function folioCode(orderId) {
  return `${FOLIO_PREFIX}${orderId}`
}

// Lo que escribe el lector, o lo que se teclea a mano si la etiqueta se borró:
// "P123", "p123", "123" o "P000123". Devuelve el folio, o null si no lo es.
export function parseFolio(text) {
  const match = String(text ?? '').trim().match(/^P?0*(\d{1,9})$/i)
  if (!match) return null
  const id = Number(match[1])
  return id > 0 ? id : null
}
