import { Router } from 'express'
import { googleCallback, logout, me, startGoogle } from '../controllers/authController'
import { requireAuth } from '../middleware/auth'
import { asyncHandler } from '../utils/asyncHandler'

export const authRouter = Router()

authRouter.get('/google', asyncHandler(startGoogle))
authRouter.get('/google/callback', asyncHandler(googleCallback))
authRouter.post('/logout', asyncHandler(logout))
authRouter.get('/me', asyncHandler(requireAuth), asyncHandler(me))
