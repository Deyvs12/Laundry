export function clientsList(clients) {
  return `
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-semibold">Clientes</h1>
      <button class="bg-slate-800 text-white px-3 py-1 rounded">
        Nuevo cliente
      </button>
    </div>

    ${clients.length === 0
      ? `<p class="text-slate-500">Aún no hay clientes registrados.</p>`
      : renderTable(clients)
    }
  `
}

function renderTable(clients) {
  return `
    <table class="w-full border border-slate-300 text-sm">
      <thead class="bg-slate-100 text-left">
        <tr>
          <th class="border border-slate-300 px-3 py-2">Nombre</th>
          <th class="border border-slate-300 px-3 py-2">Teléfono</th>
          <th class="border border-slate-300 px-3 py-2">Notas</th>
          <th class="border border-slate-300 px-3 py-2">Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${clients.map(renderRow).join('')}
      </tbody>
    </table>
  `
}

function renderRow(client) {
  return `
    <tr>
      <td class="border border-slate-300 px-3 py-2">${escapeHtml(client.name)}</td>
      <td class="border border-slate-300 px-3 py-2">${escapeHtml(client.phone || '—')}</td>
      <td class="border border-slate-300 px-3 py-2">${escapeHtml(client.notes || '—')}</td>
      <td class="border border-slate-300 px-3 py-2">
        <button class="text-blue-600 mr-2">Editar</button>
        <button class="text-red-600">Eliminar</button>
      </td>
    </tr>
  `
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
