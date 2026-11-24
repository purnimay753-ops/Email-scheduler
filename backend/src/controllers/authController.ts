import { randomBytes } from 'crypto'
import type { Request, Response } from 'express'
import { config, googleOAuthConfigured } from '../config'
import { prisma } from '../db/prisma'
import { clearSessionCookie, setSessionCookie } from '../middleware/auth'
import { HttpError } from '../utils/errors'
import { redis, takeKey } from '../utils/redis'

type GoogleToken = { access_token?: string }
type GoogleProfile = { sub?: string; email?: string; name?: string; picture?: string }

function frontendRedirect(res: Response, path = '/'): void {
  res.redirect(`${config.frontendUrl}${path}`)
}

export async function startGoogle(_req: Request, res: Response): Promise<void> {
  if (!googleOAuthConfigured) {
    throw new HttpError(500, 'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.')
  }
  const state = randomBytes(16).toString('hex')
  await redis.set(`oauth:google:${state}`, '1', 'EX', 600)
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', config.googleClientId)
  url.searchParams.set('redirect_uri', config.googleCallbackUrl)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid email profile')
  url.searchParams.set('state', state)
  url.searchParams.set('prompt', 'select_account')
  res.redirect(url.toString())
}

export async function googleCallback(req: Request, res: Response): Promise<void> {
  const code = typeof req.query.code === 'string' ? req.query.code : ''
  const state = typeof req.query.state === 'string' ? req.query.state : ''
  const saved = state ? await takeKey(`oauth:google:${state}`) : null
  if (!code || !saved) {
    frontendRedirect(res, '/login?auth=error')
    return
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      redirect_uri: config.googleCallbackUrl,
      grant_type: 'authorization_code',
    }),
  })
  const token = (await tokenResponse.json()) as GoogleToken
  if (!tokenResponse.ok || !token.access_token) {
    frontendRedirect(res, '/login?auth=error')
    return
  }

  const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { authorization: `Bearer ${token.access_token}` },
  })
  const profile = (await profileResponse.json()) as GoogleProfile
  if (!profile.sub || !profile.email) {
    frontendRedirect(res, '/login?auth=error')
    return
  }

  const user = await prisma.user.upsert({
    where: { googleId: profile.sub },
    update: {
      email: profile.email,
      name: profile.name || profile.email,
      avatarUrl: profile.picture,
    },
    create: {
      googleId: profile.sub,
      email: profile.email,
      name: profile.name || profile.email,
      avatarUrl: profile.picture,
    },
  })

  setSessionCookie(res, user.id)
  frontendRedirect(res, '/')
}

export function logout(_req: Request, res: Response): void {
  clearSessionCookie(res)
  res.status(204).send()
}

export function me(req: Request, res: Response): void {
  const user = req.user!
  res.json({ id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl })
}
