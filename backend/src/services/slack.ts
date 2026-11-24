import { config, slackOAuthConfigured } from '../config'
import { prisma } from '../db/prisma'
import { HttpError } from '../utils/errors'
import { logger } from '../utils/logger'
import { redis } from '../utils/redis'
import { formatWindow } from '../utils/scheduleMath'

type SlackTokenResponse = {
  ok: boolean
  error?: string
  access_token?: string
  team?: { id?: string; name?: string }
  incoming_webhook?: { url?: string; channel?: string; channel_id?: string }
}

export function buildSlackAuthorizeUrl(state: string): string {
  if (!slackOAuthConfigured) {
    throw new HttpError(500, 'Slack OAuth is not configured. Set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET.')
  }
  const url = new URL('https://slack.com/oauth/v2/authorize')
  url.searchParams.set('client_id', config.slackClientId)
  url.searchParams.set('scope', 'incoming-webhook,chat:write')
  url.searchParams.set('redirect_uri', config.slackCallbackUrl)
  url.searchParams.set('state', state)
  return url.toString()
}

export async function exchangeSlackCode(code: string): Promise<SlackTokenResponse> {
  const body = new URLSearchParams({
    client_id: config.slackClientId,
    client_secret: config.slackClientSecret,
    code,
    redirect_uri: config.slackCallbackUrl,
  })
  const response = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  const payload = (await response.json()) as SlackTokenResponse
  if (!response.ok || !payload.ok || !payload.access_token) {
    throw new HttpError(400, payload.error || 'Slack authorization failed')
  }
  return payload
}

export async function saveSlackIntegration(userId: string, payload: SlackTokenResponse): Promise<void> {
  await prisma.slackIntegration.upsert({
    where: { userId },
    update: {
      teamId: payload.team?.id,
      teamName: payload.team?.name,
      accessToken: payload.access_token!,
      webhookUrl: payload.incoming_webhook?.url,
      channelId: payload.incoming_webhook?.channel_id,
      channelName: payload.incoming_webhook?.channel,
      connectedAt: new Date(),
    },
    create: {
      userId,
      teamId: payload.team?.id,
      teamName: payload.team?.name,
      accessToken: payload.access_token!,
      webhookUrl: payload.incoming_webhook?.url,
      channelId: payload.incoming_webhook?.channel_id,
      channelName: payload.incoming_webhook?.channel,
    },
  })
}

export async function notifyRateLimit(input: {
  userId: string
  senderEmail: string
  senderId: string
  campaignId: string
  limit: number
  window: string
  reason: 'sender' | 'campaign'
  resumeAt: Date
}): Promise<void> {
  const scope = input.reason === 'campaign' ? input.campaignId : input.senderId
  const dedupeKey = `slack-notified:${input.reason}:${scope}:${input.window}`
  const locked = await redis.set(dedupeKey, '1', 'EX', 60 * 60 * 3, 'NX')
  if (locked !== 'OK') return

  try {
    const integration = await prisma.slackIntegration.findUnique({ where: { userId: input.userId } })
    if (!integration) return

    const text = [
      'Hourly email limit reached.',
      `Sender: ${input.senderEmail}`,
      `Limit: ${input.limit} (${input.reason === 'sender' ? 'per sender' : 'per campaign'})`,
      `Window: ${formatWindow(input.window)}`,
      `Sending resumes at: ${input.resumeAt.toISOString()}`,
    ].join('\n')

    if (integration.webhookUrl) {
      const response = await fetch(integration.webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!response.ok) {
        throw new Error(`Slack webhook responded ${response.status}`)
      }
      return
    }

    if (!integration.channelId) return

    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${integration.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ channel: integration.channelId, text }),
    })
    const payload = (await response.json()) as { ok?: boolean; error?: string }
    if (!payload.ok) {
      throw new Error(payload.error || 'chat.postMessage failed')
    }
  } catch (error) {
    await redis.del(dedupeKey)
    logger.error({ err: error, senderId: input.senderId }, 'slack rate-limit notification failed')
  }
}
