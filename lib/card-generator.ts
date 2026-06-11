import { createCanvas, loadImage } from '@napi-rs/canvas'
import path from 'path'
import fs from 'fs'

// ─── Full Name — gap between the two decorative horizontal dividers ───────────
// Grid analysis on 1127×1600 card: divider gap runs 57.8%–60.3%, centre ≈ 59%
const NAME_X_RATIO  = 0.56
const NAME_Y_RATIO  = 0.590
const NAME_FONT_MAX = 36
const NAME_COLOR    = '#1a5c2a'

// ─── ID Code — top-left of content area, level with top of presidential seal ─
// Sidebar ends at x≈135px (12%).  Seal top sits at y≈48px (3%).
const ID_X_RATIO = 0.12
const ID_Y_RATIO = 0.030
const ID_FONT    = 'normal 28px Georgia, serif'   // matches card secondary text
const ID_COLOR   = '#1f1f1f'                       // near-black, same as date/venue text

// Strip leading row-number prefixes like "1. " or "105. " from CSV exports
function stripNumberPrefix(raw: string): string {
  let s = raw.trim()
  while (/^\d+\.\s+/.test(s)) s = s.replace(/^\d+\.\s+/, '').trim()
  return s
}

export async function generateInvitationCard(
  name: string,
  idCode = ''
): Promise<Buffer> {
  const imagePath = path.join(process.cwd(), 'public', 'invitation-card.png')

  if (!fs.existsSync(imagePath)) {
    throw new Error(
      'Invitation card image not found. Place invitation-card.png in the /public folder.'
    )
  }

  const img = await loadImage(fs.readFileSync(imagePath))
  const canvas = createCanvas(img.width, img.height)
  const ctx    = canvas.getContext('2d')

  ctx.drawImage(img, 0, 0)

  // ── ID Code (top-left, level with presidential seal) ──────────────────────
  if (idCode) {
    ctx.font          = ID_FONT
    ctx.fillStyle     = ID_COLOR
    ctx.textAlign     = 'left'
    ctx.textBaseline  = 'top'
    ctx.fillText(idCode, img.width * ID_X_RATIO, img.height * ID_Y_RATIO)
  }

  // ── Full Name (centre of card content area) ───────────────────────────────
  const displayName = stripNumberPrefix(name)
  const maxWidth    = img.width * 0.70
  let   fontSize    = NAME_FONT_MAX

  ctx.font = `bold ${fontSize}px Georgia, serif`
  while (ctx.measureText(displayName).width > maxWidth && fontSize > 16) {
    fontSize -= 2
    ctx.font = `bold ${fontSize}px Georgia, serif`
  }

  ctx.fillStyle    = NAME_COLOR
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(displayName, img.width * NAME_X_RATIO, img.height * NAME_Y_RATIO)

  return canvas.toBuffer('image/png')
}
