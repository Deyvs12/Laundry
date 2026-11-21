// Interpreta los bytes ESC/POS que genera este módulo y devuelve el texto como
// saldría en el papel: alineación, negritas, tamaño y códigos de barras.
//
// Sirve para revisar un ticket sin gastar papel y para que las pruebas midan
// el ancho real de cada renglón (a doble ancho, 16 caracteres ya llenan el
// papel). Solo entiende los comandos de escpos.js; uno desconocido es un error,
// para que un comando nuevo no pase sin probarse.
import { COLS } from './columns.js'
import { decode } from './cp850.js'

export function parse(bytes) {
  const lines = []
  let state = { align: 'left', bold: false, width: 1, height: 1 }
  let current = []
  const flush = () => {
    lines.push({ text: decode(current), ...state })
    current = []
  }

  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]
    if (b === 0x0a) {
      flush()
    } else if (b === 0x1b) {
      const cmd = bytes[++i]
      if (cmd === 0x40) state = { align: 'left', bold: false, width: 1, height: 1 }
      else if (cmd === 0x61) state.align = ['left', 'center', 'right'][bytes[++i]]
      else if (cmd === 0x45) state.bold = bytes[++i] === 1
      else if (cmd === 0x74) i++
      else throw new Error(`ESC desconocido: 0x${cmd.toString(16)} en ${i}`)
    } else if (b === 0x1c) {
      if (bytes[++i] !== 0x2e) throw new Error(`FS desconocido en ${i}`)
    } else if (b === 0x1d) {
      const cmd = bytes[++i]
      if (cmd === 0x21) {
        const n = bytes[++i]
        state.width = (n >> 4) + 1
        state.height = (n & 0x0f) + 1
      } else if (cmd === 0x77 || cmd === 0x68 || cmd === 0x48) {
        i++
      } else if (cmd === 0x6b) {
        const m = bytes[++i]
        const n = bytes[++i]
        let data = new TextDecoder().decode(bytes.slice(i + 1, i + 1 + n))
        i += n
        if (m === 73) data = data.replace(/^\{[ABC]/, '')
        lines.push({ text: data, barcode: m === 73 ? 'CODE128' : 'CODE39', ...state })
      } else {
        throw new Error(`GS desconocido: 0x${cmd.toString(16)} en ${i}`)
      }
    } else {
      current.push(b)
    }
  }
  if (current.length) flush()
  return lines
}

// Representación en texto plano, de 32 columnas, para leerla en la terminal.
export function render(bytes) {
  return parse(bytes)
    .map((l) => {
      if (l.barcode) return center(`||| ${l.barcode} ${l.text} |||`) + '\n' + center(l.text)
      const text = l.width > 1 ? [...l.text].join(' '.repeat(l.width - 1)) : l.text
      if (l.align === 'center') return center(text)
      if (l.align === 'right') return text.padStart(COLS)
      return text
    })
    .join('\n')
}

function center(s) {
  const pad = Math.max(0, Math.floor((COLS - [...s].length) / 2))
  return ' '.repeat(pad) + s
}
