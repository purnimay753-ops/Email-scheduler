import 'dotenv/config'
import { prisma } from '../db/prisma'
import { provisionEtherealSenders } from '../services/mailer'

function readArg(name: string, fallback: string): string {
  const match = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  return match ? match.split('=').slice(1).join('=') : fallback
}

async function main(): Promise<void> {
  const userId = readArg('userId', '')
  const count = Number(readArg('count', '2'))
  const user = userId
    ? await prisma.user.findUnique({ where: { id: userId } })
    : await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } })

  if (!user) {
    throw new Error('No user found. Log in with Google first, or pass --userId=')
  }

  const senders = await provisionEtherealSenders(user.id, Number.isFinite(count) ? count : 2)
  console.log(`Provisioned ${senders.length} Ethereal sender(s) for ${user.email}`)
  for (const sender of senders) {
    console.log(`- ${sender.email} via ${sender.smtpHost}:${sender.smtpPort}`)
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
