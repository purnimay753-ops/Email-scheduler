import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import pinoHttp from 'pino-http'
import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { ExpressAdapter } from '@bull-board/express'
import { config } from './config'
import { emailQueue } from './queues/emailQueue'
import { requireAuth } from './middleware/auth'
import { errorHandler } from './middleware/errorHandler'
import { asyncHandler } from './utils/asyncHandler'
import { logger } from './utils/logger'
import { authRouter } from './routes/auth'
import { apiRouter, slackCallbackRouter } from './routes/api'

export function createApp() {
  const app = express()

  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }))
  app.use(cors({ origin: config.frontendUrl, credentials: true }))
  app.use(cookieParser())
  app.use(express.json({ limit: '5mb' }))
  app.use(express.urlencoded({ extended: true }))
  app.use(pinoHttp({ logger }))

  app.get('/health', (_req, res) => {
    res.json({ ok: true })
  })

  const serverAdapter = new ExpressAdapter()
  serverAdapter.setBasePath('/admin/queues')
  createBullBoard({
    queues: [new BullMQAdapter(emailQueue)],
    serverAdapter,
  })

  app.use('/auth', authRouter)
  app.use('/api', slackCallbackRouter)
  app.use('/api', apiRouter)
  app.use('/admin/queues', asyncHandler(requireAuth), serverAdapter.getRouter())
  app.use(errorHandler)

  return app
}
