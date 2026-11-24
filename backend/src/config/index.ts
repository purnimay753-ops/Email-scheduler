import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.string().default('info'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://127.0.0.1:6379'),
  ELASTICSEARCH_URL: z.string().min(1).default('http://127.0.0.1:9200'),
  SESSION_SECRET: z.string().min(16),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 7),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  GOOGLE_CALLBACK_URL: z.string().default('http://localhost:4000/auth/google/callback'),
  SLACK_CLIENT_ID: z.string().default(''),
  SLACK_CLIENT_SECRET: z.string().default(''),
  SLACK_CALLBACK_URL: z.string().default('http://localhost:4000/api/slack/callback'),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
  MIN_DELAY_BETWEEN_EMAILS_MS: z.coerce.number().int().nonnegative().default(2000),
  MAX_EMAILS_PER_HOUR_PER_SENDER: z.coerce.number().int().positive().default(200),
  STALE_PROCESSING_MS: z.coerce.number().int().positive().default(5 * 60 * 1000),
  JOB_ATTEMPTS: z.coerce.number().int().positive().default(3),
  JOB_BACKOFF_MS: z.coerce.number().int().positive().default(5000),
  MAX_RECIPIENTS_PER_CAMPAIGN: z.coerce.number().int().positive().default(5000),
  SMTP_FROM_NAME: z.string().min(1).default('Postline'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('\n')
  throw new Error(`Invalid environment configuration:\n${details}`)
}

export const config = {
  nodeEnv: parsed.data.NODE_ENV,
  port: parsed.data.PORT,
  logLevel: parsed.data.LOG_LEVEL,
  databaseUrl: parsed.data.DATABASE_URL,
  redisUrl: parsed.data.REDIS_URL,
  elasticsearchUrl: parsed.data.ELASTICSEARCH_URL,
  sessionSecret: parsed.data.SESSION_SECRET,
  sessionTtlSeconds: parsed.data.SESSION_TTL_SECONDS,
  frontendUrl: parsed.data.FRONTEND_URL,
  googleClientId: parsed.data.GOOGLE_CLIENT_ID,
  googleClientSecret: parsed.data.GOOGLE_CLIENT_SECRET,
  googleCallbackUrl: parsed.data.GOOGLE_CALLBACK_URL,
  slackClientId: parsed.data.SLACK_CLIENT_ID,
  slackClientSecret: parsed.data.SLACK_CLIENT_SECRET,
  slackCallbackUrl: parsed.data.SLACK_CALLBACK_URL,
  workerConcurrency: parsed.data.WORKER_CONCURRENCY,
  minDelayBetweenEmailsMs: parsed.data.MIN_DELAY_BETWEEN_EMAILS_MS,
  maxEmailsPerHourPerSender: parsed.data.MAX_EMAILS_PER_HOUR_PER_SENDER,
  staleProcessingMs: parsed.data.STALE_PROCESSING_MS,
  jobAttempts: parsed.data.JOB_ATTEMPTS,
  jobBackoffMs: parsed.data.JOB_BACKOFF_MS,
  maxRecipientsPerCampaign: parsed.data.MAX_RECIPIENTS_PER_CAMPAIGN,
  smtpFromName: parsed.data.SMTP_FROM_NAME,
}

export const googleOAuthConfigured = Boolean(config.googleClientId && config.googleClientSecret)
export const slackOAuthConfigured = Boolean(config.slackClientId && config.slackClientSecret)
