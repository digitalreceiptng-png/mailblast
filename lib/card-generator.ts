import React from 'react'
import satori from 'satori'
import sharp from 'sharp'
import path from 'path'
import { FONT_REGULAR_B64, FONT_BOLD_B64 } from './font-data'

// Card layout constants (ratios confirmed by pixel-grid analysis)
const NAME_X_RATIO         = 0.56   // horizontal centre of name text
const NAME_Y_RATIO         = 0.590  // vertical centre — gap between decorative dividers
const NAME_MAX_WIDTH_RATIO = 0.70
const NAME_FONT_MAX        = 36

const ID_X_RATIO   = 0.155  // just past the green sidebar (~145px) into the white area
const ID_Y_RATIO   = 0.060  // level with the presidential seal
const ID_FONT_SIZE = 26

const CARD_W = 1127
const CARD_H = 1600

function stripNumberPrefix(raw: string): string {
  let s = raw.trim()
  while (/^\d+\.\s+/.test(s)) s = s.replace(/^\d+\.\s+/, '').trim()
  return s
}

// Approximate font-size that keeps text within maxWidth (serif bold ≈ 0.55× char width)
function fitFontSize(text: string, maxWidth: number, maxSize: number): number {
  let size = maxSize
  while (size > 14 && text.length * size * 0.55 > maxWidth) size -= 2
  return size
}

// Cache decoded font buffers (decoded once per Lambda instance)
let fontRegularBuf: ArrayBuffer | null = null
let fontBoldBuf:    ArrayBuffer | null = null
function getFontBuffers(): { regular: ArrayBuffer; bold: ArrayBuffer } {
  if (!fontRegularBuf) fontRegularBuf = Buffer.from(FONT_REGULAR_B64, 'base64').buffer as ArrayBuffer
  if (!fontBoldBuf)   fontBoldBuf    = Buffer.from(FONT_BOLD_B64,    'base64').buffer as ArrayBuffer
  return { regular: fontRegularBuf, bold: fontBoldBuf }
}

export async function generateInvitationCard(name: string, idCode = ''): Promise<Buffer> {
  const displayName = stripNumberPrefix(name)
  const maxWidth    = CARD_W * NAME_MAX_WIDTH_RATIO
  const fontSize    = fitFontSize(displayName, maxWidth, NAME_FONT_MAX)

  const nameLeft = Math.round(CARD_W * NAME_X_RATIO - maxWidth / 2)
  const nameTop  = Math.round(CARD_H * NAME_Y_RATIO - fontSize / 2)
  const idLeft   = Math.round(CARD_W * ID_X_RATIO)
  const idTop    = Math.round(CARD_H * ID_Y_RATIO)

  const { regular, bold } = getFontBuffers()

  // satori converts text to SVG <path> elements — no font name survives into
  // the output SVG, so sharp's librsvg has nothing font-related to resolve.
  const children: React.ReactNode[] = []

  if (idCode) {
    children.push(
      React.createElement('div', {
        key: 'id',
        style: {
          position: 'absolute' as const,
          left: idLeft,
          top: idTop,
          fontFamily: 'CardSerif',
          fontWeight: 400,
          fontSize: ID_FONT_SIZE,
          color: '#000000',
          lineHeight: 1,
          whiteSpace: 'nowrap' as const,
        },
      }, idCode)
    )
  }

  children.push(
    React.createElement('div', {
      key: 'name',
      style: {
        position: 'absolute' as const,
        left: nameLeft,
        top: nameTop,
        width: Math.round(maxWidth),
        display: 'flex',
        justifyContent: 'center',
        fontFamily: 'CardSerif',
        fontWeight: 700,
        fontSize,
        color: '#000000',
        lineHeight: 1,
        whiteSpace: 'nowrap' as const,
      },
    }, displayName)
  )

  const element = React.createElement('div', {
    style: {
      width: CARD_W,
      height: CARD_H,
      display: 'flex',
      position: 'relative' as const,
    },
  }, ...children)

  const textSvg = await satori(element, {
    width: CARD_W,
    height: CARD_H,
    fonts: [
      { name: 'CardSerif', data: regular, weight: 400, style: 'normal' },
      { name: 'CardSerif', data: bold,    weight: 700, style: 'normal' },
    ],
  })

  // sharp can composite the path-only SVG directly — no system font needed.
  const imagePath = path.join(process.cwd(), 'public', 'invitation-card.png')
  return sharp(imagePath)
    .composite([{ input: Buffer.from(textSvg), top: 0, left: 0 }])
    .png()
    .toBuffer()
}
