// Envío de bytes a la ticketera.
//
// Linux expone la impresora como un archivo de dispositivo (driver usblp) y
// basta con escribirle. La regla udev del README le da el nombre fijo
// /dev/ticketera.
import { open } from 'node:fs/promises'
import { constants } from 'node:fs'

export const DEFAULT_DEVICE = '/dev/ticketera'
export const DEFAULT_TIMEOUT_MS = 10_000

export function devicePath() {
  return process.env.LAVANDERIA_TICKETERA || DEFAULT_DEVICE
}

export class PrinterError extends Error {
  constructor(code, message, cause = null) {
    super(message)
    this.name = 'PrinterError'
    this.code = code
    this.cause = cause
  }
}

// Sin O_CREAT a propósito: con la impresora desconectada, /dev/ticketera no
// existe, y abrir con 'w' intentaría crear un archivo normal en su lugar. El
// error sería un "permiso denegado" que despista. O_APPEND no cambia nada en
// un dispositivo y permite probar contra un archivo común.
const FLAGS = constants.O_WRONLY | constants.O_APPEND

// Cola serial: cada trabajo empieza cuando el anterior terminó, bien o mal.
// Dos tickets pedidos casi a la vez salen uno detrás de otro, nunca mezclados.
let tail = Promise.resolve()

// Escritura que superó el tiempo límite y sigue pendiente en el sistema. Con
// usblp, una impresora sin papel o con la tapa abierta puede dejar la
// escritura bloqueada en vez de fallar. Mientras siga ahí se rechazan los
// tickets nuevos: si la cola avanzara, sus bytes podrían salir intercalados
// con los del ticket atorado cuando la impresora reaccione.
let stuck = null

export function print(bytes, { path = devicePath(), timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const job = tail.then(() => run(bytes, path, timeoutMs))
  tail = job.catch(() => {})
  return job
}

async function run(bytes, path, timeoutMs) {
  if (stuck) throw timeoutError(path)

  const write = writeAll(bytes, path)
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(timeoutError(path)), timeoutMs)
  })

  try {
    await Promise.race([write, timeout])
  } catch (err) {
    if (err instanceof PrinterError && err.code === 'TIMEOUT') {
      const pending = write.catch(() => {}).finally(() => {
        if (stuck === pending) stuck = null
      })
      stuck = pending
      throw err
    }
    throw translate(err, path)
  } finally {
    clearTimeout(timer)
  }
}

async function writeAll(bytes, path) {
  const handle = await open(path, FLAGS)
  try {
    // write() puede escribir solo una parte; se repite hasta mandar todo.
    let offset = 0
    while (offset < bytes.length) {
      const { bytesWritten } = await handle.write(bytes, offset, bytes.length - offset)
      if (bytesWritten === 0) throw Object.assign(new Error('write devolvió 0 bytes'), { code: 'EIO' })
      offset += bytesWritten
    }
  } finally {
    await handle.close()
  }
}

function timeoutError(path) {
  return new PrinterError(
    'TIMEOUT',
    `La impresora no respondió (${path}). Revisa que tenga papel y la tapa cerrada.`
  )
}

function translate(err, path) {
  switch (err?.code) {
    case 'ENOENT':
    case 'ENODEV':
    case 'ENXIO':
      return new PrinterError(
        'NOT_FOUND',
        `No se encontró la impresora en ${path}. ¿Está conectada y encendida?`,
        err
      )
    case 'EACCES':
    case 'EPERM':
      return new PrinterError(
        'NO_PERMISSION',
        `Sin permiso para usar la impresora (${path}). El usuario del servidor debe estar en el grupo lp: ver README, "Impresora de tickets", paso 3.`,
        err
      )
    case 'EBUSY':
      return new PrinterError('BUSY', `Otro programa está usando la impresora (${path}).`, err)
    case 'EIO':
      return new PrinterError(
        'IO',
        `Error de comunicación con la impresora (${path}). Puede estar apagada, sin papel o desconectada.`,
        err
      )
    default:
      return new PrinterError('UNKNOWN', `No se pudo imprimir (${path}): ${err?.message || err}`, err)
  }
}
