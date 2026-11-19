// Construcción de tickets en ESC/POS para la SNBC BTP-R356H.
//
// Solo están los comandos probados a mano en esta impresora. GS ! (tamaño de
// letra) y GS k (código de barras) existen en el manual, pero no se han
// probado y no se usan todavía.
import { encode } from './cp850.js'

const ESC = 0x1b
const FS = 0x1c

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
