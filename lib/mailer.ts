import nodemailer from 'nodemailer'

export const transporter = nodemailer.createTransport({
  host: 'smtp.zoho.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.ZOHO_USER,
    pass: process.env.ZOHO_PASS,
  },
})

export async function sendMail({
  to,
  subject,
  html,
  text,
  from,
}: {
  to: string
  subject: string
  html: string
  text: string
  from?: string
}) {
  const senderName = process.env.SENDER_NAME || 'MailBlast'
  const fromAddress = process.env.ZOHO_USER!

  return transporter.sendMail({
    from: `"${from || senderName}" <${fromAddress}>`,
    to,
    subject,
    html,
    text,
  })
}
