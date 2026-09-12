import { setCookie, deleteCookie, getCookie } from 'hono/cookie'
import * as users from '../services/users.js'
import * as sessions from '../services/sessions.js'
import * as logs from '../services/logs.js'
import { loginPage, loginError } from '../views/login.js'

const COOKIE_NAME = 'sid'
const cookieOpts = {
  httpOnly: true,
  sameSite: 'Lax',
  path: '/'
}

export function showLogin(c) {
  const sid = getCookie(c, COOKIE_NAME)
  if (sessions.get(sid)) return c.redirect('/')
  return c.html(loginPage())
}

export async function login(c) {
  const form = await c.req.parseBody()
  const username = (form.username || '').toString().trim()
  const password = (form.password || '').toString()

  if (!username || !password) {
    return c.html(loginError('Usuario y contraseña son obligatorios'))
  }

  const user = users.findByUsername(username)
  if (!user) {
    return c.html(loginError('Credenciales inválidas'))
  }

  // verify lanza (no devuelve false) si el hash guardado no es válido, por
  // ejemplo si alguien metió una contraseña en texto plano a mano en la DB.
  let ok = false
  try {
    ok = await Bun.password.verify(password, user.password)
  } catch {
    ok = false
  }
  if (!ok) {
    return c.html(loginError('Credenciales inválidas'))
  }

  const sid = sessions.create(user)
  setCookie(c, COOKIE_NAME, sid, cookieOpts)
  logs.insert({
    userId: user.id,
    action: 'USER_LOGIN',
    message: `Inicio de sesión: ${user.username}`
  })

  c.header('HX-Redirect', '/')
  return c.body(null, 200)
}

export function logout(c) {
  const sid = getCookie(c, COOKIE_NAME)
  const session = sessions.get(sid)
  if (session) {
    logs.insert({
      userId: session.userId,
      action: 'USER_LOGOUT',
      message: `Cierre de sesión: ${session.username}`
    })
    sessions.destroy(sid)
  }
  deleteCookie(c, COOKIE_NAME, cookieOpts)

  if (c.req.header('HX-Request')) {
    c.header('HX-Redirect', '/login')
    return c.body(null, 200)
  }
  return c.redirect('/login')
}
