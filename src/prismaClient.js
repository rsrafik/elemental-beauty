// Prisma 7: the generator emits TypeScript (hence the .ts import — Node runs
// it via --experimental-strip-types, see the dev script), and the client
// talks to Postgres through a driver adapter instead of a built-in engine.
import { PrismaClient } from './generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
// A lab's lesson and prelab PDFs are megabytes of bytea that almost nothing
// needs, so they're left out of every query by default — listing labs, reading
// one, updating one never drags a file along. The routes that serve them (and
// the confirmation emails, which attach the prelab) select them explicitly.
const prisma = new PrismaClient({
    adapter,
    omit: { lab: { lessonPdf: true, prelabPdf: true } }
})

export default prisma
