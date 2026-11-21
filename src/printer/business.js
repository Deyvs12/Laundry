// Datos del negocio para el encabezado y el pie de los tickets. Vienen de
// variables de entorno; Bun las lee solas del archivo .env de la raíz del
// proyecto. Ver README, "Impresora de tickets".
//
// Una variable vacía o ausente simplemente no se imprime. En dirección y pie,
// "|" separa renglones, porque un .env no admite saltos de línea cómodos.
// Hay un ejemplo completo en el README.

export const BUSINESS_VARS = {
  name: 'LAVANDERIA_NEGOCIO',
  address: 'LAVANDERIA_DIRECCION',
  phone: 'LAVANDERIA_TELEFONO',
  footer: 'LAVANDERIA_PIE_TICKET'
}

// Se lee en cada llamada, no al arrancar: es barato, y las pruebas pueden
// cambiar los valores sin reiniciar el proceso.
export function business(env = process.env) {
  const read = (key) => (env[key] ?? '').toString().trim()
  const lines = (key) =>
    read(key)
      .split('|')
      .map((l) => l.trim())
      .filter(Boolean)

  return {
    name: read(BUSINESS_VARS.name),
    address: lines(BUSINESS_VARS.address),
    phone: read(BUSINESS_VARS.phone),
    footer: lines(BUSINESS_VARS.footer)
  }
}

// Las variables sin valor, para avisarlo en /printer en vez de descubrirlo con
// el ticket ya impreso.
export function missingBusinessVars(env = process.env) {
  return Object.values(BUSINESS_VARS).filter((key) => !(env[key] ?? '').toString().trim())
}
