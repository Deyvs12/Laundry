import { getCookie } from 'hono/cookie'
import * as sessions from '../services/sessions.js'

const PUBLIC_PATHS = new Set(['/login', '/auth/login', '/ping'])

function isPublic(path) {
  if (PUBLIC_PATHS.has(path)) return true
  if (path.startsWith('/public/')) return true
  return false
}

export async function requireAuth(c, next) {
  if (isPublic(c.req.path)) return next()

  const sid = getCookie(c, 'sid')
  const session = sessions.get(sid)

  if (!session) {
    if (c.req.header('HX-Request')) {
      c.header('HX-Redirect', '/login')
      return c.body(null, 200)
    }
    return c.redirect('/login')
  }

  c.set('user', session)
  return next()
}
