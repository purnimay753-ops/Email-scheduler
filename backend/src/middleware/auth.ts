import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config'
import { prisma } from '../db/prisma'
import { HttpError } from '../utils/errors'

type SessionPayload = { sub: string }

export function signSession(userId: string): string {
  return jwt.sign({ sub: userId }, config.sessionSecret, { expiresIn: config.sessionTtlSeconds })
}

export function setSessionCookie(res: Response, userId: string): void {
  res.cookie('session', signSession(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
    maxAge: config.sessionTtlSeconds * 1000,
    path: '/',
  })
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie('session', {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
    path: '/',
  })
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.session as string | undefined
  if (!token) {
    next(new HttpError(401, 'Unauthorized'))
    return
  }

  try {
    const payload = jwt.verify(token, config.sessionSecret) as SessionPayload
    const user = await prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user) {
      next(new HttpError(401, 'Unauthorized'))
      return
    }
    req.user = user
    next()
  } catch {
    next(new HttpError(401, 'Unauthorized'))
  }
}
