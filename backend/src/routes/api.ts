import { Router } from 'express'
import { schedule } from '../controllers/campaignController'
import { parseCsv } from '../controllers/csvController'
import { list, search } from '../controllers/emailController'
import { listSenders, provision } from '../controllers/senderController'
import { callback, connect, disconnect, status } from '../controllers/slackController'
import { requireAuth } from '../middleware/auth'
import { upload } from '../middleware/upload'
import { asyncHandler } from '../utils/asyncHandler'

export const apiRouter = Router()

apiRouter.use(asyncHandler(requireAuth))

apiRouter.post('/campaigns/schedule', upload.single('file'), asyncHandler(schedule))
apiRouter.post('/csv/parse', upload.single('file'), asyncHandler(parseCsv))
apiRouter.get('/emails', asyncHandler(list))
apiRouter.get('/search', asyncHandler(search))
apiRouter.get('/senders', asyncHandler(listSenders))
apiRouter.post('/senders/provision', asyncHandler(provision))
apiRouter.get('/slack/connect', asyncHandler(connect))
apiRouter.delete('/slack/disconnect', asyncHandler(disconnect))
apiRouter.get('/slack/status', asyncHandler(status))

export const slackCallbackRouter = Router()
slackCallbackRouter.get('/slack/callback', asyncHandler(callback))
