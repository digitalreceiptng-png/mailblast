import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas'
import path from 'path'
import fs from 'fs'
import { FONT_REGULAR_B64, FONT_BOLD_B64 } from './font-data'

// Fonts are embedded in the JS bundle (lib/font-data.ts).
// On first call we decode them to /tmp/ (always writable on Vercel Lambda)
// and register with @napi-rs/canvas. This is the only approach that works
// reliably on serverless — filesystem paths to static files are not guaranteed.
let fontsReady = false

function ensureFonts() {
  if (fontsReady) return
  try {
    const rPath = '/tmp/CardSerif-Regular.ttf'
    const bPath = '/tmp/CardSerif-Bold.ttf'
    if (!fs.existsSync(rPath)) fs.writeFileSync(rPath, Buffer.from(FONT_REGULAR_B64, 'base64'))
    if (!fs.existsSync(bPath)) fs.writeFileSync(bPath, Buffer.from(FONT_BOLD_B64, 'base64'))
    GlobalFonts.registerFromPath(rPath, 'CardSerif')
    GlobalFonts.registerFromPath(bPath, 'CardSerif')
    fontsReady = true
    console.log('[card-generator] CardSerif fonts ready')
  } catch (e) {
    console.error('[card-generator] Font init failed:', e)
  }
}

// ─── Full Name — gap between the two decorative horizontal dividers ───────────
const NAME_X_RATIO  = 0.56
const NAME_Y_RATIO  = 0.590
const NAME_FONT_MAX = 36
const NAME_COLOR    = '#000000'   // solid black — visible on any background

// ─── ID Code — top-left of content area, level with top of presidential seal ─
const ID_X_RATIO = 0.12
const ID_Y_RATIO = 0.030
const ID_FONT    = 'normal 28px CardSerif, serif'
const ID_COLOR   = '#000000'      // solid black

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
  ensureFonts()

  const imagePath = path.join(process.cwd(), 'public', 'invitation-card.png')
  if (!fs.existsSync(imagePath)) {
    throw new Error('invitation-card.png not found in /public')
  }

  const img    = await loadImage(fs.readFileSync(imagePath))
  const canvas = createCanvas(img.width, img.height)
  const ctx    = canvas.getContext('2d')

  ctx.drawImage(img, 0, 0)

  // ── ID Code (top-left, level with presidential seal) ──────────────────────
  if (idCode) {
    ctx.font         = ID_FONT
    ctx.fillStyle    = ID_COLOR
    ctx.textAlign    = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(idCode, img.width * ID_X_RATIO, img.height * ID_Y_RATIO)
  }

  // ── Full Name (centre, between the decorative dividers) ───────────────────
  const displayName = stripNumberPrefix(name)
  const maxWidth    = img.width * 0.70
  let   fontSize    = NAME_FONT_MAX
  const fontStack   = 'CardSerif, serif'

  ctx.font = `bold ${fontSize}px ${fontStack}`
  while (ctx.measureText(displayName).width > maxWidth && fontSize > 16) {
    fontSize -= 2
    ctx.font = `bold ${fontSize}px ${fontStack}`
  }

  ctx.fillStyle    = NAME_COLOR
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(displayName, img.width * NAME_X_RATIO, img.height * NAME_Y_RATIO)

  return canvas.toBuffer('image/png')
}
