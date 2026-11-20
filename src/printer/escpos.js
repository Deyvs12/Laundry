// Construcción de tickets en ESC/POS para la SNBC BTP-R356H.
//
// INIT, ESC a (alineación) y ESC E (negritas) están probados en papel.
// GS ! (tamaño) y GS k (código de barras) están EN PRUEBA: el ticket de
// /printer "Tamaños y códigos de barras" los ejercita. No se usan en tickets
// reales hasta confirmarlos.
import { encode } from './cp850.js'

const ESC = 0x1b
const FS = 0x1c
const GS = 0x1d

// Va al principio de CADA ticket, en este orden:
//   ESC @    reinicia la impresora (alineación, negritas, etc.)
//   FS .     cancela el modo de caracteres chinos de doble byte. La impresora
//            arranca con él activo, y en ese modo cualquier byte entre 0xA1 y
//            0xF7 se come el siguiente: "niño" salía como "nio". No se sabe si
//            el ajuste sobrevive a un apagado, así que se manda siempre.
//   ESC t 2  página de códigos PC850, la que usa cp850.js.
export const INIT = Uint8Array.of(ESC, 0x40, FS, 0x2e, ESC, 0x74, 0x02)

// No tiene autocorte: el papel se rasga a mano, y el último renglón impreso
// tiene que salir por encima de la cuchilla.
export const FEED_LINES = 5

const LF = 0x0a
const ALIGN = { left: 0, center: 1, right: 2 }

// m del formato "B" de GS k.
//   CODE39: mayúsculas, dígitos, espacio y - . $ / + %. Más ancho, pero lo lee
//           cualquier lector.
//   CODE128: cualquier ASCII imprimible, más compacto. "{B" le dice a la
//           impresora qué juego de caracteres usar; no aparece en el código
//           leído.
const BARCODES = {
  CODE39: { m: 69, prefix: '', valid: /^[0-9A-Z \-.$/+%]{1,40}$/ },
  CODE128: { m: 73, prefix: '{B', valid: /^[\x20-\x7e]{1,40}$/ }
}

export class Ticket {
  #parts = [INIT]

  align(where) {
    if (!(where in ALIGN)) throw new Error(`Alineación desconocida: ${where}`)
    this.#parts.push(Uint8Array.of(ESC, 0x61, ALIGN[where]))
    return this
  }

  bold(on = true) {
    this.#parts.push(Uint8Array.of(ESC, 0x45, on ? 1 : 0))
    return this
  }

  // Un renglón. Se espera que ya venga del ancho correcto (ver columns.js).
  line(text = '') {
    this.#parts.push(encode(text), Uint8Array.of(LF))
    return this
  }

  lines(list) {
    for (const l of list) this.line(l)
    return this
  }

  feed(n = 1) {
    this.#parts.push(new Uint8Array(n).fill(LF))
    return this
  }

  // GS ! n: multiplica el ancho y el alto de la letra (1 a 8 cada uno). A
  // doble ancho caben 16 columnas en vez de 32. size() sin argumentos vuelve
  // al tamaño normal.
  size(width = 1, height = 1) {
    for (const v of [width, height]) {
      if (!Number.isInteger(v) || v < 1 || v > 8) throw new Error(`Tamaño fuera de rango: ${v}`)
    }
    this.#parts.push(Uint8Array.of(GS, 0x21, ((width - 1) << 4) | (height - 1)))
    return this
  }

  // Código de barras, centrado o no según la alineación actual.
  //   width   GS w: grosor de la barra más delgada, en puntos (2 a 6)
  //   height  GS h: alto en puntos (203 dpi: 80 puntos ≈ 1 cm)
  //   text    GS H: el contenido en texto legible debajo del código
  barcode(data, { type = 'CODE128', width = 2, height = 80, text = true } = {}) {
    const symbology = BARCODES[type]
    if (!symbology) throw new Error(`Código de barras no soportado: ${type}`)
    if (!symbology.valid.test(data)) throw new Error(`"${data}" no se puede codificar en ${type}`)
    if (!Number.isInteger(width) || width < 2 || width > 6) throw new Error(`Grosor fuera de rango: ${width}`)
    if (!Number.isInteger(height) || height < 1 || height > 255) throw new Error(`Alto fuera de rango: ${height}`)

    // Formato "B" de GS k: GS k m n datos, con n = número de bytes.
    const payload = new TextEncoder().encode(symbology.prefix + data)
    this.#parts.push(
      Uint8Array.of(GS, 0x77, width),
      Uint8Array.of(GS, 0x68, height),
      Uint8Array.of(GS, 0x48, text ? 2 : 0),
      Uint8Array.of(GS, 0x6b, symbology.m, payload.length),
      payload
    )
    return this
  }

  // Los bytes finales, con el avance para rasgar ya incluido.
  build() {
    return concat([...this.#parts, new Uint8Array(FEED_LINES).fill(LF)])
  }
}

function concat(parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}
