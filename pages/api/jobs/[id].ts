import type { NextApiRequest, NextApiResponse } from 'next'
import { redis } from '@/lib/redis'
import { type EmailJob, JOB_TTL } from '@/lib/email-job'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query as { id: string }

  if (req.method === 'DELETE') {
    const job = await redis.get<EmailJob>(`job:${id}`)
    if (!job) return res.status(404).json({ error: 'Job not found' })

    job.status      = 'cancelled'
    job.completedAt = new Date().toISOString()
    await redis.set(`job:${id}`, job, { ex: JOB_TTL })

    const activeId = await redis.get<string>('job:active')
    if (activeId === id) await redis.del('job:active')

    return res.json({ ok: true })
  }

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const job = await redis.get<EmailJob>(`job:${id}`)
  if (!job) return res.status(404).json({ error: 'Not found' })

  const { recipients, ...rest } = job
  return res.json({ ...rest, recipientCount: recipients.length })
}
