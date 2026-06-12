import nodemailer from 'nodemailer'

export const transporter = nodemailer.createTransport({
  host: 'smtp.zoho.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.ZOHO_USER,
    pass: process.env.ZOHO_PASS,
  },
  connectionTimeout: 15_000,   // 15s to establish connection
  greetingTimeout:   10_000,   // 10s for SMTP greeting
  socketTimeout:     20_000,   // 20s for any socket inactivity
})

export async function sendMail({
  to,
  subject,
  html,
  text,
  from,
  attachments,
}: {
  to: string
  subject: string
  html: string
  text: string
  from?: string
  attachments?: nodemailer.SendMailOptions['attachments']
}) {
  const senderName = process.env.SENDER_NAME || 'MailBlast'
  const fromAddress = process.env.ZOHO_USER!

  return transporter.sendMail({
    from: `"${from || senderName}" <${fromAddress}>`,
    to,
    subject,
    html,
    text,
    attachments,
  })
}
