import type { NextApiRequest, NextApiResponse } from 'next'
import { generateInvitationCard } from '@/lib/card-generator'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const name = String(req.query.name || 'Guest').slice(0, 120)

  try {
    const buffer = await generateInvitationCard(name)
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'no-store')
    res.send(buffer)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate card'
    res.status(500).json({ error: message })
  }
}
