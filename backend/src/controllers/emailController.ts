import type { Request, Response } from 'express'
import { prisma } from '../db/prisma'
import { listEmails, statusFilter, toEmailView } from '../services/emailQuery'
import { searchEmails } from '../services/search'
import { HttpError } from '../utils/errors'
import { pageQuerySchema } from '../utils/validation'

export async function list(req: Request, res: Response): Promise<void> {
  const query = pageQuerySchema.parse(req.query)
  if (!query.status) throw new HttpError(400, 'status must be scheduled or sent')
  const result = await listEmails({
    userId: req.user!.id,
    status: query.status,
    page: query.page,
    limit: query.limit,
  })
  res.json(result)
}

export async function search(req: Request, res: Response): Promise<void> {
  const query = pageQuerySchema.parse(req.query)
  const term = query.q?.trim() ?? ''
  if (term.length < 2) throw new HttpError(400, 'q must be at least 2 characters')

  const found = await searchEmails({
    userId: req.user!.id,
    query: term,
    status: query.status,
    page: query.page,
    limit: query.limit,
  })

  if (!found) {
    const status = query.status ? statusFilter(query.status) : undefined
    const where = {
      userId: req.user!.id,
      ...(status ? { status } : {}),
      OR: [
        { toEmail: { contains: term, mode: 'insensitive' as const } },
        { subject: { contains: term, mode: 'insensitive' as const } },
      ],
    }
    const [total, rows] = await prisma.$transaction([
      prisma.email.count({ where }),
      prisma.email.findMany({
        where,
        orderBy: { scheduledAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ])
    res.json({ data: rows.map(toEmailView), page: query.page, limit: query.limit, total, source: 'database' })
    return
  }

  const rows = await prisma.email.findMany({
    where: { id: { in: found.ids }, userId: req.user!.id },
  })
  const byId = new Map(rows.map((row) => [row.id, row]))
  const data = found.ids.flatMap((id) => {
    const row = byId.get(id)
    return row ? [toEmailView(row)] : []
  })
  res.json({ data, page: query.page, limit: query.limit, total: found.total, source: 'elasticsearch' })
}
