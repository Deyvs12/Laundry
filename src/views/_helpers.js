export function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function formatMoney(n) {
  return `$${Number(n || 0).toFixed(2)}`
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
