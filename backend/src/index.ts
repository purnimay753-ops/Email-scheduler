import 'dotenv/config'
import { createApp } from './app'
import { config } from './config'
import { prisma } from './db/prisma'
import { reconcileScheduledEmails } from './services/reconciliation'
import { ensureEmailIndex } from './services/search'
import { logger } from './utils/logger'
import { redis } from './utils/redis'

async function main(): Promise<void> {
  await ensureEmailIndex()
  try {
    await reconcileScheduledEmails()
  } catch (error) {
    logger.error({ err: error }, 'reconciliation failed during api boot')
  }

  const app = createApp()
  const server = app.listen(config.port, () => {
    logger.info({ port: config.port }, 'api listening')
  })

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'api shutting down')
    server.close()
    await prisma.$disconnect()
    redis.disconnect()
    process.exit(0)
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
}

main().catch((error) => {
  logger.error({ err: error }, 'api failed to start')
  process.exit(1)
})
