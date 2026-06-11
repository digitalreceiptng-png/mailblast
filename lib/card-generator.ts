import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas'
import path from 'path'
import fs from 'fs'

// Register bundled Noto Serif fonts at module-load time.
// Georgia is not available on Linux (Vercel), so we ship our own serif font.
const FONTS_DIR    = path.join(process.cwd(), 'public', 'fonts')
const FONT_REGULAR = path.join(FONTS_DIR, 'NotoSerif-Regular.ttf')
const FONT_BOLD    = path.join(FONTS_DIR, 'NotoSerif-Bold.ttf')

if (fs.existsSync(FONT_REGULAR)) {
  GlobalFonts.registerFromPath(FONT_REGULAR, 'CardSerif')
  console.log('[card-generator] Registered CardSerif Regular')
} else {
  console.error('[card-generator] Font not found:', FONT_REGULAR)
}
if (fs.existsSync(FONT_BOLD)) {
  GlobalFonts.registerFromPath(FONT_BOLD, 'CardSerif')
  console.log('[card-generator] Registered CardSerif Bold')
} else {
  console.error('[card-generator] Font not found:', FONT_BOLD)
}

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
const ID_FONT    = 'normal 28px CardSerif, "Noto Serif", "Liberation Serif", Georgia, serif'
const ID_COLOR   = '#1f1f1f'

// Strip leading "N. " row-number prefixes that appear in exported CSV data
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

  // ── Full Name (centre of card, between the decorative dividers) ───────────
  const displayName = stripNumberPrefix(name)
  const maxWidth    = img.width * 0.70
  let   fontSize    = NAME_FONT_MAX

  ctx.font = `bold ${fontSize}px CardSerif, "Noto Serif", "Liberation Serif", Georgia, serif`
  while (ctx.measureText(displayName).width > maxWidth && fontSize > 16) {
    fontSize -= 2
    ctx.font = `bold ${fontSize}px CardSerif, "Noto Serif", "Liberation Serif", Georgia, serif`
  }

  ctx.fillStyle    = NAME_COLOR
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(displayName, img.width * NAME_X_RATIO, img.height * NAME_Y_RATIO)

  return canvas.toBuffer('image/png')
}
