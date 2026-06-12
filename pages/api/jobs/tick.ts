import type { NextApiRequest, NextApiResponse } from 'next'
import { redis } from '@/lib/redis'
import { type EmailJob, JOB_TTL } from '@/lib/email-job'
import { sendMail } from '@/lib/mailer'
import { mergeTemplate, textToHtml } from '@/lib/merge'
import { generateInvitationCard } from '@/lib/card-generator'

export const config = { maxDuration: 300 }

// Stop processing 12s before Vercel's hard limit so Redis saves always finish
const VERCEL_HOBBY_LIMIT_MS = 60_000
const SAFETY_BUFFER_MS      = 12_000
const MAX_RUN_MS             = VERCEL_HOBBY_LIMIT_MS - SAFETY_BUFFER_MS  // 48s

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

  // Acquire lock — prevents duplicate execution if QStash retries
  const lockKey = `job:${jobId}:lock`
  const locked  = await redis.set(lockKey, '1', { nx: true, ex: 600 })
  if (!locked) return res.json({ message: 'Batch already in progress' })

  // Sent-address set — deduplication guard against any retry edge case
  const sentSetKey = `job:${jobId}:sent`

  const batchStart  = job.currentIndex
  let   batchSent   = 0
  const runStart    = Date.now()

  try {
    job.status    = 'running'
    job.lastRunAt = new Date().toISOString()

    const batch = job.recipients.slice(job.currentIndex, job.currentIndex + job.batchSize)

    for (const row of batch) {
      // Stop early if we're approaching the timeout — gives Redis saves room to finish
      if (Date.now() - runStart > MAX_RUN_MS) break

      const to = row.email || row.Email || row.EMAIL || ''
      if (!to) {
        job.currentIndex++
        job.failedCount++
        await redis.set(`job:${jobId}`, job, { ex: JOB_TTL })
        continue
      }

      // Dedup check — skip if already sent in a previous run
      const alreadySent = await redis.sismember(sentSetKey, to)
      if (alreadySent) {
        job.currentIndex++
        await redis.set(`job:${jobId}`, job, { ex: JOB_TTL })
        batchSent++
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
              filename:           'invitation.png',
              content:            cardBuffer,
              cid:                'invitation-card',
              contentDisposition: 'inline',
            }]
            html += '<div style="margin-top:28px;"><img src="cid:invitation-card" style="max-width:100%;display:block;" /></div>'
          } catch (cardErr) {
            console.error(`[tick] card gen failed for ${to}:`, cardErr)
          }
        }

        await sendMail({ to, subject: mergedSubject, html, text: mergedBody, from: job.senderName, attachments })

        // Mark sent in dedup set BEFORE updating the job index.
        // If we crash between these two saves, the dedup set prevents a re-send.
        await redis.sadd(sentSetKey, to)
        await redis.expire(sentSetKey, JOB_TTL)

        job.sentCount++
        batchSent++
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[tick] send failed for ${to}:`, message)
        job.failedCount++
        if (job.errors.length < 100) job.errors.push({ email: to, error: message })
      }

      job.currentIndex++
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
      elapsed:      Date.now() - runStart,
    })
  } finally {
    await redis.del(lockKey)
  }
}
