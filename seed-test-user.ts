import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { hashSync } from 'bcryptjs'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  await prisma.user.deleteMany({ where: { email: 'test@test.com' } }).catch(() => {})
  const user = await prisma.user.create({
    data: { email: 'test@test.com', passwordHash: hashSync('Test1234!', 12) }
  })
  console.log('Created user:', user.email, user.id)
  await prisma.$disconnect()
}
main().catch(e => { console.error(e.message); process.exit(1) })
