import { escapeHtml } from './_helpers.js'
import { icon } from './components.js'

// Secciones de la barra. `match` decide cuál se resalta: sin eso, en una app
// de mostrador es fácil perder de vista dónde estás.
const SECTIONS = [
  { href: '/', label: 'Nuevo pedido', name: 'plus', match: (p) => p === '/' || p.startsWith('/orders/new') },
  {
    href: '/orders',
    label: 'Pedidos',
    name: 'list',
    match: (p) => p === '/orders' || (p.startsWith('/orders') && !p.startsWith('/orders/new'))
  },
  { href: '/clients', label: 'Clientes', name: 'people', match: (p) => p.startsWith('/clients') },
  { href: '/services', label: 'Servicios', name: 'tag', match: (p) => p.startsWith('/services') },
  { href: '/staff', label: 'Personal', name: 'user', match: (p) => p.startsWith('/staff') },
  { href: '/cash', label: 'Caja', name: 'cash', match: (p) => p.startsWith('/cash') },
  {
    href: '/reports',
    label: 'Reportes',
    name: 'chart',
    match: (p) => p.startsWith('/reports') || p.startsWith('/backups')
  },
  { href: '/logs', label: 'Bitácora', name: 'clock', match: (p) => p.startsWith('/logs') }
]

export function layout({ title = 'Laundry', body = '', user = null, shift = null, path = '/' } = {}) {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <link rel="stylesheet" href="/public/css/output.css">
  <script src="/public/js/htmx.min.js" defer></script>
</head>
<body class="min-h-screen">
  ${user ? renderNav(user, shift, path) : ''}
  ${user?.usingDefaultPassword ? defaultPasswordBanner() : ''}
  <main id="main" class="max-w-6xl mx-auto px-4 sm:px-6 py-6">
    ${body}
  </main>
</body>
</html>`
}

// Mientras siga la contraseña de fábrica, cualquiera en la red local puede
// entrar. El aviso no se puede cerrar: desaparece al cambiarla.
function defaultPasswordBanner() {
  return `<div class="bg-rose-600 text-white text-sm">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-2">
      ${icon('x', 'w-4 h-4 shrink-0')}
      <span>Estás usando la contraseña por defecto.
        <a href="/account" class="underline font-semibold">Cámbiala ahora</a> antes de dejar el sistema en uso.</span>
    </div>
  </div>`
}

// Dos filas: arriba identidad y cuenta, abajo las secciones. En una sola fila
// los ocho enlaces no caben en tablet, y esta partición evita menús ocultos:
// todo está siempre a un toque.
function renderNav(user, shift, path) {
  return `<header class="bg-white border-b border-slate-200 sticky top-0 z-20">
    <div class="max-w-6xl mx-auto px-4 sm:px-6">

      <div class="flex items-center justify-between gap-4 h-14">
        <a href="/" class="flex items-center gap-2.5 shrink-0">
          <span class="grid place-items-center w-8 h-8 rounded-lg bg-brand-600 text-white">
            ${icon('cart', 'w-[18px] h-[18px]')}
          </span>
          <span class="font-semibold text-slate-900 tracking-tight hidden sm:block">Lavandería</span>
        </a>

        <div class="flex items-center gap-2">
          <a href="/account"
            class="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900">
            ${icon('user', 'w-4 h-4')}
            <span class="hidden sm:block">${escapeHtml(user.name)}</span>
          </a>
          <button hx-post="/auth/logout" class="btn btn-ghost btn-sm">Salir</button>
        </div>
      </div>

      <nav class="flex items-center gap-1 overflow-x-auto no-scrollbar pb-2 -mb-px">
        ${SECTIONS.map((s) => navLink(s, path, shift)).join('')}
      </nav>

    </div>
  </header>`
}

function navLink(section, path, shift) {
  const active = section.match(path)
  return `<a href="${section.href}" class="nav-link ${active ? 'nav-link-active' : ''}">
    ${icon(section.name, 'w-[18px] h-[18px] shrink-0')}
    <span>${section.label}</span>
    ${section.href === '/cash' ? cashDot(shift) : ''}
  </a>`
}

// Un punto de color basta para saber si la caja está abierta sin leer nada.
// El texto accesible dice lo mismo para quien use lector de pantalla.
function cashDot(shift) {
  return shift
    ? `<span class="flex items-center gap-1 text-xs font-semibold text-emerald-700" title="Caja abierta">
         <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>#${shift.id}
         <span class="sr-only">Caja abierta</span>
       </span>`
    : `<span class="w-1.5 h-1.5 rounded-full bg-slate-300" title="Caja cerrada">
         <span class="sr-only">Caja cerrada</span>
       </span>`
}
