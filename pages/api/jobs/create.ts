import type { NextApiRequest, NextApiResponse } from 'next'
import { redis } from '@/lib/redis'
import { type EmailJob, BATCH_SIZE, JOB_TTL } from '@/lib/email-job'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { recipients, subject, body, senderName, attachCard, cardNameField, cardIdField } = req.body

  if (!Array.isArray(recipients) || !recipients.length || !subject || !body) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const id = crypto.randomUUID()
  const job: EmailJob = {
    id,
    status:        'pending',
    recipients,
    currentIndex:  0,
    totalCount:    recipients.length,
    batchSize:     BATCH_SIZE,
    subject,
    body,
    senderName:    senderName || '',
    attachCard:    !!attachCard,
    cardNameField: cardNameField || 'Full Name',
    cardIdField:   cardIdField   || 'ID Code',
    createdAt:     new Date().toISOString(),
    lastRunAt:     null,
    completedAt:   null,
    sentCount:     0,
    failedCount:   0,
    errors:        [],
  }

  await redis.set(`job:${id}`, job, { ex: JOB_TTL })
  await redis.set('job:active', id, { ex: JOB_TTL })

  return res.status(200).json({ id })
}
