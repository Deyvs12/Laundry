import { escapeHtml } from './_helpers.js'

export function layout({ title = 'Laundry', body = '', user = null, shift = null } = {}) {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <link rel="stylesheet" href="/public/css/output.css">
  <script src="/public/js/htmx.min.js" defer></script>
</head>
<body class="min-h-screen bg-slate-50 text-slate-800">
  ${user ? renderNav(user, shift) : ''}
  <main id="main" class="max-w-5xl mx-auto p-6">
    ${body}
  </main>
</body>
</html>`
}

function renderNav(user, shift) {
  return `<nav class="bg-white border-b border-slate-200">
    <div class="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
      <div class="flex items-center gap-6">
        <a href="/" class="font-semibold">Laundry</a>
        <a href="/orders" class="text-sm text-slate-600 hover:text-slate-900">Pedidos</a>
        <a href="/clients" class="text-sm text-slate-600 hover:text-slate-900">Clientes</a>
        <a href="/services" class="text-sm text-slate-600 hover:text-slate-900">Servicios</a>
        <a href="/staff" class="text-sm text-slate-600 hover:text-slate-900">Personal</a>
        <a href="/reports" class="text-sm text-slate-600 hover:text-slate-900">Reportes</a>
        <a href="/logs" class="text-sm text-slate-600 hover:text-slate-900">Bitácora</a>
        <a href="/cash" class="text-sm text-slate-600 hover:text-slate-900">Caja
          <span class="ml-1 px-2 py-0.5 rounded text-xs ${shift ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-600'}">${shift ? `abierta #${shift.id}` : 'cerrada'}</span>
        </a>
      </div>
      <div class="flex items-center gap-4 text-sm">
        <span class="text-slate-600">${escapeHtml(user.name)} (${escapeHtml(user.role)})</span>
        <button
          hx-post="/auth/logout"
          class="px-3 py-1 rounded bg-slate-200 hover:bg-slate-300">
          Cerrar sesión
        </button>
      </div>
    </div>
  </nav>`
}
