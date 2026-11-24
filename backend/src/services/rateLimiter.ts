import { config } from '../config'
import { redis } from '../utils/redis'
import { hourWindowKey } from '../utils/scheduleMath'

const ACQUIRE_LUA = `
local senderLimit = tonumber(ARGV[1])
local campaignLimit = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])
local senderCount = tonumber(redis.call('GET', KEYS[1]) or '0')
local campaignCount = tonumber(redis.call('GET', KEYS[2]) or '0')

if senderCount >= senderLimit then
  local pos = redis.call('INCR', KEYS[3])
  if pos == 1 then redis.call('EXPIRE', KEYS[3], ttl) end
  return {0, 'sender', senderCount, campaignCount, pos}
end

if campaignCount >= campaignLimit then
  local pos = redis.call('INCR', KEYS[4])
  if pos == 1 then redis.call('EXPIRE', KEYS[4], ttl) end
  return {0, 'campaign', senderCount, campaignCount, pos}
end

local nextSender = redis.call('INCR', KEYS[1])
local nextCampaign = redis.call('INCR', KEYS[2])
if nextSender == 1 then redis.call('EXPIRE', KEYS[1], ttl) end
if nextCampaign == 1 then redis.call('EXPIRE', KEYS[2], ttl) end
return {1, 'ok', nextSender, nextCampaign, 0}
`

const RELEASE_LUA = `
if tonumber(redis.call('GET', KEYS[1]) or '0') > 0 then redis.call('DECR', KEYS[1]) end
if tonumber(redis.call('GET', KEYS[2]) or '0') > 0 then redis.call('DECR', KEYS[2]) end
return 1
`

const RESERVE_SLOT_LUA = `
local now = tonumber(ARGV[1])
local minDelay = tonumber(ARGV[2])
local nextAt = tonumber(redis.call('GET', KEYS[1]) or '0')
if nextAt > now then
  return nextAt - now
end
local ttl = math.max(minDelay * 2, 3600000)
redis.call('SET', KEYS[1], tostring(now + minDelay), 'PX', ttl)
return 0
`

export type RateAcquireResult =
  | {
      ok: true
      senderCount: number
      campaignCount: number
      senderLimit: number
      campaignLimit: number
      window: string
    }
  | {
      ok: false
      reason: 'sender' | 'campaign'
      senderCount: number
      campaignCount: number
      senderLimit: number
      campaignLimit: number
      window: string
      position: number
    }

export async function acquireSendSlot(input: {
  senderId: string
  campaignId: string
  campaignHourlyLimit: number
  now?: Date
}): Promise<RateAcquireResult> {
  const window = hourWindowKey(input.now ?? new Date())
  const senderLimit = config.maxEmailsPerHourPerSender
  const campaignLimit = Math.max(1, input.campaignHourlyLimit)
  const keys = [
    `rate:${input.senderId}:${window}`,
    `rate:campaign:${input.campaignId}:${window}`,
    `overflow:sender:${input.senderId}:${window}`,
    `overflow:campaign:${input.campaignId}:${window}`,
  ]

  const raw = (await redis.eval(ACQUIRE_LUA, keys.length, ...keys, senderLimit, campaignLimit, 60 * 60 * 3)) as Array<
    string | number
  >

  const allowed = Number(raw[0]) === 1
  const reason = String(raw[1])
  const senderCount = Number(raw[2])
  const campaignCount = Number(raw[3])
  const position = Number(raw[4])

  if (allowed) {
    return { ok: true, senderCount, campaignCount, senderLimit, campaignLimit, window }
  }

  return {
    ok: false,
    reason: reason === 'campaign' ? 'campaign' : 'sender',
    senderCount,
    campaignCount,
    senderLimit,
    campaignLimit,
    window,
    position: Math.max(1, position),
  }
}

/** Returns how long this sender must wait before the next send. 0 means the slot was reserved. */
export async function releaseSendSlot(input: {
  senderId: string
  campaignId: string
  window: string
}): Promise<void> {
  await redis.eval(
    RELEASE_LUA,
    2,
    `rate:${input.senderId}:${input.window}`,
    `rate:campaign:${input.campaignId}:${input.window}`,
  )
}

export async function reserveSenderGap(senderId: string, now = Date.now()): Promise<number> {
  if (config.minDelayBetweenEmailsMs <= 0) return 0
  const wait = await redis.eval(
    RESERVE_SLOT_LUA,
    1,
    `next-send:${senderId}`,
    now,
    config.minDelayBetweenEmailsMs,
  )
  return Number(wait)
}
