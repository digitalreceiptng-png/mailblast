export function stripNumberPrefix(raw: string): string {
  let s = raw.trim()
  while (/^\d+\.\s+/.test(s)) s = s.replace(/^\d+\.\s+/, '').trim()
  return s
}

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
 * Supports **bold** and [text](url) markdown syntax and preserves line breaks.
 */
export function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  const withLinks = escaped.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a href="$2" style="color:#1a1a1a;font-weight:bold;text-decoration:underline">$1</a>'
  )
  const withBold   = withLinks.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  const withBreaks = withBold.replace(/\n/g, '<br/>')

  return `<div style="font-family:Georgia,serif;font-size:15px;line-height:1.9;color:#1a1a1a;max-width:600px;padding:24px">${withBreaks}</div>`
}
