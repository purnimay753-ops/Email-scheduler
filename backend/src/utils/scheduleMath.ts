const HOUR_MS = 60 * 60 * 1000

export function hourWindowKey(date = new Date()): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hour = String(date.getUTCHours()).padStart(2, '0')
  return `${year}${month}${day}${hour}`
}

export function msUntilNextUtcHour(now = Date.now()): number {
  const remainder = now % HOUR_MS
  return remainder === 0 ? HOUR_MS : HOUR_MS - remainder
}

/** First overflow waits until the next UTC hour. Later ones keep their order with min-delay spacing. */
export function overflowDelayMs(position: number, minDelayMs: number, now = Date.now()): number {
  const stagger = Math.max(0, position - 1) * Math.max(minDelayMs, 0)
  return msUntilNextUtcHour(now) + stagger
}

export function formatWindow(windowKey: string): string {
  const year = windowKey.slice(0, 4)
  const month = windowKey.slice(4, 6)
  const day = windowKey.slice(6, 8)
  const hour = windowKey.slice(8, 10)
  const nextHour = String((Number(hour) + 1) % 24).padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:00–${nextHour}:00 UTC`
}
