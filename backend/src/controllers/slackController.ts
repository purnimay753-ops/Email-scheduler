import { randomBytes } from 'crypto'
import type { Request, Response } from 'express'
import { config } from '../config'
import { prisma } from '../db/prisma'
import { buildSlackAuthorizeUrl, exchangeSlackCode, saveSlackIntegration } from '../services/slack'
import { redis, takeKey } from '../utils/redis'

export async function connect(req: Request, res: Response): Promise<void> {
  const state = randomBytes(16).toString('hex')
  await redis.set(`oauth:slack:${state}`, req.user!.id, 'EX', 600)
  res.redirect(buildSlackAuthorizeUrl(state))
}

export async function callback(req: Request, res: Response): Promise<void> {
  const code = typeof req.query.code === 'string' ? req.query.code : ''
  const state = typeof req.query.state === 'string' ? req.query.state : ''
  const userId = state ? await takeKey(`oauth:slack:${state}`) : null
  if (!code || !userId) {
    res.redirect(`${config.frontendUrl}/?slack=error`)
    return
  }

  try {
    const payload = await exchangeSlackCode(code)
    await saveSlackIntegration(userId, payload)
    res.redirect(`${config.frontendUrl}/?slack=connected`)
  } catch {
    res.redirect(`${config.frontendUrl}/?slack=error`)
  }
}

export async function disconnect(req: Request, res: Response): Promise<void> {
  await prisma.slackIntegration.deleteMany({ where: { userId: req.user!.id } })
  res.status(204).send()
}

export async function status(req: Request, res: Response): Promise<void> {
  const integration = await prisma.slackIntegration.findUnique({ where: { userId: req.user!.id } })
  if (!integration) {
    res.json({ connected: false })
    return
  }
  res.json({
    connected: true,
    teamName: integration.teamName,
    channelName: integration.channelName,
    connectedAt: integration.connectedAt,
  })
}
