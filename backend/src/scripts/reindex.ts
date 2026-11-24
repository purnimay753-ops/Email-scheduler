import 'dotenv/config'
import { prisma } from '../db/prisma'
import { ensureEmailIndex, indexEmails } from '../services/search'

async function main(): Promise<void> {
  await ensureEmailIndex()
  let cursor: string | undefined
  let indexed = 0

  for (;;) {
    const rows = await prisma.email.findMany({
      orderBy: { id: 'asc' },
      take: 200,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    if (rows.length === 0) break
    await indexEmails(rows)
    indexed += rows.length
    cursor = rows[rows.length - 1]?.id
    if (rows.length < 200) break
  }

  console.log(`reindexed ${indexed} emails`)
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
