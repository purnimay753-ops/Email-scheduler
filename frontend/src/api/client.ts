import type { EmailPage, ScheduleResult, Sender, SlackStatus, User } from '../types'

export const apiBase = import.meta.env.VITE_API_URL || ''

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.body && !(init.body instanceof FormData) && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }

  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  })

  if (response.status === 204) return undefined as T

  const payload = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) {
    throw new ApiError(payload.error || 'Request failed', response.status)
  }
  return payload as T
}

export const getMe = () => api<User>('/auth/me')
export const logout = () => api<void>('/auth/logout', { method: 'POST' })
export const getSenders = () => api<{ data: Sender[] }>('/api/senders')
export const provisionSender = () => api<{ data: Sender[] }>('/api/senders/provision', { method: 'POST', body: JSON.stringify({ count: 1 }) })
export const getSlackStatus = () => api<SlackStatus>('/api/slack/status')
export const disconnectSlack = () => api<void>('/api/slack/disconnect', { method: 'DELETE' })

export function getEmails(status: 'scheduled' | 'sent', page: number, search: string) {
  if (search.trim().length >= 2) {
    const params = new URLSearchParams({ status, page: String(page), limit: '20', q: search.trim() })
    return api<EmailPage>(`/api/search?${params}`)
  }
  const params = new URLSearchParams({ status, page: String(page), limit: '20' })
  return api<EmailPage>(`/api/emails?${params}`)
}

export function scheduleCampaign(input: {
  subject: string
  body: string
  startTime: string
  delayBetweenMs: number
  hourlyLimit: number
  recipients: string[]
}) {
  return api<ScheduleResult>('/api/campaigns/schedule', { method: 'POST', body: JSON.stringify(input) })
}
