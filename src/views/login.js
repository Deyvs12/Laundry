import { layout } from './layout.js'

export function loginPage() {
  const body = `
  <div class="min-h-[80vh] flex items-center justify-center">
    <div class="w-full max-w-sm bg-white rounded-lg shadow p-6">
      <h1 class="text-xl font-semibold mb-1">Iniciar sesión</h1>
      <p class="text-sm text-slate-500 mb-5">Sistema de gestión Laundry</p>

      <form
        hx-post="/auth/login"
        hx-target="#login-error"
        hx-swap="innerHTML"
        class="space-y-4">

        <div>
          <label class="block text-sm font-medium mb-1" for="username">Usuario</label>
          <input
            id="username"
            name="username"
            type="text"
            autocomplete="username"
            required
            class="w-full border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400">
        </div>

        <div>
          <label class="block text-sm font-medium mb-1" for="password">Contraseña</label>
          <input
            id="password"
            name="password"
            type="password"
            autocomplete="current-password"
            required
            class="w-full border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400">
        </div>

        <div id="login-error" class="text-sm text-red-600 min-h-[1.25rem]"></div>

        <button
          type="submit"
          class="w-full bg-slate-800 text-white rounded py-2 hover:bg-slate-700">
          Entrar
        </button>
      </form>
    </div>
  </div>`

  return layout({ title: 'Login — Laundry', body })
}

export function loginError(message) {
  return `<span>${escapeHtml(message)}</span>`
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
