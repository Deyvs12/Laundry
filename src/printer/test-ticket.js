// Ticket de prueba: ejercita todo lo que el módulo sabe hacer, para revisarlo
// con el papel en la mano.
import { Ticket } from './escpos.js'
import { COLS, row, rule, wrap } from './columns.js'

export function testTicket(now = new Date()) {
  const when = now.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })

  return new Ticket()
    .align('center')
    .bold()
    .line('PRUEBA DE IMPRESIÓN')
    .bold(false)
    .line(when)
    .align('left')
    .line(rule())

    // Si falta algún carácter, o si desaparece el que va después de la ñ o de
    // la ¿, la página de códigos o el modo de doble byte están mal.
    .line('Acentos:')
    .line('áéíóú üñ ÁÉÍÓÚ ÜÑ ¿¡')
    .line('Niño, año, ¿qué tal?')
    .line(rule())

    // Los 32 dígitos tienen que caber en un solo renglón, sin saltar.
    .line(`Ancho (${COLS} columnas):`)
    .line('12345678901234567890123456789012')
    .line(rule())

    .lines(row('Lavado por kilo (3 kg)', '$255.00'))
    .lines(row('Planchado camisa', '$35.00'))
    .lines(row('Tintorería: traje completo de dos piezas con chaleco', '$420.00'))
    .line(rule())
    .bold()
    .lines(row('TOTAL', '$710.00'))
    .bold(false)
    .line()

    .lines(wrap('Este renglón es largo a propósito para comprobar que el texto se parte entre palabras sin cortar ninguna.'))
    .line()
    .align('center')
    .line('Fin de la prueba')
    .build()
}

// Fase 0: tamaños de letra y códigos de barras, todavía sin confirmar en esta
// impresora. Cada bloque dice qué debería verse, para compararlo en el papel.
export function commandsTestTicket(now = new Date()) {
  const when = now.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
  const t = new Ticket()
    .align('center')
    .bold()
    .line('PRUEBA: TAMAÑOS Y CÓDIGOS')
    .bold(false)
    .line(when)
    .align('left')
    .line(rule())

    // GS !: si no lo reconoce, todo sale del tamaño normal.
    .line('Tamaño normal:')
    .line('Folio P123')
    .line('Doble alto:')
    .size(1, 2).line('Folio P123').size()
    .line('Doble ancho:')
    .size(2, 1).line('Folio P123').size()
    .line('Doble alto y ancho:')
    .size(2, 2).line('Folio P123').size()
    .line('Triple alto y ancho:')
    .size(3, 3).line('P123').size()
    .line('Doble ancho = 16 columnas:')
    .size(2, 1).line('1234567890123456').size()
    .line(rule())

  // GS k: cada código lleva su descripción arriba y el texto legible abajo.
  // P12345 es para ver si un folio largo sigue cabiendo en 58 mm.
  const codes = [
    ['CODE128, grosor 2', 'P123', 'CODE128', 2],
    ['CODE128, grosor 3', 'P123', 'CODE128', 3],
    ['CODE128, grosor 3, folio largo', 'P12345', 'CODE128', 3],
    ['CODE39, grosor 2', 'P123', 'CODE39', 2],
    ['CODE39, grosor 3', 'P123', 'CODE39', 3],
    ['CODE39, grosor 2, folio largo', 'P12345', 'CODE39', 2]
  ]
  for (const [label, data, type, width] of codes) {
    t.align('left').line(label + ':').align('center').barcode(data, { type, width, height: 80 }).feed(1)
  }

  return t
    .align('left')
    .line(rule())
    .lines(wrap('Si después de un código no aparece texto, o el resto del ticket sale raro, ese comando no lo reconoce la impresora.'))
    .line()
    .align('center')
    .line('Fin de la prueba')
    .build()
}
