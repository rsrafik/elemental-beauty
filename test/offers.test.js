// The waitlist, offers, confirmations, reminders and the seat lock, against a
// real Postgres. Run with `npm test`.
//
// DATABASE_URL has to name a database with "test" in it — these create and
// delete rows, and must never run against the dev or production data. Locally:
// make one (`createdb elemental_test`, or in the compose container), apply the
// migrations to it (`DATABASE_URL=... npx prisma migrate deploy`) and put the
// URL in .env.test. CI does the same against a throwaway Postgres (see
// .github/workflows/ci.yml).
//
// Every row made here carries a per-run tag and is removed at the end, so the
// suite can share a database with seed data.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'

// never send real mail from a test, whatever .env says
process.env.GMAIL_USER = ''
process.env.GMAIL_APP_PASSWORD = ''
process.env.RESEND_API_KEY = ''
process.env.JWT_SECRET ||= 'test-jwt-secret'
process.env.QR_SECRET ||= 'test-qr-secret'

const url = process.env.DATABASE_URL ?? ''
const skip = !/test/i.test(url.split('/').pop() ?? '')
    ? 'DATABASE_URL must point at a database with "test" in its name'
    : false

let prisma, offers, reminders, clubTime, labRoutes
const tag = `t${Date.now().toString(36)}`
const made = { users: [], labs: [], events: [] }
const HOUR = 60 * 60 * 1000

before(async () => {
    if (skip) { return }
    prisma = (await import('../src/prismaClient.js')).default
    offers = await import('../src/offers.js')
    reminders = await import('../src/reminders.js')
    clubTime = await import('../src/clubTime.js')
    labRoutes = (await import('../src/routes/labRoutes.js')).default
})

after(async () => {
    if (skip) { return }
    await prisma.lab.deleteMany({ where: { labId: { in: made.labs } } })
    await prisma.event.deleteMany({ where: { eventId: { in: made.events } } })
    await prisma.activityLog.deleteMany({ where: { targetId: { in: made.users } } })
    await prisma.user.deleteMany({ where: { userId: { in: made.users } } })
    await prisma.$disconnect()
})

// ---- fixtures --------------------------------------------------------------

let counter = 0
async function member() {
    const n = counter++
    const user = await prisma.user.create({
        data: {
            username: `${tag}_${n}`,
            email: `${tag}_${n}@example.com`,
            passwordHash: 'x',
            firstName: `Test${n}`,
            lastName: tag,
            emailVerified: true,
            waiverSigned: true,
            member: { create: {} }
        }
    })
    made.users.push(user.userId)
    return user.userId
}

