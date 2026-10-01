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

test('j-board edits a lab only once it is opened to them, never adds or deletes one, and can rsvp', { skip }, async () => {
    const jboard = await member()
    await prisma.member.update({ where: { userId: jboard }, data: { role: 'jboard' } })
    const id = await lab()

    const app = express()
    app.use(express.json())
    app.use((req, res, next) => { req.userId = Number(req.get('x-user')); req.role = req.get('x-role'); next() })
    app.use('/labs', labRoutes)
    const server = app.listen(0)
    const base = `http://localhost:${server.address().port}/labs`
    const as = (who, role, path, method, body) => fetch(`${base}${path}`, {
        method,
        headers: { 'x-user': String(who), 'x-role': role, 'content-type': 'application/json' },
        body: body && JSON.stringify(body)
    })
    try {
        assert.equal((await as(jboard, 'jboard', `/${id}`, 'PUT', { title: `${tag} renamed` })).status, 403)
        assert.equal((await as(jboard, 'jboard', `/${id}/quiz/edit`, 'GET')).status, 403)
        // j-board can't open it to themselves
        assert.equal((await as(jboard, 'jboard', `/${id}/jboard-access`, 'PUT', { allowed: true })).status, 403)

        assert.equal((await as(jboard, 'officer', `/${id}/jboard-access`, 'PUT', { allowed: true })).status, 200)
        assert.equal((await as(jboard, 'jboard', `/${id}`, 'PUT', { title: `${tag} renamed` })).status, 200)
        assert.equal((await as(jboard, 'jboard', `/${id}/quiz/edit`, 'GET')).status, 200)
        assert.equal((await as(jboard, 'jboard', `/${id}`, 'DELETE')).status, 403)
        assert.equal((await as(jboard, 'jboard', '', 'POST', { title: `${tag} new`, published: false })).status, 403)

        assert.equal((await as(jboard, 'jboard', `/${id}/rsvp`, 'POST')).status, 201)
        assert.equal(await statusOf(id, jboard), 'rsvped')
    } finally {
        server.close()
    }
})

test("a j-board member signed up for a lab can't run its attendance", { skip }, async () => {
    const attendee = await member()
    const staff = await member()
    for (const who of [attendee, staff]) {
        await prisma.member.update({ where: { userId: who }, data: { role: 'jboard' } })
    }
    const id = await lab()
    // opened to j-board: signing up doesn't take editing away, only the door
    await prisma.lab.update({ where: { labId: id }, data: { jboardCanEdit: true } })
    await join(id, attendee)

    const app = express()
    app.use(express.json())
    app.use((req, res, next) => { req.userId = Number(req.get('x-user')); req.role = 'jboard'; next() })
    app.use('/labs', labRoutes)
    const server = app.listen(0)
    const base = `http://localhost:${server.address().port}/labs/${id}`
    const as = (who, path, method = 'GET', body) => fetch(`${base}${path}`, {
        method,
        headers: { 'x-user': String(who), 'content-type': 'application/json' },
        body: body && JSON.stringify(body)
    })
    try {
        assert.equal((await as(attendee, '/roster')).status, 403)
        assert.equal((await as(attendee, '/attendance')).status, 403)
        assert.equal((await as(attendee, '/roster', 'POST', { action: 'checkin', memberId: attendee })).status, 403)
        assert.equal((await as(attendee, '/checkin', 'POST', { qrToken: 'x' })).status, 403)
        assert.equal((await as(attendee, '', 'PUT', { title: `${tag} renamed` })).status, 200)
        assert.equal(await statusOf(id, attendee), 'rsvped')

        // another j-board member, not signed up, runs the door as before
        assert.equal((await as(staff, '/roster')).status, 200)
        // (a dues prompt first if this year's dues are set — waived here)
        const tick = await as(staff, '/roster', 'POST', { action: 'checkin', memberId: attendee })
        if (tick.status === 202) {
            assert.equal((await as(staff, '/roster', 'POST', { action: 'checkin', memberId: attendee, dues: 'waive' })).status, 200)
        } else {
            assert.equal(tick.status, 200)
        }
        assert.equal(await statusOf(id, attendee), 'attended')
    } finally {
        server.close()
    }
})

test('a lab not taking sign-ups refuses new RSVPs but lets anyone on it cancel or take an offer', { skip }, async () => {
    const newcomer = await member()
    const going = await member()
    const offered = await member()
    const id = await lab()
    await join(id, going)
    await join(id, offered, 'offered')

    const app = express()
    app.use(express.json())
    app.use((req, res, next) => { req.userId = Number(req.get('x-user')); req.role = req.get('x-role') ?? 'member'; next() })
    app.use('/labs', labRoutes)
    const server = app.listen(0)
    const base = `http://localhost:${server.address().port}/labs/${id}`
    const as = (who, path, method, role, body) => fetch(`${base}${path}`, {
        method,
        headers: { 'x-user': String(who), ...(role ? { 'x-role': role } : {}), 'content-type': 'application/json' },
        body: body && JSON.stringify(body)
    })
    try {
        // only officers and up flip it
        assert.equal((await as(going, '/rsvps', 'PUT', 'jboard', { open: false })).status, 403)
        assert.equal((await as(going, '/rsvps', 'PUT', 'officer', { open: false })).status, 200)

        assert.equal((await as(newcomer, '/rsvp', 'POST')).status, 409)
        assert.equal(await statusOf(id, newcomer), null)
        assert.equal((await as(offered, '/rsvp', 'POST')).status, 201)
        assert.equal(await statusOf(id, offered), 'rsvped')
        assert.equal((await as(going, '/rsvp', 'DELETE')).status, 200)
        assert.equal(await statusOf(id, going), null)

        assert.equal((await as(going, '/rsvps', 'PUT', 'admin', { open: true })).status, 200)
        assert.equal((await as(newcomer, '/rsvp', 'POST')).status, 201)
    } finally {
        server.close()
    }
})

test('"start check-in" opens a lab before its start time, for its staff only', { skip }, async () => {
    const going = await member()
    const officer = await member()
    const id = await lab()
    await join(id, going)

    const app = express()
    app.use(express.json())
    app.use((req, res, next) => { req.userId = Number(req.get('x-user')); req.role = req.get('x-role') ?? 'member'; next() })
    app.use('/labs', labRoutes)
    const server = app.listen(0)
    const base = `http://localhost:${server.address().port}/labs/${id}`
    const as = (who, path, method, role, body) => fetch(`${base}${path}`, {
        method,
        headers: { 'x-user': String(who), ...(role ? { 'x-role': role } : {}), 'content-type': 'application/json' },
        body: body && JSON.stringify(body)
    })
    try {
        assert.equal((await (await as(going, '', 'GET')).json()).checkinOpen, false)

        // a member can't open the door, nor a j-board member signed up for it
        assert.equal((await as(going, '/checkin-open', 'PUT', null, { open: true })).status, 403)
        assert.equal((await as(going, '/checkin-open', 'PUT', 'jboard', { open: true })).status, 403)
        assert.equal((await as(officer, '/checkin-open', 'PUT', 'officer', { open: 'yes' })).status, 400)

        const opened = await as(officer, '/checkin-open', 'PUT', 'officer', { open: true })
        assert.equal(opened.status, 200)
        assert.equal((await opened.json()).checkinOpen, true)
        assert.equal((await (await as(going, '', 'GET')).json()).checkinOpen, true)

        await as(officer, '/checkin-open', 'PUT', 'officer', { open: false })
        assert.equal((await (await as(going, '', 'GET')).json()).checkinOpen, false)
    } finally {
        server.close()
    }
})
