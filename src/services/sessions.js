const sessions = new Map()

export function create(user) {
  const sid = crypto.randomUUID()
  sessions.set(sid, {
    userId: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    createdAt: Date.now()
  })
  return sid
}

export function get(sid) {
  if (!sid) return null
  return sessions.get(sid) || null
}

export function destroy(sid) {
  if (!sid) return
  sessions.delete(sid)
}
