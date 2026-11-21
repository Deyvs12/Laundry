// Codificación del texto para la ticketera, que trabaja en la página de
// códigos PC850 (se selecciona con ESC t 2 al inicio de cada ticket).
//
// TextEncoder solo produce UTF-8: una "ñ" saldría como dos bytes y la
// impresora pintaría dos símbolos raros. Hay que traducir cada carácter a su
// byte de PC850. La tabla es propia para no añadir una dependencia por 128
// valores.

// Caracteres de 0x80 a 0xFF, en orden. Los dos últimos de cada extremo se
// escriben escapados porque son invisibles: 0xF0 es el guion opcional (U+00AD)
// y 0xFF el espacio duro (U+00A0).
const HIGH =
  'ÇüéâäàåçêëèïîìÄÅ' +
  'ÉæÆôöòûùÿÖÜø£Ø×ƒ' +
  'áíóúñÑªº¿®¬½¼¡«»' +
  '░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐' +
  '└┴┬├─┼ãÃ╚╔╩╦╠═╬¤' +
  'ðÐÊËÈıÍÎÏ┘┌█▄¦Ì▀' +
  'ÓßÔÒõÕµþÞÚÛÙýÝ¯´' +
  '­±‗¾¶§÷¸°¨·¹³²■ '

const TABLE = new Map([...HIGH].map((ch, i) => [ch, 0x80 + i]))

// Lo que no existe en PC850 pero aparece seguido al copiar y pegar texto
// (nombres de clientes, notas): mejor una aproximación legible que un "?".
const SUBSTITUTES = {
  '‘': "'", '’': "'", '‚': "'", '‛': "'",
  '“': '"', '”': '"', '„': '"',
  '–': '-', '—': '-', '−': '-',
  '…': '...',
  '€': 'EUR',
  '•': '*',
  ' ': ' ', // espacio duro
  '­': '',  // guion opcional
  '\t': ' '
}

export const UNKNOWN = 0x3f // "?"

// Deja el texto tal como se va a imprimir, carácter por carácter. Las
// funciones de columnas miden después de esto: "…" ocupa tres columnas en
// papel, no una.
export function normalize(text) {
  let out = ''
  for (const ch of String(text ?? '').normalize('NFC')) {
    if (ch in SUBSTITUTES) {
      out += SUBSTITUTES[ch]
      continue
    }
    const code = ch.codePointAt(0)
    // Fuera los caracteres de control, salvo el salto de línea. Un ESC o un GS
    // dentro de un nombre de cliente se interpretaría como un comando de la
    // impresora.
    if (code < 0x20 && ch !== '\n') continue
    if (code === 0x7f) continue
    out += ch
  }
  return out
}

export function encode(text) {
  const chars = [...normalize(text)]
  const bytes = new Uint8Array(chars.length)
  chars.forEach((ch, i) => {
    const code = ch.codePointAt(0)
    bytes[i] = code < 0x80 ? code : (TABLE.get(ch) ?? UNKNOWN)
  })
  return bytes
}

// El camino inverso, para leer lo que se mandó a la impresora (preview.js).
export function decode(bytes) {
  let out = ''
  for (const b of bytes) out += b < 0x80 ? String.fromCharCode(b) : HIGH[b - 0x80]
  return out
}