// a published lab `hoursOut` hours from now (on the club's clock)
async function lab({ capacity = null, hoursOut = 24 * 7 } = {}) {
    const at = new Date(Date.now() + hoursOut * HOUR)
    const day = clubTime.clubToday(at)
    const wall = new Intl.DateTimeFormat('en-GB', { timeZone: clubTime.CLUB_TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at)
    const row = await prisma.lab.create({
        data: { title: `${tag} lab`, date: clubTime.dateColumn(day), startTime: wall, capacity, published: true }
    })
    made.labs.push(row.labId)
    return row.labId
}

function join(labId, memberId, attendanceStatus = 'rsvped', extra = {}) {
    return prisma.memberLab.create({
        data: {
            labId, memberId, attendanceStatus,
            ...(attendanceStatus === 'waitlisted' ? { waitlistedAt: new Date() } : {}),
            ...extra
        }
    })
}

const statusOf = async (labId, memberId) =>
    (await prisma.memberLab.findUnique({ where: { memberId_labId: { memberId, labId } } }))?.attendanceStatus ?? null

// ---- offers ----------------------------------------------------------------

test('a freed seat is offered to whoever has waited longest', { skip }, async () => {
    const id = await lab({ capacity: 1 })
    const [first, second] = [await member(), await member()]
    await join(id, first, 'waitlisted', { waitlistedAt: new Date(Date.now() - 60_000) })
    await join(id, second, 'waitlisted')

    const offered = await prisma.$transaction((tx) => offers.offerNext(tx, 'lab', id))
    assert.equal(offered, first)
    assert.equal(await statusOf(id, first), 'offered')
    assert.equal(await statusOf(id, second), 'waitlisted')
})

test('accepting an offer signs you up, and says so if it is already done or gone', { skip }, async () => {
    const id = await lab({ capacity: 1 })
    const who = await member()
    await join(id, who, 'offered')

    assert.equal((await offers.acceptOffer('lab', id, who)).status, 'accepted')
    assert.equal(await statusOf(id, who), 'rsvped')
    assert.equal((await offers.acceptOffer('lab', id, who)).status, 'already')
    assert.equal((await offers.acceptOffer('lab', id, await member())).status, 'gone')
})

test('an offer unanswered for 48 hours lapses and moves on down the waitlist', { skip }, async () => {
    const id = await lab({ capacity: 1, hoursOut: 24 * 10 })
    const [slow, next] = [await member(), await member()]
    await join(id, slow, 'offered', { offerSentAt: new Date(Date.now() - 49 * HOUR) })
    await join(id, next, 'waitlisted')

    await offers.expireOffers()
    assert.equal(await statusOf(id, slow), null)
    assert.equal(await statusOf(id, next), 'offered')
})

test('inside the last 48 hours an unanswered offer is left for the door', { skip }, async () => {
    const id = await lab({ capacity: 1, hoursOut: 30 })
    const [slow, next] = [await member(), await member()]
    await join(id, slow, 'offered', { offerSentAt: new Date(Date.now() - 49 * HOUR) })
    await join(id, next, 'waitlisted')

    await offers.expireOffers()
    assert.equal(await statusOf(id, slow), 'offered')
    assert.equal(await statusOf(id, next), 'waitlisted')
})

// ---- confirmations ---------------------------------------------------------

test('missing the confirmation deadline costs exactly as many spots as the waitlist needs', { skip }, async () => {
    const id = await lab({ capacity: 3 })
    const [a, b, c, waiting] = [await member(), await member(), await member(), await member()]
    const past = new Date(Date.now() - HOUR)
    await join(id, a, 'rsvped', { confirmSentAt: past, confirmBy: past, confirmedAt: past })   // confirmed
    await join(id, b, 'rsvped', { confirmSentAt: past, confirmBy: past })                      // missed it
    await join(id, c, 'rsvped', { confirmSentAt: past, confirmBy: past })                      // missed it
    await join(id, waiting, 'waitlisted')

    await offers.expireOffers()
    const statuses = await Promise.all([a, b, c].map((m) => statusOf(id, m)))
    assert.equal(statuses[0], 'rsvped', 'whoever confirmed keeps their spot')
    assert.equal(statuses.filter((s) => s === null).length, 1, 'one of the two who missed it goes')
    assert.equal(await statusOf(id, waiting), 'offered')
})

test('with nobody waiting, a missed deadline is not enforced', { skip }, async () => {
    const id = await lab({ capacity: 2 })
    const late = await member()
    const past = new Date(Date.now() - HOUR)
    await join(id, late, 'rsvped', { confirmSentAt: past, confirmBy: past })

    await offers.expireOffers()
    assert.equal(await statusOf(id, late), 'rsvped')
})

test('a confirmation round needs a deadline that has not passed', { skip }, async () => {
    const id = await lab({ capacity: 2 })
    await join(id, await member())
    await assert.rejects(offers.sendConfirmations('lab', id, new Date(Date.now() - 1000)), /hasn’t passed/)
    const { sent } = await offers.sendConfirmations('lab', id, new Date(Date.now() + 24 * HOUR))
    assert.equal(sent, 1)
})

// ---- the seat lock ----------------------------------------------------------

test('six people pressing RSVP at once on a two-seat lab get two seats and four waitlist places', { skip }, async () => {
    const id = await lab({ capacity: 2 })
    const people = await Promise.all(Array.from({ length: 6 }, member))

    // the real route, behind a stand-in for the auth middleware
    const app = express()
    app.use(express.json())
    app.use((req, res, next) => { req.userId = Number(req.get('x-user')); req.role = 'member'; next() })
    app.use('/labs', labRoutes)
    const server = app.listen(0)
    const port = server.address().port
    try {
        const replies = await Promise.all(people.map((who) =>
            fetch(`http://localhost:${port}/labs/${id}/rsvp`, { method: 'POST', headers: { 'x-user': String(who) } })))
        assert.deepEqual(replies.map((r) => r.status).sort(), [201, 201, 202, 202, 202, 202])
    } finally {
        server.close()
    }
    const rows = await prisma.memberLab.groupBy({ by: ['attendanceStatus'], where: { labId: id }, _count: true })
    const count = Object.fromEntries(rows.map((r) => [r.attendanceStatus, r._count]))
    assert.deepEqual(count, { rsvped: 2, waitlisted: 4 })
})

test('an RSVP to a lab that has already started is refused', { skip }, async () => {
    const id = await lab({ capacity: null, hoursOut: -1 })
    const who = await member()
    const app = express()
    app.use((req, res, next) => { req.userId = who; req.role = 'member'; next() })
    app.use('/labs', labRoutes)
    const server = app.listen(0)
    try {
        const reply = await fetch(`http://localhost:${server.address().port}/labs/${id}/rsvp`, { method: 'POST' })
        assert.equal(reply.status, 409)
    } finally {
        server.close()
    }
})

// ---- reminders -------------------------------------------------------------

test('the day-before reminder goes out once, and only inside the last 24 hours', { skip }, async () => {
    const soon = await lab({ hoursOut: 12 })
    const later = await lab({ hoursOut: 40 })
    await join(soon, await member())
    await join(later, await member())

    await reminders.sendReminders()
    const [a, b] = await Promise.all([soon, later].map((labId) =>
        prisma.lab.findUnique({ where: { labId }, select: { reminderSentAt: true } })))
    assert.ok(a.reminderSentAt, 'the lab 12 hours out was reminded about')
    assert.equal(b.reminderSentAt, null, 'the lab 40 hours out was not')

    await reminders.sendReminders()
    const again = await prisma.lab.findUnique({ where: { labId: soon }, select: { reminderSentAt: true } })
    assert.equal(again.reminderSentAt.getTime(), a.reminderSentAt.getTime(), 'and not a second time')
})
