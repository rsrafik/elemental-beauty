// Prisma 7: the generator emits TypeScript (hence the .ts import — Node runs
// it via --experimental-strip-types, see the dev script), and the client
// talks to Postgres through a driver adapter instead of a built-in engine.
import { PrismaClient } from './generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
// A lab's lesson PDF is megabytes of bytea that almost nothing needs, so it's
// left out of every query by default — listing labs, reading one, updating one
// never drags the file along. The one route that serves it asks for it back
// with `omit: { lessonPdf: false }`.
const prisma = new PrismaClient({
    adapter,
    omit: { lab: { lessonPdf: true } }
})

export default prisma
