// Prisma 7: the generator emits TypeScript (hence the .ts import — Node runs
// it via --experimental-strip-types, see the dev script), and the client
// talks to Postgres through a driver adapter instead of a built-in engine.
import { PrismaClient } from './generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

export default prisma
