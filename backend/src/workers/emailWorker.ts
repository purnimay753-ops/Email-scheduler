import { DelayedError, UnrecoverableError, Worker, type Job } from 'bullmq'
import type { Email, Sender } from '@prisma/client'
import { config } from '../config'
import { prisma } from '../db/prisma'
import { EMAIL_QUEUE_NAME, type SendEmailJob } from '../queues/emailQueue'
import { createRedis } from '../utils/redis'
import { logger } from '../utils/logger'
import { overflowDelayMs } from '../utils/scheduleMath'
import { sendWithSender } from '../services/mailer'
import { acquireSendSlot, releaseSendSlot, reserveSenderGap, type RateAcquireResult } from '../services/rateLimiter'
import { indexEmail } from '../services/search'
import { notifyRateLimit } from '../services/slack'

type LoadedEmail = Email & { sender: Sender; campaign: { hourlyLimit: number; delayBetweenMs: number } }

function isLastAttempt(job: Job): boolean {
  const attempts = job.opts.attempts ?? 1
  return job.attemptsMade + 1 >= attempts
}

async function delayJob(job: Job<SendEmailJob>, token: string, delayMs: number): Promise<never> {
  await job.moveToDelayed(Date.now() + delayMs, token)
  throw new DelayedError()
}

async function loadEmail(emailId: string): Promise<LoadedEmail | null> {
  return prisma.email.findUnique({
    where: { id: emailId },
    include: { sender: true, campaign: { select: { hourlyLimit: true, delayBetweenMs: true } } },
  })
}

async function markSentIfDelivered(email: LoadedEmail): Promise<boolean> {
  if (!email.messageId && email.status !== 'sent') return false
  if (email.status !== 'sent') {
    const sent = await prisma.email.update({
      where: { id: email.id },
      data: { status: 'sent', sentAt: email.sentAt ?? new Date() },
    })
    await indexEmail(sent)
  }
  return true
}

async function processEmail(job: Job<SendEmailJob>, token?: string): Promise<void> {
  if (!token) throw new Error('Missing BullMQ lock token')

  const current = await loadEmail(job.data.emailId)
  if (!current || current.status === 'failed') return
  if (await markSentIfDelivered(current)) return

  const waitMs = await reserveSenderGap(current.senderId)
  if (waitMs > 0) {
    if (waitMs > 1000) {
      const updated = await prisma.email.update({
        where: { id: current.id },
        data: { scheduledAt: new Date(Date.now() + waitMs) },
      })
      await indexEmail(updated)
    }
    await delayJob(job, token, waitMs)
  }

  const decision = await acquireSendSlot({
    senderId: current.senderId,
    campaignId: current.campaignId,
    campaignHourlyLimit: current.campaign.hourlyLimit,
  })

  if (!decision.ok) {
    const spacing = Math.max(config.minDelayBetweenEmailsMs, current.campaign.delayBetweenMs)
    const delayMs = overflowDelayMs(decision.position, spacing)
    const scheduledAt = new Date(Date.now() + delayMs)
    const updated = await prisma.email.update({
      where: { id: current.id },
      data: { scheduledAt, status: 'scheduled' },
    })
    await indexEmail(updated)
    const limit = decision.reason === 'sender' ? decision.senderLimit : decision.campaignLimit
    await notifyRateLimit({
      userId: current.userId,
      senderId: current.senderId,
      senderEmail: current.sender.email,
      campaignId: current.campaignId,
      limit,
      window: decision.window,
      reason: decision.reason,
      resumeAt: new Date(Date.now() + overflowDelayMs(1, 0)),
    })
    await delayJob(job, token, delayMs)
  }

  if (!decision.ok) return

  await maybeNotifyLimitReached(current, decision)

  let email = current
  if (email.status === 'scheduled') {
    const claimed = await prisma.email.updateMany({
      where: { id: email.id, status: 'scheduled' },
      data: { status: 'processing', attempts: { increment: 1 } },
    })
    if (claimed.count !== 1) {
      const reloaded = await loadEmail(email.id)
      if (!reloaded || (await markSentIfDelivered(reloaded)) || reloaded.status !== 'processing') {
        await releaseSendSlot({ senderId: current.senderId, campaignId: current.campaignId, window: decision.window })
        return
      }
      email = reloaded
    }
  }

  try {
    const delivery = await sendWithSender(email.sender, {
      to: email.toEmail,
      subject: email.subject,
      text: email.body,
    })

    await prisma.email.update({
      where: { id: email.id },
      data: { messageId: delivery.messageId, previewUrl: delivery.previewUrl },
    })

    const sent = await prisma.email.update({
      where: { id: email.id },
      data: { status: 'sent', sentAt: new Date(), error: null },
    })
    await indexEmail(sent)
  } catch (error) {
    if (error instanceof DelayedError) throw error
    await releaseSendSlot({ senderId: email.senderId, campaignId: email.campaignId, window: decision.window })
    const message = error instanceof Error ? error.message : 'SMTP send failed'

    if (isLastAttempt(job)) {
      const failed = await prisma.email.update({
        where: { id: email.id },
        data: { status: 'failed', error: message },
      })
      await indexEmail(failed)
      throw new UnrecoverableError(message)
    }

    await prisma.email.update({
      where: { id: email.id },
      data: { status: 'scheduled', error: message },
    })
    throw error
  }
}

async function maybeNotifyLimitReached(email: LoadedEmail, decision: RateAcquireResult): Promise<void> {
  if (!decision.ok) return
  const senderFull = decision.senderCount === decision.senderLimit
  const campaignFull = decision.campaignCount === decision.campaignLimit
  if (!senderFull && !campaignFull) return

  const reason = senderFull ? 'sender' : 'campaign'
  await notifyRateLimit({
    userId: email.userId,
    senderId: email.senderId,
    senderEmail: email.sender.email,
    campaignId: email.campaignId,
    limit: reason === 'sender' ? decision.senderLimit : decision.campaignLimit,
    window: decision.window,
    reason,
    resumeAt: new Date(Date.now() + overflowDelayMs(1, 0)),
  })
}

export function startEmailWorker(): Worker<SendEmailJob> {
  const worker = new Worker<SendEmailJob>(EMAIL_QUEUE_NAME, processEmail, {
    connection: createRedis(),
    concurrency: config.workerConcurrency,
  })

  worker.on('failed', (job, error) => {
    if (error?.name === 'DelayedError') return
    logger.error({ err: error, jobId: job?.id }, 'email job failed')
  })

  worker.on('error', (error) => {
    logger.error({ err: error }, 'email worker error')
  })

  return worker
}
