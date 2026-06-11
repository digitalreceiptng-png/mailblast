import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas'
import path from 'path'

// Card layout constants
const NAME_X_RATIO         = 0.56   // horizontal centre of name
const NAME_Y_RATIO         = 0.590  // vertical centre — gap between decorative dividers
const NAME_MAX_WIDTH_RATIO = 0.70
const NAME_FONT_MAX        = 36

const ID_X_RATIO   = 0.155  // just past the ~145px dark green sidebar
const ID_Y_RATIO   = 0.060  // level with the presidential seal
const ID_FONT_SIZE = 26

const CARD_W = 1127
const CARD_H = 1600

let fontsReady = false

function ensureFonts() {
  if (fontsReady) return
  const dir = path.join(process.cwd(), 'public', 'fonts')
  GlobalFonts.registerFromPath(path.join(dir, 'NotoSerif-Regular.ttf'), 'CardSerifReg')
  GlobalFonts.registerFromPath(path.join(dir, 'NotoSerif-Bold.ttf'),    'CardSerifBold')
  fontsReady = true
}

function stripNumberPrefix(raw: string): string {
  let s = raw.trim()
  while (/^\d+\.\s+/.test(s)) s = s.replace(/^\d+\.\s+/, '').trim()
  return s
}

// Approximate font-size that fits text within maxWidth (serif ~0.55× char width)
function fitFontSize(text: string, maxWidth: number, maxSize: number): number {
  let size = maxSize
  while (size > 14 && text.length * size * 0.55 > maxWidth) size -= 2
  return size
}

export async function generateInvitationCard(name: string, idCode = ''): Promise<Buffer> {
  ensureFonts()

  const displayName = stripNumberPrefix(name)
  const maxWidth    = CARD_W * NAME_MAX_WIDTH_RATIO
  const fontSize    = fitFontSize(displayName, maxWidth, NAME_FONT_MAX)

  const canvas = createCanvas(CARD_W, CARD_H)
  const ctx    = canvas.getContext('2d')

  // Draw the base invitation card
  const bgPath = path.join(process.cwd(), 'public', 'invitation-card.png')
  const bg     = await loadImage(bgPath)
  ctx.drawImage(bg, 0, 0, CARD_W, CARD_H)

  ctx.fillStyle = '#000000'

  // ID code — top-left of the white content area
  if (idCode) {
    ctx.font      = `${ID_FONT_SIZE}px 'CardSerifReg'`
    ctx.textAlign = 'left'
    ctx.fillText(
      idCode,
      Math.round(CARD_W * ID_X_RATIO),
      Math.round(CARD_H * ID_Y_RATIO) + ID_FONT_SIZE,
    )
  }

  // Recipient name — centred between the decorative dividers
  ctx.font      = `${fontSize}px 'CardSerifBold'`
  ctx.textAlign = 'center'
  ctx.fillText(
    displayName,
    Math.round(CARD_W * NAME_X_RATIO),
    Math.round(CARD_H * NAME_Y_RATIO) + Math.round(fontSize / 2),
  )

  return canvas.toBuffer('image/png')
}
