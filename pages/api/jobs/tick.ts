import type { NextApiRequest, NextApiResponse } from 'next'
import { redis } from '@/lib/redis'
import { type EmailJob, JOB_TTL } from '@/lib/email-job'
import { sendMail } from '@/lib/mailer'
import { mergeTemplate, textToHtml } from '@/lib/merge'
import { generateInvitationCard } from '@/lib/card-generator'

// Allow up to 300s (capped to 60s on Hobby plan, 300s on Pro)
export const config = { maxDuration: 300 }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const jobId = await redis.get<string>('job:active')
  if (!jobId) return res.json({ message: 'No active job' })

  const job = await redis.get<EmailJob>(`job:${jobId}`)
  if (!job) {
    await redis.del('job:active')
    return res.json({ message: 'Stale reference cleared' })
  }

  if (job.status === 'completed' || job.status === 'cancelled') {
    await redis.del('job:active')
    return res.json({ message: `Job already ${job.status}` })
  }

  // Acquire lock — prevents duplicate execution if cron fires early
  const lockKey = `job:${jobId}:lock`
  const locked  = await redis.set(lockKey, '1', { nx: true, ex: 600 })
  if (!locked) return res.json({ message: 'Batch already in progress' })

  const batchStart = job.currentIndex
  let batchSent    = 0

  try {
    job.status    = 'running'
    job.lastRunAt = new Date().toISOString()

    const batch = job.recipients.slice(job.currentIndex, job.currentIndex + job.batchSize)

    let cancelled = false
    for (const row of batch) {
      if (cancelled) break

      const to = row.email || row.Email || row.EMAIL || ''
      if (!to) {
        job.currentIndex++
        job.failedCount++
        await redis.set(`job:${jobId}`, job, { ex: JOB_TTL })
        continue
      }

      try {
        const mergedSubject = mergeTemplate(job.subject, row)
        const mergedBody    = mergeTemplate(job.body, row)
        let   html          = textToHtml(mergedBody)
        let   attachments: Parameters<typeof sendMail>[0]['attachments'] = undefined

        if (job.attachCard) {
          try {
            const displayName = row[job.cardNameField] || row['Full Name'] || row.name || to
            const idCode      = row[job.cardIdField]   || row['ID Code']   || ''
            const cardBuffer  = await generateInvitationCard(displayName, idCode)
            attachments = [{
              filename:            'invitation.png',
              content:             cardBuffer,
              cid:                 'invitation-card',
              contentDisposition:  'inline',
            }]
            html += '<div style="margin-top:28px;"><img src="cid:invitation-card" style="max-width:100%;display:block;" /></div>'
          } catch (cardErr) {
            console.error(`[tick] card gen failed for ${to}:`, cardErr)
          }
        }

        await sendMail({ to, subject: mergedSubject, html, text: mergedBody, from: job.senderName, attachments })
        job.sentCount++
        batchSent++
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[tick] send failed for ${to}:`, message)
        job.failedCount++
        if (job.errors.length < 100) job.errors.push({ email: to, error: message })
      }

      job.currentIndex++

      // Save progress after each email — survives a timeout mid-batch
      await redis.set(`job:${jobId}`, job, { ex: JOB_TTL })
    }

    if (job.currentIndex >= job.totalCount) {
      job.status      = 'completed'
      job.completedAt = new Date().toISOString()
      await redis.set(`job:${jobId}`, job, { ex: JOB_TTL })
      await redis.del('job:active')
    }

    return res.json({
      batchStart,
      batchSent,
      sentCount:    job.sentCount,
      failedCount:  job.failedCount,
      currentIndex: job.currentIndex,
      totalCount:   job.totalCount,
      status:       job.status,
    })
  } finally {
    await redis.del(lockKey)
  }
}
