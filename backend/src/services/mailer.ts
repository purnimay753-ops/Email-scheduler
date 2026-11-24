import nodemailer, { type Transporter } from 'nodemailer'
import type { Sender } from '@prisma/client'
import { config } from '../config'
import { prisma } from '../db/prisma'

const transporters = new Map<string, Transporter>()

function transporterFor(sender: Sender): Transporter {
  const cached = transporters.get(sender.id)
  if (cached) return cached
  const created = nodemailer.createTransport({
    host: sender.smtpHost,
    port: sender.smtpPort,
    secure: sender.smtpPort === 465,
    auth: {
      user: sender.smtpUser,
      pass: sender.smtpPass,
    },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
  })
  transporters.set(sender.id, created)
  return created
}

export async function sendWithSender(
  sender: Sender,
  message: { to: string; subject: string; text: string },
): Promise<{ messageId: string; previewUrl: string | null }> {
  const info = await transporterFor(sender).sendMail({
    from: `"${config.smtpFromName}" <${sender.email}>`,
    to: message.to,
    subject: message.subject,
    text: message.text,
  })

  const preview = nodemailer.getTestMessageUrl(info)
  return {
    messageId: info.messageId,
    previewUrl: typeof preview === 'string' ? preview : null,
  }
}

export async function provisionEtherealSenders(userId: string, count: number) {
  const created = []
  for (let index = 0; index < count; index += 1) {
    const account = await nodemailer.createTestAccount()
    const sender = await prisma.sender.upsert({
      where: { userId_email: { userId, email: account.user } },
      update: {
        smtpHost: account.smtp.host,
        smtpPort: account.smtp.port,
        smtpUser: account.user,
        smtpPass: account.pass,
      },
      create: {
        userId,
        email: account.user,
        smtpHost: account.smtp.host,
        smtpPort: account.smtp.port,
        smtpUser: account.user,
        smtpPass: account.pass,
      },
      select: { id: true, email: true, smtpHost: true, smtpPort: true, createdAt: true },
    })
    created.push(sender)
  }
  return created
}
