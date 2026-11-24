export type EmailStatus = 'scheduled' | 'processing' | 'sent' | 'failed'

export type User = {
  id: string
  email: string
  name: string
  avatarUrl: string | null
}

export type EmailRecord = {
  id: string
  toEmail: string
  subject: string
  scheduledAt: string
  sentAt: string | null
  status: EmailStatus
  error: string | null
  previewUrl: string | null
  attempts: number
}

export type EmailPage = {
  data: EmailRecord[]
  page: number
  limit: number
  total: number
  source?: 'elasticsearch' | 'database'
}

export type Sender = {
  id: string
  email: string
  smtpHost: string
  smtpPort: number
  createdAt: string
}

export type SlackStatus = {
  connected: boolean
  teamName?: string | null
  channelName?: string | null
  connectedAt?: string
}

export type ScheduleResult = {
  campaign: {
    id: string
    subject: string
    startTime: string
    delayBetweenMs: number
    hourlyLimit: number
    emailCount: number
  }
  emailsQueued: number
}
