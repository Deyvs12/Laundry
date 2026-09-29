import { layout } from './views/layout.js'

// Toda página completa pasa por aquí: el layout necesita el usuario y el
// estado de la caja, y así ningún controlador tiene que acordarse de pasarlos.
export function render(c, { title, body }) {
  return c.html(
    layout({
      title,
      body,
      user: c.get('user'),
      shift: c.get('shift'),
      // La barra resalta la sección actual a partir de la ruta.
      path: c.req.path
    })
  )
}
