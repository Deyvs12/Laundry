// Formato de texto a ancho fijo para papel de 58 mm: 32 columnas con la fuente
// normal. Todo se mide después de normalize(), que es exactamente lo que se
// imprime.
import { normalize } from './cp850.js'

export const COLS = 32

// Parte un texto en renglones de como máximo `width` columnas. Corta entre
// palabras; una palabra más larga que el renglón (un correo, un folio) se
// corta a la fuerza para que nunca se desborde. Respeta los saltos de línea
// que ya traiga el texto.
export function wrap(text, width = COLS) {
  const lines = []
  for (const paragraph of normalize(text).split('\n')) {
    let line = ''
    for (let word of paragraph.split(' ').filter(Boolean)) {
      while ([...word].length > width) {
        if (line) {
          lines.push(line)
          line = ''
        }
        const chars = [...word]
        lines.push(chars.slice(0, width).join(''))
        word = chars.slice(width).join('')
      }
      if (!word) continue
      const candidate = line ? `${line} ${word}` : word
      if ([...candidate].length <= width) {
        line = candidate
      } else {
        lines.push(line)
        line = word
      }
    }
    lines.push(line)
  }
  return lines
}

// Concepto a la izquierda y precio a la derecha:
//
//   Lavado por kilo           $85.00
//
// Si el concepto no cabe, se parte en varios renglones y el precio queda en el
// último, siempre pegado al margen derecho para que la columna de importes se
// lea de un vistazo.
export function row(left, right, width = COLS) {
  const r = normalize(right)
  const rLen = [...r].length
  // Al menos un espacio entre concepto y precio.
  const room = width - rLen - 1
  if (room < 1) return [...wrap(left, width), ...wrap(r, width).map((l) => padStart(l, width))]

  const lines = wrap(left, room)
  const last = lines.pop()
  return [...lines, padEnd(last, width - rLen) + r]
}

// Línea divisoria de lado a lado.
export function rule(char = '-', width = COLS) {
  return char.repeat(width)
}

function padEnd(s, width) {
  return s + ' '.repeat(Math.max(0, width - [...s].length))
}

function padStart(s, width) {
  return ' '.repeat(Math.max(0, width - [...s].length)) + s
}
