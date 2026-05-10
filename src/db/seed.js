import * as users from '../services/users.js'

export async function seedAdmin() {
  if (users.count() > 0) return

  const password = await Bun.password.hash('admin123')
  users.create({
    username: 'admin',
    name: 'Administrador',
    password,
    role: 'admin'
  })

  console.log('[seed] Usuario admin creado — username: admin, password: admin123')
  console.log('[seed] ⚠ Cambia la contraseña por defecto cuanto antes.')
}
