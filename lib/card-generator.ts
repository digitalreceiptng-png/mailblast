import sharp from 'sharp'
import path from 'path'
import { FONT_REGULAR_B64, FONT_BOLD_B64 } from './font-data'

// Card layout constants (pixel ratios confirmed by grid analysis)
const NAME_X_RATIO   = 0.56   // horizontal centre of name
const NAME_Y_RATIO   = 0.590  // vertical centre — gap between decorative dividers
const NAME_MAX_WIDTH_RATIO = 0.70
const NAME_FONT_MAX  = 36

const ID_X_RATIO  = 0.12
const ID_Y_RATIO  = 0.030
const ID_FONT_SIZE = 28

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function stripNumberPrefix(raw: string): string {
  let s = raw.trim()
  while (/^\d+\.\s+/.test(s)) s = s.replace(/^\d+\.\s+/, '').trim()
  return s
}

// Estimate font size so text fits within maxWidth (serif bold ~0.55× char width ratio)
function fitFontSize(text: string, maxWidth: number, maxSize: number): number {
  let size = maxSize
  while (size > 14 && text.length * size * 0.55 > maxWidth) size -= 2
  return size
}

export async function generateInvitationCard(name: string, idCode = ''): Promise<Buffer> {
  const imagePath = path.join(process.cwd(), 'public', 'invitation-card.png')

  const meta = await sharp(imagePath).metadata()
  const W = meta.width  ?? 1127
  const H = meta.height ?? 1600

  const displayName = stripNumberPrefix(name)
  const maxWidth    = W * NAME_MAX_WIDTH_RATIO
  const fontSize    = fitFontSize(displayName, maxWidth, NAME_FONT_MAX)

  const nameX = Math.round(W * NAME_X_RATIO)
  const nameY = Math.round(H * NAME_Y_RATIO)
  const idX   = Math.round(W * ID_X_RATIO)
  const idY   = Math.round(H * ID_Y_RATIO)

  // Embed both font weights as data URIs inside the SVG so no system font
  // is needed on the Lambda — works on any OS including Vercel's Amazon Linux.
  const svgOverlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <style>
      @font-face {
        font-family: 'CardSerif';
        font-weight: normal;
        src: url('data:font/truetype;base64,${FONT_REGULAR_B64}');
      }
      @font-face {
        font-family: 'CardSerif';
        font-weight: bold;
        src: url('data:font/truetype;base64,${FONT_BOLD_B64}');
      }
    </style>
  </defs>
  ${idCode
    ? `<text x="${idX}" y="${idY}"
         dominant-baseline="hanging"
         font-family="CardSerif, serif"
         font-size="${ID_FONT_SIZE}"
         fill="#000000"
       >${escapeXml(idCode)}</text>`
    : ''}
  <text x="${nameX}" y="${nameY}"
    text-anchor="middle"
    dominant-baseline="middle"
    font-family="CardSerif, serif"
    font-weight="bold"
    font-size="${fontSize}"
    fill="#000000"
  >${escapeXml(displayName)}</text>
</svg>`

  return sharp(imagePath)
    .composite([{ input: Buffer.from(svgOverlay), top: 0, left: 0 }])
    .png()
    .toBuffer()
}
