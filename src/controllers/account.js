import * as users from '../services/users.js'
import * as sessions from '../services/sessions.js'
import * as logs from '../services/logs.js'
import { getCookie } from 'hono/cookie'
import { render } from '../render.js'
import { accountPage, passwordForm, MIN_LENGTH } from '../views/account/index.js'

export function index(c) {
  return render(c, { title: 'Mi cuenta — Laundry', body: accountPage(c.get('user')) })
}

export async function changePassword(c) {
  const body = await c.req.parseBody()
  const current = (body.current_password || '').toString()
  const next = (body.new_password || '').toString()
  const confirm = (body.confirm_password || '').toString()
  const session = c.get('user')

  const fail = (message) => c.html(passwordForm({ error: message }))

  if (!current || !next || !confirm) return fail('Completa los tres campos')
  if (next.length < MIN_LENGTH) return fail(`La contraseña nueva debe tener al menos ${MIN_LENGTH} caracteres`)
  if (next !== confirm) return fail('La contraseña nueva y su repetición no coinciden')
  if (next === current) return fail('La contraseña nueva debe ser distinta de la actual')

  // Se pide la actual aunque ya haya sesión: evita que alguien cambie la
  // contraseña en una PC que quedó abierta sin conocer la anterior.
  const user = users.findByUsername(session.username)
  let ok = false
  try {
    ok = await Bun.password.verify(current, user.password)
  } catch {
    ok = false
  }
  if (!ok) return fail('La contraseña actual no es correcta')

  users.updatePassword(user.id, await Bun.password.hash(next))
  logs.insert({
    userId: user.id,
    action: 'USER_PASSWORD_CHANGED',
    message: `El usuario ${user.username} cambió su contraseña`
  })

  sessions.destroyOthers(getCookie(c, 'sid'))
  // La sesión actual es el mismo objeto guardado en memoria: el aviso de
  // contraseña por defecto desaparece sin volver a entrar.
  session.usingDefaultPassword = false

  return c.html(passwordForm({ success: true }))
}
