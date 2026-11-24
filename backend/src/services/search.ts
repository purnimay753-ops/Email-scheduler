import type { Email, EmailStatus } from '@prisma/client'
import { Client } from '@elastic/elasticsearch'
import { config } from '../config'
import { logger } from '../utils/logger'

export const EMAIL_INDEX = 'emails'

export const es = new Client({ node: config.elasticsearchUrl })

export type EmailDocument = {
  id: string
  userId: string
  campaignId: string
  senderId: string
  toEmail: string
  subject: string
  body: string
  status: EmailStatus
  scheduledAt: string
  sentAt: string | null
}

export function toEmailDocument(email: Email): EmailDocument {
  return {
    id: email.id,
    userId: email.userId,
    campaignId: email.campaignId,
    senderId: email.senderId,
    toEmail: email.toEmail,
    subject: email.subject,
    body: email.body,
    status: email.status,
    scheduledAt: email.scheduledAt.toISOString(),
    sentAt: email.sentAt ? email.sentAt.toISOString() : null,
  }
}

export async function ensureEmailIndex(): Promise<void> {
  try {
    const exists = await es.indices.exists({ index: EMAIL_INDEX })
    if (exists) return
    await es.indices.create({
      index: EMAIL_INDEX,
      mappings: {
        properties: {
          id: { type: 'keyword' },
          userId: { type: 'keyword' },
          campaignId: { type: 'keyword' },
          senderId: { type: 'keyword' },
          toEmail: { type: 'text', fields: { keyword: { type: 'keyword' } } },
          subject: { type: 'text' },
          body: { type: 'text' },
          status: { type: 'keyword' },
          scheduledAt: { type: 'date' },
          sentAt: { type: 'date' },
        },
      },
    })
    logger.info('created elasticsearch emails index')
  } catch (error) {
    logger.warn({ err: error }, 'elasticsearch unavailable; search will fall back until it recovers')
  }
}

export async function indexEmails(emails: Email[]): Promise<void> {
  if (emails.length === 0) return
  try {
    const operations = emails.flatMap((email) => {
      const document = toEmailDocument(email)
      return [{ index: { _index: EMAIL_INDEX, _id: document.id } }, document]
    })
    const result = await es.bulk({ operations, refresh: false })
    if (result.errors) {
      logger.warn('elasticsearch bulk index reported item errors')
    }
  } catch (error) {
    logger.warn({ err: error }, 'elasticsearch bulk index failed')
  }
}

export async function indexEmail(email: Email): Promise<void> {
  try {
    const document = toEmailDocument(email)
    await es.index({ index: EMAIL_INDEX, id: document.id, document, refresh: false })
  } catch (error) {
    logger.warn({ err: error }, 'elasticsearch index failed')
  }
}

export async function searchEmails(input: {
  userId: string
  query: string
  status?: 'scheduled' | 'sent'
  page: number
  limit: number
}): Promise<{ ids: string[]; total: number } | null> {
  const filters: Array<Record<string, unknown>> = [{ term: { userId: input.userId } }]
  if (input.status === 'scheduled') {
    filters.push({ term: { status: 'scheduled' } })
  } else if (input.status === 'sent') {
    filters.push({ terms: { status: ['sent', 'failed'] } })
  }

  try {
    const result = await es.search<EmailDocument>({
      index: EMAIL_INDEX,
      from: (input.page - 1) * input.limit,
      size: input.limit,
      query: {
        bool: {
          filter: filters,
          must: [
            {
              multi_match: {
                query: input.query,
                fields: ['toEmail^2', 'subject^2', 'body'],
                fuzziness: 'AUTO',
              },
            },
          ],
        },
      },
      sort: [{ scheduledAt: 'desc' }],
    })

    const total = typeof result.hits.total === 'number' ? result.hits.total : (result.hits.total?.value ?? 0)
    const ids = result.hits.hits.map((hit) => hit._id).filter((id): id is string => Boolean(id))
    return { ids, total }
  } catch (error) {
    logger.warn({ err: error }, 'elasticsearch search failed')
    return null
  }
}
