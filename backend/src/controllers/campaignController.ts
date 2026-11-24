import type { Request, Response } from 'express'
import { scheduleSchema } from '../utils/validation'
import { scheduleCampaign } from '../services/scheduler'

export async function schedule(req: Request, res: Response): Promise<void> {
  const parsed = scheduleSchema.parse(req.body)
  const csvText = req.file ? req.file.buffer.toString('utf8') : undefined
  const result = await scheduleCampaign(req.user!.id, { ...parsed, csvText })
  res.status(201).json(result)
}
