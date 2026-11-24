import { Queue } from 'bullmq'
import { config } from '../config'
import { createRedis } from '../utils/redis'

export const EMAIL_QUEUE_NAME = 'email-send'

export type SendEmailJob = {
  emailId: string
}

export const emailQueue = new Queue<SendEmailJob>(EMAIL_QUEUE_NAME, {
  connection: createRedis(),
  defaultJobOptions: {
    attempts: config.jobAttempts,
    backoff: { type: 'exponential', delay: config.jobBackoffMs },
    removeOnComplete: { age: 24 * 60 * 60, count: 5000 },
    removeOnFail: false,
  },
})

export async function enqueueEmailJob(emailId: string, scheduledAt: Date): Promise<void> {
  const delay = Math.max(0, scheduledAt.getTime() - Date.now())
  try {
    await emailQueue.add(
      'send-email',
      { emailId },
      {
        jobId: emailId,
        delay,
        attempts: config.jobAttempts,
        backoff: { type: 'exponential', delay: config.jobBackoffMs },
        removeOnComplete: { age: 24 * 60 * 60, count: 5000 },
        removeOnFail: false,
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/already exists|jobid/i.test(message)) return
    throw error
  }
}

export async function enqueueEmailJobs(rows: Array<{ id: string; scheduledAt: Date }>): Promise<number> {
  const chunkSize = 50
  let queued = 0
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize)
    await Promise.all(chunk.map((row) => enqueueEmailJob(row.id, row.scheduledAt)))
    queued += chunk.length
  }
  return queued
}
