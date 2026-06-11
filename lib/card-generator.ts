import React from 'react'
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import sharp from 'sharp'
import path from 'path'
import { FONT_REGULAR_B64, FONT_BOLD_B64 } from './font-data'

// Card layout constants (ratios confirmed by pixel-grid analysis)
const NAME_X_RATIO         = 0.56   // horizontal centre of name text
const NAME_Y_RATIO         = 0.590  // vertical centre — gap between decorative dividers
const NAME_MAX_WIDTH_RATIO = 0.70
const NAME_FONT_MAX        = 36

const ID_X_RATIO   = 0.12
const ID_Y_RATIO   = 0.030
const ID_FONT_SIZE = 28

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

  // Build element tree with React.createElement for correct TypeScript types.
  // satori renders this to SVG entirely in JS — no system font lookup needed.
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

  // Step 1 — satori generates a transparent SVG with only the text elements.
  const textSvg = await satori(element, {
    width: CARD_W,
    height: CARD_H,
    fonts: [
      { name: 'CardSerif', data: regular, weight: 400, style: 'normal' },
      { name: 'CardSerif', data: bold,    weight: 700, style: 'normal' },
    ],
  })

  // Step 2 — resvg-js (pure WASM) renders the SVG to a transparent PNG buffer.
  const resvg   = new Resvg(textSvg, { fitTo: { mode: 'width', value: CARD_W } })
  const textPng = Buffer.from(resvg.render().asPng())

  // Step 3 — sharp composites the transparent text layer over the card image.
  const imagePath = path.join(process.cwd(), 'public', 'invitation-card.png')
  return sharp(imagePath)
    .composite([{ input: textPng, top: 0, left: 0 }])
    .png()
    .toBuffer()
}
