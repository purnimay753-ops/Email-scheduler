import 'dotenv/config'
import { prisma } from './db/prisma'
import { emailQueue } from './queues/emailQueue'
import { reconcileScheduledEmails } from './services/reconciliation'
import { ensureEmailIndex } from './services/search'
import { logger } from './utils/logger'
import { redis } from './utils/redis'
import { startEmailWorker } from './workers/emailWorker'

async function main(): Promise<void> {
  await ensureEmailIndex()
  try {
    await reconcileScheduledEmails()
  } catch (error) {
    logger.error({ err: error }, 'reconciliation failed during worker boot')
  }

  const worker = startEmailWorker()
  logger.info('email worker started')

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'worker shutting down')
    await worker.close()
    await emailQueue.close()
    await prisma.$disconnect()
    redis.disconnect()
    process.exit(0)
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
}

main().catch((error) => {
  logger.error({ err: error }, 'worker failed to start')
  process.exit(1)
})
