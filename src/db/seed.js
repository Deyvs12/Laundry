import * as users from '../services/users.js'

// Se exporta para que el login pueda avisar si sigue sin cambiarse.
export const DEFAULT_PASSWORD = 'admin123'

export async function seedAdmin() {
  if (users.count() > 0) return

  const password = await Bun.password.hash(DEFAULT_PASSWORD)
  users.create({
    username: 'admin',
    name: 'Administrador',
    password,
    role: 'admin'
  })

  console.log(`[seed] Usuario admin creado — username: admin, password: ${DEFAULT_PASSWORD}`)
  console.log('[seed] ⚠ Cambia la contraseña por defecto cuanto antes.')
}
