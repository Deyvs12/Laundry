export function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function formatMoney(n) {
  return `$${Number(n || 0).toFixed(2)}`
}

// SQLite guarda CURRENT_TIMESTAMP en UTC ('YYYY-MM-DD HH:MM:SS'). Un pedido
// registrado a las 8 pm aparecería con fecha de mañana si se mostrara tal cual.
//
//  - Las fechas con hora se convierten a la zona local de la PC del servidor.
//  - Las fechas que captura el usuario (entrega estimada) son 'YYYY-MM-DD' sin
//    zona: se muestran tal cual, sin convertir.
//
// Regla para SQL que agrupe por día (reportes, cortes de caja):
//   date(created_at, 'localtime')   — nunca date(created_at) a secas.
function toLocal(s) {
  return new Date(s.replace(' ', 'T') + 'Z')
}

export function formatDate(s) {
  if (!s) return '—'
  if (s.length === 10) {
    const [y, m, d] = s.split('-')
    return `${d}/${m}/${y}`
  }
  return toLocal(s).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

export function formatDateTime(s) {
  if (!s) return '—'
  return toLocal(s).toLocaleString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// options: [{ value, label }] — de src/constants.js
export function renderOptions(options, selected, placeholder = null) {
  const head = placeholder
    ? `<option value="">${escapeHtml(placeholder)}</option>`
    : ''

  return (
    head +
    options
      .map(
        (o) =>
          `<option value="${escapeHtml(o.value)}"${
            o.value === selected ? ' selected' : ''
          }>${escapeHtml(o.label)}</option>`
      )
      .join('')
  )
}
