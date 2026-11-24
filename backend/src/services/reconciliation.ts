import type { Email } from '@prisma/client'
import { prisma } from '../db/prisma'
import { emailQueue, enqueueEmailJob } from '../queues/emailQueue'
import { logger } from '../utils/logger'
import { redis } from '../utils/redis'
import { config } from '../config'
import { indexEmail } from './search'

const ACTIVE_STATES = new Set(['active', 'waiting', 'delayed', 'waiting-children', 'prioritized', 'paused'])

async function repairRow(email: Email): Promise<void> {
  if (email.messageId) {
    const sent = await prisma.email.update({
      where: { id: email.id },
      data: { status: 'sent', sentAt: email.sentAt ?? new Date() },
    })
    await indexEmail(sent)
    return
  }

  const job = await emailQueue.getJob(email.id)
  if (job) {
    const state = await job.getState()
    if (ACTIVE_STATES.has(state)) return
    await job.remove()
  }

  const scheduled =
    email.status === 'scheduled'
      ? email
      : await prisma.email.update({
          where: { id: email.id },
          data: { status: 'scheduled' },
        })

  await enqueueEmailJob(scheduled.id, scheduled.scheduledAt)
}

export async function reconcileScheduledEmails(): Promise<void> {
  const lock = await redis.set('lock:reconcile', '1', 'PX', 120_000, 'NX')
  if (lock !== 'OK') {
    logger.info('reconciliation skipped; another process holds the lock')
    return
  }

  try {
    let cursor: string | undefined
    let repaired = 0

    for (;;) {
      const rows = await prisma.email.findMany({
        where: { status: { in: ['scheduled', 'processing'] } },
        orderBy: { id: 'asc' },
        take: 200,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      })
      if (rows.length === 0) break

      for (const row of rows) {
        const age = Date.now() - row.updatedAt.getTime()
        if (row.status === 'processing' && !row.messageId && age < config.staleProcessingMs) {
          const job = await emailQueue.getJob(row.id)
          const state = job ? await job.getState() : null
          if (state && ACTIVE_STATES.has(state)) continue
          if (!job && age < 15_000) continue
        }
        await repairRow(row)
        repaired += 1
      }

      cursor = rows[rows.length - 1]?.id
      if (rows.length < 200) break
    }

    logger.info({ repaired }, 'reconciliation finished')
  } finally {
    await redis.del('lock:reconcile')
  }
}
