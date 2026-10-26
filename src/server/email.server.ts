import nodemailer from 'nodemailer'

export type Mail = {
  to: string
  subject: string
  text: string
  // The address that turns this kind of email off; sent as the List-Unsubscribe header too.
  unsubscribe?: string
  attachments?: { filename: string; content: Buffer; contentType: string }[]
}
export type Send = (mail: Mail) => Promise<void>

// SMTP_URL (smtp://user:password@host:port) and MAIL_FROM are read at send time. Unset, every send fails and the
// delivery job records it, so nothing pretends to be sent.
export const sendMail: Send = async (mail) => {
  const url = process.env.SMTP_URL
  const from = process.env.MAIL_FROM
  if (!url || !from)
    throw Object.assign(new Error('not set'), { code: 'SMTP_NOT_SET' })
  const transport = nodemailer.createTransport(url)
  try {
    await transport.sendMail({
      from,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      attachments: mail.attachments,
      headers: mail.unsubscribe
        ? {
            'List-Unsubscribe': `<${mail.unsubscribe}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          }
        : undefined,
    })
  } finally {
    transport.close()
  }
}
