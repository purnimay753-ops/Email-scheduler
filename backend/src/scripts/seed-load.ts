import 'dotenv/config'
import { prisma } from '../db/prisma'
import { provisionEtherealSenders } from '../services/mailer'
import { scheduleCampaign } from '../services/scheduler'
import { redis } from '../utils/redis'
import { emailQueue } from '../queues/emailQueue'

function readArg(name: string, fallback: string): string {
  const match = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  return match ? match.split('=').slice(1).join('=') : fallback
}

async function main(): Promise<void> {
  const count = Number(readArg('count', '1000'))
  const hourlyLimit = Number(readArg('hourlyLimit', '10'))
  const delayMs = Number(readArg('delayMs', '0'))
  const senderCount = Number(readArg('senders', '2'))

  const user = await prisma.user.upsert({
    where: { googleId: 'demo-loadtest' },
    update: {},
    create: {
      googleId: 'demo-loadtest',
      email: 'loadtest@localhost',
      name: 'Load Test',
    },
  })

  const existing = await prisma.sender.count({ where: { userId: user.id } })
  if (existing === 0) {
    console.log('Creating Ethereal senders (needs network)...')
    await provisionEtherealSenders(user.id, senderCount)
  }

  const recipients = Array.from({ length: count }, (_, index) => `loadtest+${index}@example.com`)
  const result = await scheduleCampaign(user.id, {
    subject: `Load test ${new Date().toISOString()}`,
    body: 'This is a scheduled load-test message from Postline.',
    startTime: new Date().toISOString(),
    delayBetweenMs: delayMs,
    hourlyLimit,
    recipients,
  })

  console.log(JSON.stringify(result, null, 2))
  console.log('Queue dashboard: http://localhost:4000/admin/queues (log in as this user to open it)')
  console.log('The worker will send until the sender and campaign hourly limits, then roll the rest into later hours.')
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
  .finally(async () => {
    await emailQueue.close()
    await prisma.$disconnect()
    redis.disconnect()
  })
