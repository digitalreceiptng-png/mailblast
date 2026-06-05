import type { NextApiRequest, NextApiResponse } from 'next'
import { sendMail } from '@/lib/mailer'
import { mergeTemplate, textToHtml } from '@/lib/merge'

export type SendPayload = {
  to: string
  row: Record<string, string>
  subject: string
  body: string
  senderName?: string
  secret?: string
}

export type SendResult = {
  ok: boolean
  to: string
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SendResult>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, to: '', error: 'Method not allowed' })
  }

  // Optional secret check
  const appSecret = process.env.APP_SECRET
  if (appSecret) {
    const { secret } = req.body as SendPayload
    if (secret !== appSecret) {
      return res.status(401).json({ ok: false, to: '', error: 'Unauthorized' })
    }
  }

  const { to, row, subject, body, senderName } = req.body as SendPayload

  if (!to || !subject || !body) {
    return res.status(400).json({ ok: false, to: to || '', error: 'Missing required fields' })
  }

  try {
    const mergedSubject = mergeTemplate(subject, row)
    const mergedBody = mergeTemplate(body, row)
    const html = textToHtml(mergedBody)

    await sendMail({
      to,
      subject: mergedSubject,
      html,
      text: mergedBody,
      from: senderName,
    })

    return res.status(200).json({ ok: true, to })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`Failed to send to ${to}:`, message)
    return res.status(500).json({ ok: false, to, error: message })
  }
}
