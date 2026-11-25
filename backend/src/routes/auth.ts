import { Router } from 'express'
import {
  googleCallback,
  logout,
  me,
  startGoogle,
  requestEmailOtp,
  verifyEmailOtp,
  loginWithPassword,
} from '../controllers/authController'
import { requireAuth } from '../middleware/auth'
import { asyncHandler } from '../utils/asyncHandler'

export const authRouter = Router()

authRouter.get('/google', asyncHandler(startGoogle))
authRouter.get('/google/callback', asyncHandler(googleCallback))

authRouter.post('/email/request-otp', asyncHandler(requestEmailOtp))
authRouter.post('/email/verify-otp', asyncHandler(verifyEmailOtp))
authRouter.post('/email/password-login', asyncHandler(loginWithPassword))

authRouter.post('/logout', asyncHandler(logout))
authRouter.get('/me', asyncHandler(requireAuth), asyncHandler(me))