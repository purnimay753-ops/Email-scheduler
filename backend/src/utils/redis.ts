import IORedis from 'ioredis'
import { config } from '../config'

export function createRedis(): IORedis {
  return new IORedis(config.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  })
}

export const redis = createRedis()

export async function takeKey(key: string): Promise<string | null> {
  const value = await redis.get(key)
  if (value !== null) await redis.del(key)
  return value
}
