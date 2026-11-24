import { z } from 'zod'
import { config } from '../config'

export const scheduleSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20000),
  startTime: z.string().min(1),
  delayBetweenMs: z.coerce.number().int().min(0).max(24 * 60 * 60 * 1000),
  hourlyLimit: z.coerce.number().int().min(1).max(100000),
  recipients: z.array(z.string()).max(config.maxRecipientsPerCampaign).optional(),
})

export const pageQuerySchema = z.object({
  status: z.enum(['scheduled', 'sent']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().optional(),
})
