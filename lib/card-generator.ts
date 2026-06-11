import { createCanvas, loadImage } from '@napi-rs/canvas'
import path from 'path'
import fs from 'fs'

// ─── Positioning ────────────────────────────────────────────────────────────
// Adjust these ratios to move the name text on the card.
// Open /public/invitation-card.png in an image editor, note pixel coords,
// then divide by the image width/height to get the ratios.
const NAME_X_RATIO = 0.56   // horizontal centre of the main content area
const NAME_Y_RATIO = 0.635  // just above the "TO" label section

const FONT_SIZE   = 36
const FONT_STYLE  = `bold ${FONT_SIZE}px Georgia, serif`
const FONT_COLOR  = '#1a5c2a'
// ────────────────────────────────────────────────────────────────────────────

export async function generateInvitationCard(name: string): Promise<Buffer> {
  const imagePath = path.join(process.cwd(), 'public', 'invitation-card.png')

  if (!fs.existsSync(imagePath)) {
    throw new Error(
      'Invitation card image not found. Place invitation-card.png in the /public folder.'
    )
  }

  const img = await loadImage(fs.readFileSync(imagePath))
  const canvas = createCanvas(img.width, img.height)
  const ctx = canvas.getContext('2d')

  ctx.drawImage(img, 0, 0)

  // Fit text: reduce font size if the name is too wide for the content area
  const maxWidth = img.width * 0.7
  let fontSize = FONT_SIZE
  ctx.font = `bold ${fontSize}px Georgia, serif`
  while (ctx.measureText(name).width > maxWidth && fontSize > 16) {
    fontSize -= 2
    ctx.font = `bold ${fontSize}px Georgia, serif`
  }

  ctx.fillStyle = FONT_COLOR
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(name, img.width * NAME_X_RATIO, img.height * NAME_Y_RATIO)

  return canvas.toBuffer('image/png')
}
