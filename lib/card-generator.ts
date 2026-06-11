import React from 'react'
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import { PNG } from 'pngjs'
import * as jpeg from 'jpeg-js'
import { readFileSync } from 'fs'
import path from 'path'

// Card layout constants
const NAME_X_RATIO         = 0.56
const NAME_Y_RATIO         = 0.590
const NAME_MAX_WIDTH_RATIO = 0.70
const NAME_FONT_MAX        = 36

const ID_X_RATIO   = 0.205
const ID_Y_RATIO   = 0.060
const ID_FONT_SIZE = 26

const CARD_W = 1127
const CARD_H = 1600

// Cached per Lambda instance
let cardBgPng:      PNG         | null = null
let fontRegularBuf: ArrayBuffer | null = null
let fontBoldBuf:    ArrayBuffer | null = null

function assetDir(...parts: string[]) {
  return path.join(process.cwd(), 'public', ...parts)
}

function isJpeg(buf: Buffer): boolean {
  return buf[0] === 0xff && buf[1] === 0xd8
}

function getCardBackground(): PNG {
  if (!cardBgPng) {
    const raw = readFileSync(assetDir('invitation-card.png'))
    if (isJpeg(raw)) {
      const decoded = jpeg.decode(raw, { useTArray: false })
      const png = new PNG({ width: decoded.width, height: decoded.height, filterType: -1 })
      // jpeg-js returns RGBA data
      decoded.data.copy(png.data)
      cardBgPng = png
    } else {
      cardBgPng = PNG.sync.read(raw)
    }
  }
  return cardBgPng
}

function getFonts() {
  if (!fontRegularBuf) {
    fontRegularBuf = readFileSync(assetDir('fonts', 'NotoSerif-Regular.ttf')).buffer as ArrayBuffer
    fontBoldBuf    = readFileSync(assetDir('fonts', 'NotoSerif-Bold.ttf')).buffer    as ArrayBuffer
  }
  return { regular: fontRegularBuf!, bold: fontBoldBuf! }
}

function stripNumberPrefix(raw: string): string {
  let s = raw.trim()
  while (/^\d+\.\s+/.test(s)) s = s.replace(/^\d+\.\s+/, '').trim()
  return s
}

function fitFontSize(text: string, maxWidth: number, maxSize: number): number {
  let size = maxSize
  while (size > 14 && text.length * size * 0.55 > maxWidth) size -= 2
  return size
}

// Alpha-composite overlay onto bg in-place, returns a new PNG
function alphaComposite(bg: PNG, overlay: PNG): Buffer {
  const out = new PNG({ width: bg.width, height: bg.height, filterType: -1 })
  bg.data.copy(out.data)

  const w = Math.min(bg.width, overlay.width)
  const h = Math.min(bg.height, overlay.height)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const oi = (overlay.width * y + x) << 2
      const bi = (bg.width    * y + x) << 2
      const a  = overlay.data[oi + 3] / 255
      if (a > 0) {
        out.data[bi]     = Math.round(overlay.data[oi]     * a + bg.data[bi]     * (1 - a))
        out.data[bi + 1] = Math.round(overlay.data[oi + 1] * a + bg.data[bi + 1] * (1 - a))
        out.data[bi + 2] = Math.round(overlay.data[oi + 2] * a + bg.data[bi + 2] * (1 - a))
        out.data[bi + 3] = 255
      }
    }
  }

  return PNG.sync.write(out)
}

export async function generateInvitationCard(name: string, idCode = ''): Promise<Buffer> {
  const displayName = stripNumberPrefix(name)
  const maxWidth    = CARD_W * NAME_MAX_WIDTH_RATIO
  const fontSize    = fitFontSize(displayName, maxWidth, NAME_FONT_MAX)

  const nameLeft = Math.round(CARD_W * NAME_X_RATIO - maxWidth / 2)
  const nameTop  = Math.round(CARD_H * NAME_Y_RATIO - fontSize / 2)
  const idLeft   = Math.round(CARD_W * ID_X_RATIO)
  const idTop    = Math.round(CARD_H * ID_Y_RATIO)

  const { regular, bold } = getFonts()

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

  // Step 1 — render text-only SVG on transparent background
  const element = React.createElement('div', {
    style: {
      width: CARD_W,
      height: CARD_H,
      display: 'flex',
      position: 'relative' as const,
    },
  }, ...children)

  const svg = await satori(element, {
    width: CARD_W,
    height: CARD_H,
    fonts: [
      { name: 'CardSerif', data: regular, weight: 400, style: 'normal' },
      { name: 'CardSerif', data: bold,    weight: 700, style: 'normal' },
    ],
  })

  // Step 2 — convert text SVG to PNG (transparent bg)
  const textPngBuf = Buffer.from(
    new Resvg(svg, { fitTo: { mode: 'width', value: CARD_W } }).render().asPng()
  )

  // Step 3 — alpha-composite text over card background (pure JS, Vercel-safe)
  const bgPng      = getCardBackground()
  const overlayPng = PNG.sync.read(textPngBuf)

  return alphaComposite(bgPng, overlayPng)
}
