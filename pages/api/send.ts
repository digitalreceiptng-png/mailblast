import type { NextApiRequest, NextApiResponse } from 'next'
import { sendMail } from '@/lib/mailer'
import { mergeTemplate, textToHtml } from '@/lib/merge'
import { generateInvitationCard } from '@/lib/card-generator'

export type SendPayload = {
  to: string
  row: Record<string, string>
  subject: string
  body: string
  senderName?: string
  secret?: string
  attachCard?: boolean
  cardNameField?: string
  cardIdField?: string
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

  const appSecret = process.env.APP_SECRET
  if (appSecret) {
    const { secret } = req.body as SendPayload
    if (secret !== appSecret) {
      return res.status(401).json({ ok: false, to: '', error: 'Unauthorized' })
    }
  }

  const { to, row, subject, body, senderName, attachCard, cardNameField, cardIdField } =
    req.body as SendPayload

  if (!to || !subject || !body) {
    return res.status(400).json({ ok: false, to: to || '', error: 'Missing required fields' })
  }

  try {
    const mergedSubject = mergeTemplate(subject, row)
    const mergedBody    = mergeTemplate(body, row)
    let   html          = textToHtml(mergedBody)
    let   attachments: Parameters<typeof sendMail>[0]['attachments'] = undefined

    if (attachCard) {
      const field        = cardNameField || 'Full Name'
      const idField      = cardIdField   || 'ID Code'
      const displayName  = row[field] || row['Full Name'] || row.name || to
      const idCode       = row[idField]  || row['ID Code']  || ''
      const cardBuffer   = await generateInvitationCard(displayName, idCode)

      attachments = [
        {
          filename: 'invitation.png',
          content: cardBuffer,
          cid: 'invitation-card',
          contentDisposition: 'inline',
        },
      ]

      // Append inline card image after the email body text
      html += '<div style="margin-top:28px;"><img src="cid:invitation-card" style="max-width:100%;display:block;" /></div>'
    }

    await sendMail({ to, subject: mergedSubject, html, text: mergedBody, from: senderName, attachments })

    return res.status(200).json({ ok: true, to })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`Failed to send to ${to}:`, message)
    return res.status(500).json({ ok: false, to, error: message })
  }
}
