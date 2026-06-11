import type { NextApiRequest, NextApiResponse } from 'next'

// Dynamic import so a module-load failure is caught here, not at compile time,
// and we can always return JSON rather than Next.js's HTML error page.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const name   = String(req.query.name   || 'Guest').slice(0, 120)
  const idCode = String(req.query.idCode || '').slice(0, 20)

  try {
    const { generateInvitationCard } = await import('@/lib/card-generator')
    const buffer = await generateInvitationCard(name, idCode)
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'no-store')
    res.send(buffer)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[generate-card]', message)
    res.status(500).json({ error: message })
  }
}
