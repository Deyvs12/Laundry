// Sesiones en memoria. Un solo usuario y una sola PC: no hace falta
// persistirlas. Se reinicia el servidor → se vuelve a iniciar sesión.

const HOURS = Number(process.env.SESSION_HOURS) > 0 ? Number(process.env.SESSION_HOURS) : 8
export const TTL_MS = HOURS * 60 * 60 * 1000

const sessions = new Map()

export function create(user) {
  const sid = crypto.randomUUID()
  const now = Date.now()
  sessions.set(sid, {
    userId: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    createdAt: now,
    lastSeen: now
  })
  return sid
}

// Expira por INACTIVIDAD: cada petición válida renueva el plazo. Una PC de
// mostrador en uso no pide login a media jornada; una abandonada, sí.
export function get(sid) {
  if (!sid) return null
  const session = sessions.get(sid)
  if (!session) return null
  if (Date.now() - session.lastSeen > TTL_MS) {
    sessions.delete(sid)
    return null
  }
  session.lastSeen = Date.now()
  return session
}

export function destroy(sid) {
  if (!sid) return
  sessions.delete(sid)
}

// Solo para pruebas: envejece una sesión.
export function _setLastSeen(sid, ts) {
  const s = sessions.get(sid)
  if (s) s.lastSeen = ts
}

// Barrido periódico para que las sesiones abandonadas no se queden en memoria.
const sweeper = setInterval(() => {
  const now = Date.now()
  for (const [sid, s] of sessions) if (now - s.lastSeen > TTL_MS) sessions.delete(sid)
}, 30 * 60 * 1000)
sweeper.unref?.()
