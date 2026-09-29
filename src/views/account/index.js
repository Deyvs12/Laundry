import { escapeHtml } from '../_helpers.js'

export const MIN_LENGTH = 8

export function accountPage(user, { error = null, success = false } = {}) {
  return `
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-semibold">Mi cuenta</h1>
    </div>

    <div class="border border-slate-300 rounded p-4 mb-4 text-sm">
      <div><span class="text-slate-500">Usuario:</span> ${escapeHtml(user.username)}</div>
      <div><span class="text-slate-500">Nombre:</span> ${escapeHtml(user.name)}</div>
    </div>

    ${passwordForm({ error, success })}
  `
}

// Se devuelve entero en cada respuesta: el mensaje y el formulario limpio
// viajan juntos y no pueden quedar desincronizados.
export function passwordForm({ error = null, success = false } = {}) {
  return `
    <div id="password-form" class="border border-slate-300 rounded p-4 max-w-md">
      <h2 class="font-semibold mb-3">Cambiar contraseña</h2>

      ${error ? `<p class="text-sm text-red-600 mb-3">${escapeHtml(error)}</p>` : ''}
      ${success ? '<p class="text-sm text-green-700 mb-3">Contraseña actualizada. Las demás sesiones se cerraron.</p>' : ''}

      <form hx-post="/account/password" hx-target="#password-form" hx-swap="outerHTML" class="space-y-3">
        ${field('current_password', 'Contraseña actual', 'current-password')}
        ${field('new_password', `Contraseña nueva (mínimo ${MIN_LENGTH} caracteres)`, 'new-password')}
        ${field('confirm_password', 'Repite la contraseña nueva', 'new-password')}
        <button type="submit" class="bg-slate-800 text-white px-4 py-2 rounded">Guardar</button>
      </form>
    </div>
  `
}

function field(name, label, autocomplete) {
  return `
    <div>
      <label class="block text-sm font-medium mb-1" for="${name}">${label}</label>
      <input id="${name}" name="${name}" type="password" required autocomplete="${autocomplete}"
        class="w-full border border-slate-300 rounded px-3 py-2">
    </div>
  `
}
