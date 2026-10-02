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

test('an admin giving an account a role makes it a member, with both gates marked passed', { skip }, async () => {
    const admin = await person('admin')
    const account = await person(null)

    await as(admin, 'admin', async (base) => {
        const reply = await fetch(`${base}/${account}/role`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ role: 'member' })
        })
        assert.equal(reply.status, 200)
    })
    const user = await prisma.user.findUnique({ where: { userId: account }, include: { member: true } })
    assert.equal(user.member.role, 'member')
    assert.equal(user.member.points, 0)
    assert.equal(user.emailVerified, true)
    assert.equal(user.waiverSigned, true)
    const entry = await prisma.activityLog.findFirst({ where: { targetId: account, action: 'role_changed' } })
    assert.deepEqual(entry.details, { from: 'user', to: 'member' })
})

test('an officer cannot promote an account — role changes are an admin\'s', { skip }, async () => {
    const officer = await person('officer')
    const account = await person(null)
    await as(officer, 'officer', async (base) => {
        const reply = await fetch(`${base}/${account}/role`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ role: 'member' })
        })
        assert.equal(reply.status, 403)
    })
})

test('an officer can set points to a typed total, logged as the difference', { skip }, async () => {
    const officer = await person('officer')
    const member = await person('member')
    await prisma.member.update({ where: { userId: member }, data: { points: 10 } })

    await as(officer, 'officer', async (base) => {
        const set = (points) => fetch(`${base}/${member}/points`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ points })
        })
        const reply = await set(4)
        assert.equal(reply.status, 200)
        assert.equal((await reply.json()).points, 4)
        assert.equal((await set(-1)).status, 400)
        assert.equal((await set(2.5)).status, 400)
    })

    const logged = await prisma.activityLog.findFirst({ where: { targetId: member, action: 'points_awarded' } })
    assert.equal(logged.points, -6)
    assert.deepEqual(logged.details, { reason: 'manual', from: 10, to: 4 })
})

test('j-board cannot give or set anyone\'s points', { skip }, async () => {
    const jboard = await person('jboard')
    const member = await person('member')
    await as(jboard, 'jboard', async (base) => {
        const send = (method, body) => fetch(`${base}/${member}/points`, {
            method,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body)
        })
        assert.equal((await send('POST', { action: 'discord_join' })).status, 403)
        assert.equal((await send('PUT', { points: 50 })).status, 403)
    })
    const row = await prisma.member.findUnique({ where: { userId: member } })
    assert.equal(row.points, 0)
})

test('following on instagram and joining the discord are given once, and can be taken back', { skip }, async () => {
    const officer = await person('officer')
    const member = await person('member')
    await as(officer, 'officer', async (base) => {
        const give = (action) => fetch(`${base}/${member}/points`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action })
        })
        const undo = (action) => fetch(`${base}/${member}/points/${action}`, { method: 'DELETE' })

        const first = await give('instagram_follow')
        assert.equal(first.status, 200)
        assert.deepEqual(await first.json(), { message: '+2 points for instagram_follow', points: 2, awardsClaimed: ['instagram_follow'] })
        // twice: refused, nothing added
        assert.equal((await give('instagram_follow')).status, 409)

        // a repost can happen again
        assert.equal((await give('instagram_repost')).status, 200)
        assert.equal((await (await give('instagram_repost')).json()).points, 4)

        // taken back: the 2 come off and it can be given again
        const back = await undo('instagram_follow')
        assert.equal(back.status, 200)
        assert.deepEqual((await back.json()).awardsClaimed, [])
        assert.equal((await undo('instagram_follow')).status, 409)
        assert.equal((await undo('instagram_repost')).status, 400)
        assert.equal((await (await give('instagram_follow')).json()).points, 4)
    })
    const row = await prisma.member.findUnique({ where: { userId: member } })
    assert.equal(row.points, 4)
    const undone = await prisma.activityLog.findFirst({ where: { targetId: member, points: -2 } })
    assert.deepEqual(undone.details, { reason: 'instagram_follow', undone: true })
})
