import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'
import { MulterError } from 'multer'
import { HttpError } from '../utils/errors'
import { logger } from '../utils/logger'

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation failed',
      details: err.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    })
    return
  }

  if (err instanceof MulterError) {
    res.status(400).json({ error: err.message })
    return
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message })
    return
  }

  logger.error({ err }, 'unhandled error')
  res.status(500).json({ error: 'Internal server error' })
}
