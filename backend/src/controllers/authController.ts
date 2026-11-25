import {
  createHash,
  randomBytes,
  randomInt,
  timingSafeEqual,
  scryptSync,
} from 'crypto'

import { sendOtpEmail } from '../services/mailer'
import type { Request, Response } from 'express'
import { config, googleOAuthConfigured } from '../config'
import { prisma } from '../db/prisma'
import { clearSessionCookie, setSessionCookie } from '../middleware/auth'
import { HttpError } from '../utils/errors'
import { redis, takeKey } from '../utils/redis'

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `scrypt$${salt}$${hash}`
}
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

  let user = await prisma.user.findUnique({
  where: { googleId: profile.sub },
})

if (!user) {
  user = await prisma.user.findUnique({
    where: { email: profile.email },
  })
}

if (user) {
  user = await prisma.user.update({
    where: { id: user.id },
    data: {
      googleId: profile.sub,
      name: profile.name || profile.email,
      avatarUrl: profile.picture,
    },
  })
} else {
  user = await prisma.user.create({
    data: {
      googleId: profile.sub,
      email: profile.email,
      name: profile.name || profile.email,
      avatarUrl: profile.picture,
    },
  })
}
  setSessionCookie(res, user.id)
  frontendRedirect(res, '/')
}
export async function requestEmailOtp(req: Request, res: Response): Promise<void> {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : ''
  const password =
  typeof req.body.password === 'string'
    ? req.body.password
    : ''

  if (
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
  password.length < 8
) {
  throw new HttpError(400, 'Please enter a valid email and password (minimum 8 characters).')
}

  const rateKey = `otp:rate:${email}`
  const requests = await redis.incr(rateKey)

  if (requests === 1) {
    await redis.expire(rateKey, 900)
  }

  if (requests > 3) {
    throw new HttpError(429, 'Too many OTP requests. Try again after 15 minutes.')
  }

  const code = randomInt(100000, 1000000).toString()
  const hashedCode = createHash('sha256').update(code).digest('hex')

  await redis.set(`otp:email:${email}`, hashedCode, 'EX', 600)
  await redis.del(`otp:attempts:${email}`)
    if (config.nodeEnv === 'development') {
  res.json({ message: `${code}` })
    return
  }

  try {
    await sendOtpEmail(email, code)
   } catch (error) {
    console.error('OTP email error:', error instanceof Error ? error.message : String(error))
    await redis.del(`otp:email:${email}`)
    throw new HttpError(502, 'Could not send verification email. Please try again.')
  }

  res.json({ message: 'If the email can receive messages, a verification code has been sent.' })
}

export async function verifyEmailOtp(
  req: Request,
  res: Response,
): Promise<void> {
  const email =
    typeof req.body.email === 'string'
      ? req.body.email.trim().toLowerCase()
      : ''

  const password =
    typeof req.body.password === 'string'
      ? req.body.password
      : ''

  const code =
    typeof req.body.code === 'string'
      ? req.body.code.trim()
      : ''

  if (
    !email ||
    password.length < 8 ||
    !/^\d{6}$/.test(code)
  ) {
    throw new HttpError(
      400,
      'Please enter your email, password and 6-digit code.',
    )
  }

  const otpKey = `otp:email:${email}`
  const savedHash = await redis.get(otpKey)

  if (!savedHash) {
    throw new HttpError(
      400,
      'Code expired or not found. Request a new code.',
    )
  }

  const attemptsKey = `otp:attempts:${email}`
  const attempts = await redis.incr(attemptsKey)

  if (attempts === 1) {
    await redis.expire(attemptsKey, 600)
  }

  if (attempts > 5) {
    await redis.del(otpKey, attemptsKey)
    throw new HttpError(
      429,
      'Too many incorrect attempts. Request a new code.',
    )
  }

  const submittedHash = createHash('sha256')
    .update(code)
    .digest('hex')

  const matches = timingSafeEqual(
    Buffer.from(savedHash, 'hex'),
    Buffer.from(submittedHash, 'hex'),
  )

  if (!matches) {
    throw new HttpError(400, 'Incorrect verification code.')
  }

  await redis.del(otpKey, attemptsKey)

  let user = await prisma.user.findUnique({
    where: { email },
  })

  const passwordHash = hashPassword(password)

  if (user) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    })
  } else {
    user = await prisma.user.create({
      data: {
        email,
        name: email.split('@')[0],
        googleId: null,
        passwordHash,
      },
    })
  }

  setSessionCookie(res, user.id)

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
  })
}
export async function logout(_req: Request, res: Response): Promise<void> {
  clearSessionCookie(res)
  res.json({ message: 'Logged out successfully' })
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = req.user

  if (!user) {
    throw new HttpError(401, 'Unauthorized')
  }

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
  })
}

export async function loginWithPassword(
  req: Request,
  res: Response,
): Promise<void> {
  const email =
    typeof req.body.email === 'string'
      ? req.body.email.trim().toLowerCase()
      : ''

  const password =
    typeof req.body.password === 'string'
      ? req.body.password
      : ''

  if (!email || !password) {
    throw new HttpError(400, 'Please enter your email and password.')
  }

  const user = await prisma.user.findUnique({
    where: { email },
  })

  if (!user || !user.passwordHash) {
    throw new HttpError(401, 'Invalid email or password.')
  }

  const parts = user.passwordHash.split('$')

  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    throw new HttpError(401, 'Invalid email or password.')
  }

  const salt = parts[1]
  const savedHash = Buffer.from(parts[2], 'hex')
  const submittedHash = scryptSync(password, salt, 64)

  if (
    savedHash.length !== submittedHash.length ||
    !timingSafeEqual(savedHash, submittedHash)
  ) {
    throw new HttpError(401, 'Invalid email or password.')
  }

  setSessionCookie(res, user.id)

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
  })
}