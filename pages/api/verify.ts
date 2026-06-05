import type { NextApiRequest, NextApiResponse } from 'next'
import { transporter } from '@/lib/mailer'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') return res.status(405).end()

  try {
    await transporter.verify()
    res.status(200).json({ ok: true, user: process.env.ZOHO_USER })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ ok: false, error: message })
  }
}
