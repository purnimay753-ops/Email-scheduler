import type { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../db/prisma'
import { provisionEtherealSenders } from '../services/mailer'

const provisionSchema = z.object({
  count: z.coerce.number().int().min(1).max(5).default(1),
})

export async function listSenders(req: Request, res: Response): Promise<void> {
  const senders = await prisma.sender.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true, smtpHost: true, smtpPort: true, createdAt: true },
  })
  res.json({ data: senders })
}

export async function provision(req: Request, res: Response): Promise<void> {
  const { count } = provisionSchema.parse(req.body ?? {})
  const senders = await provisionEtherealSenders(req.user!.id, count)
  res.status(201).json({ data: senders })
}
