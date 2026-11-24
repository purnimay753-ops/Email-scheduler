import { randomUUID } from 'crypto'
import { config } from '../config'
import { prisma } from '../db/prisma'
import { HttpError } from '../utils/errors'
import { parseEmailList } from '../utils/email'
import { logger } from '../utils/logger'
import { enqueueEmailJobs } from '../queues/emailQueue'
import { indexEmails } from './search'

export type ScheduleInput = {
  subject: string
  body: string
  startTime: string
  delayBetweenMs: number
  hourlyLimit: number
  recipients?: string[]
  csvText?: string
}

export async function scheduleCampaign(userId: string, input: ScheduleInput) {
  const start = new Date(input.startTime)
  if (Number.isNaN(start.getTime())) {
    throw new HttpError(400, 'startTime must be a valid date')
  }

  const fromList = input.recipients ? parseEmailList(input.recipients.join('\n')) : []
  const fromCsv = input.csvText ? parseEmailList(input.csvText) : []
  const recipients = parseEmailList([...fromList, ...fromCsv].join('\n'))

  if (recipients.length === 0) {
    throw new HttpError(400, 'No valid email addresses were found')
  }
  if (recipients.length > config.maxRecipientsPerCampaign) {
    throw new HttpError(400, `A campaign can include at most ${config.maxRecipientsPerCampaign} recipients`)
  }

  const senders = await prisma.sender.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  })
  if (senders.length === 0) {
    throw new HttpError(400, 'Create at least one Ethereal sender before scheduling')
  }

  const campaignId = randomUUID()
  const rows = recipients.map((toEmail, index) => ({
    id: randomUUID(),
    campaignId,
    userId,
    senderId: senders[index % senders.length].id,
    toEmail,
    subject: input.subject,
    body: input.body,
    scheduledAt: new Date(start.getTime() + index * input.delayBetweenMs),
    status: 'scheduled' as const,
  }))

  const created = await prisma.$transaction(
    async (tx) => {
      const campaign = await tx.campaign.create({
        data: {
          id: campaignId,
          userId,
          subject: input.subject,
          body: input.body,
          startTime: start,
          delayBetweenMs: input.delayBetweenMs,
          hourlyLimit: input.hourlyLimit,
        },
      })

      const chunkSize = 400
      for (let index = 0; index < rows.length; index += chunkSize) {
        await tx.email.createMany({ data: rows.slice(index, index + chunkSize) })
      }

      return campaign
    },
    { timeout: 30_000 },
  )

  const emails = await prisma.email.findMany({ where: { campaignId } })
  let queued = 0
  try {
    queued = await enqueueEmailJobs(emails.map((email) => ({ id: email.id, scheduledAt: email.scheduledAt })))
  } catch (error) {
    logger.error({ err: error, campaignId }, 'failed to enqueue some email jobs; reconciliation will repair them')
  }

  await indexEmails(emails)

  return {
    campaign: {
      id: created.id,
      subject: created.subject,
      startTime: created.startTime,
      delayBetweenMs: created.delayBetweenMs,
      hourlyLimit: created.hourlyLimit,
      emailCount: emails.length,
    },
    emailsQueued: queued,
  }
}
