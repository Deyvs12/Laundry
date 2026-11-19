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
