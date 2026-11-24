import type { Email, EmailStatus } from '@prisma/client'
import { prisma } from '../db/prisma'
import { HttpError } from '../utils/errors'

export type EmailView = {
  id: string
  toEmail: string
  subject: string
  scheduledAt: Date
  sentAt: Date | null
  status: EmailStatus
  error: string | null
  previewUrl: string | null
  attempts: number
}

export function toEmailView(email: Email): EmailView {
  return {
    id: email.id,
    toEmail: email.toEmail,
    subject: email.subject,
    scheduledAt: email.scheduledAt,
    sentAt: email.sentAt,
    status: email.status,
    error: email.error,
    previewUrl: email.previewUrl,
    attempts: email.attempts,
  }
}

export function statusFilter(status: string | undefined): EmailStatus | { in: EmailStatus[] } {
  if (status === 'scheduled') return 'scheduled'
  if (status === 'sent') return { in: ['sent', 'failed'] }
  throw new HttpError(400, 'status must be scheduled or sent')
}

export async function listEmails(input: {
  userId: string
  status: string | undefined
  page: number
  limit: number
}) {
  const where = { userId: input.userId, status: statusFilter(input.status) }
  const [total, rows] = await prisma.$transaction([
    prisma.email.count({ where }),
    prisma.email.findMany({
      where,
      orderBy: { scheduledAt: 'desc' },
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    }),
  ])

  return { data: rows.map(toEmailView), page: input.page, limit: input.limit, total }
}
