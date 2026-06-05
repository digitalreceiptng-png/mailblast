/**
 * Replace {{key}} tokens in a template string with values from a row object.
 * Unknown keys are left as-is.
 */
export function mergeTemplate(template: string, row: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return row[key] !== undefined ? row[key] : `{{${key}}}`
  })
}

/**
 * Convert plain-text body to basic HTML (preserves line breaks).
 */
export function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return `<div style="font-family:sans-serif;font-size:15px;line-height:1.7;color:#1a1a1a;max-width:600px">${escaped.replace(/\n/g, '<br/>')}</div>`
}
