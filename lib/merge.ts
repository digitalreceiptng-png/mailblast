/**
 * Replace {{key}} tokens in a template string with values from a row object.
 * Unknown keys are left as-is.
 */
export function mergeTemplate(template: string, row: Record<string, string>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    return row[key] !== undefined ? row[key] : `{{${key}}}`
  })
}

/**
 * Convert plain-text body to HTML.
 * Supports **bold** markdown syntax and preserves line breaks.
 */
export function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  const withBold = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  const withBreaks = withBold.replace(/\n/g, '<br/>')

  return `<div style="font-family:Georgia,serif;font-size:15px;line-height:1.9;color:#1a1a1a;max-width:600px;padding:24px">${withBreaks}</div>`
}
