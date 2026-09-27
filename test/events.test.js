// Who sees which events, against a real Postgres. Run with `npm test`; the
// database rules are the same as offers.test.js (its name has to contain
// "test"). Every row made here carries a per-run tag and is removed at the end.
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

let prisma, eventRoutes
const tag = `e${Date.now().toString(36)}`
const made = { users: [], events: [] }

before(async () => {
    if (skip) { return }
    prisma = (await import('../src/prismaClient.js')).default
    eventRoutes = (await import('../src/routes/eventRoutes.js')).default
})

after(async () => {
    if (skip) { return }
    await prisma.event.deleteMany({ where: { eventId: { in: made.events } } })
    await prisma.user.deleteMany({ where: { userId: { in: made.users } } })
    await prisma.$disconnect()
})

let counter = 0
async function person(role) {
    const n = counter++
    const user = await prisma.user.create({
        data: {
            username: `${tag}_${n}`,
            email: `${tag}_${n}@example.com`,
            passwordHash: 'x',
            emailVerified: true,
            waiverSigned: true,
            member: { create: { role } }
        }
    })
    made.users.push(user.userId)
    return user.userId
}

async function event(track) {
    const row = await prisma.event.create({
        data: { title: `${tag} ${track}`, date: new Date('2030-01-15'), track }
    })
    made.events.push(row.eventId)
    return row.eventId
}

// the real routes, behind a stand-in for the auth middleware
async function as(userId, role, run) {
    const app = express()
    app.use(express.json())
    app.use((req, res, next) => { req.userId = userId; req.role = role; next() })
    app.use('/events', eventRoutes)
    const server = app.listen(0)
    try {
        return await run(`http://localhost:${server.address().port}/events`)
    } finally {
        server.close()
    }
}

const mine = (rows) => rows.filter((row) => made.events.includes(row.eventId)).map((row) => row.track).sort()

test('a plain member sees neither officers nor EB board events, by list, by id or by RSVP', { skip }, async () => {
    const member = await person('member')
    await event('members')
    const officers = await event('officers')
    const board = await event('board')

    await as(member, 'member', async (base) => {
        assert.deepEqual(mine(await (await fetch(base)).json()), ['members'])
        assert.equal((await fetch(`${base}/${board}`)).status, 404)
        assert.equal((await fetch(`${base}/${officers}`)).status, 404)
        assert.equal((await fetch(`${base}/${board}/rsvp`, { method: 'POST' })).status, 404)
    })
})

test('j-board and officers see EB board events', { skip }, async () => {
    const jboard = await person('jboard')
    const officer = await person('officer')
    const board = await event('board')

    for (const [who, role] of [[jboard, 'jboard'], [officer, 'officer']]) {
        await as(who, role, async (base) => {
            assert.ok(mine(await (await fetch(base)).json()).includes('board'), `${role} list`)
            assert.equal((await fetch(`${base}/${board}`)).status, 200, `${role} by id`)
        })
    }
})

test('an event can be created for the EB board', { skip }, async () => {
    const officer = await person('officer')
    await as(officer, 'officer', async (base) => {
        const reply = await fetch(base, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ title: `${tag} board meeting`, type: 'official', date: '2030-02-01', track: 'board' })
        })
        assert.equal(reply.status, 201)
        const created = await reply.json()
        made.events.push(created.eventId)
        assert.equal(created.track, 'board')
    })
})
