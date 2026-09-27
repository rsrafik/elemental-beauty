// The roster's two lists — members, and accounts that haven't become members
// yet — against a real Postgres. Run with `npm test`; the database rules are
// the same as offers.test.js (its name has to contain "test").
//
// Every row made here carries a per-run tag and is removed at the end.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'

process.env.GMAIL_USER = ''
process.env.GMAIL_APP_PASSWORD = ''
process.env.RESEND_API_KEY = ''
process.env.JWT_SECRET ||= 'test-jwt-secret'
process.env.QR_SECRET ||= 'test-qr-secret'

const url = process.env.DATABASE_URL ?? ''
const skip = !/test/i.test(url.split('/').pop() ?? '')
    ? 'DATABASE_URL must point at a database with "test" in its name'
    : false

let prisma, memberRoutes
const tag = `m${Date.now().toString(36)}`
const made = []

before(async () => {
    if (skip) { return }
    prisma = (await import('../src/prismaClient.js')).default
    memberRoutes = (await import('../src/routes/memberRoutes.js')).default
})

after(async () => {
    if (skip) { return }
    await prisma.activityLog.deleteMany({
        where: { OR: [{ targetId: { in: made } }, { actorId: { in: made } }] }
    })
    await prisma.user.deleteMany({ where: { userId: { in: made } } })
    await prisma.$disconnect()
})

// ---- fixtures --------------------------------------------------------------

let counter = 0
// role null = signed up and nothing more: no member row
async function person(role = 'member') {
    const n = counter++
    const user = await prisma.user.create({
        data: {
            username: `${tag}_${n}`,
            email: `${tag}_${n}@example.com`,
            passwordHash: 'x',
            firstName: `Test${n}`,
            lastName: tag,
            emailVerified: role !== null,
            waiverSigned: role !== null,
            ...(role ? { member: { create: { role } } } : {})
        }
    })
    made.push(user.userId)
    return user.userId
}

// the real routes, behind a stand-in for the auth middleware
async function as(userId, role, run) {
    const app = express()
    app.use(express.json())
    app.use((req, res, next) => { req.userId = userId; req.role = role; next() })
    app.use('/members', memberRoutes)
    const server = app.listen(0)
    try {
        return await run(`http://localhost:${server.address().port}/members`)
    } finally {
        server.close()
    }
}

// ---- tests -----------------------------------------------------------------

test('accounts lists who signed up without becoming a member, and GET / still does not', { skip }, async () => {
    const officer = await person('officer')
    const member = await person('member')
    const account = await person(null)

    await as(officer, 'officer', async (base) => {
        const accounts = await (await fetch(`${base}/accounts`)).json()
        const mine = accounts.filter((row) => made.includes(row.userId))
        assert.deepEqual(mine.map((row) => row.userId), [account])
        assert.equal(mine[0].role, 'user')
        assert.equal(mine[0].points, null)
        assert.equal(mine[0].user.email, `${tag}_2@example.com`)

        const roster = await (await fetch(base)).json()
        const ids = roster.map((row) => row.userId)
        assert.ok(ids.includes(member))
        assert.ok(!ids.includes(account))
    })
})

test('a plain member cannot list accounts', { skip }, async () => {
    const member = await person('member')
    await as(member, 'member', async (base) => {
        assert.equal((await fetch(`${base}/accounts`)).status, 403)
    })
})

test('an officer can remove an account that never became a member', { skip }, async () => {
    const officer = await person('officer')
    const account = await person(null)

    await as(officer, 'officer', async (base) => {
        const reply = await fetch(`${base}/${account}`, { method: 'DELETE' })
        assert.equal(reply.status, 200)
    })
    assert.equal(await prisma.user.findUnique({ where: { userId: account } }), null)
})
