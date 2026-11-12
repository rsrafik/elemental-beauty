// The feedback forms (src/feedback.js), against a real Postgres. Run with
// `npm test`; the database rules are the same as offers.test.js (its name has
// to contain "test"). Every row made here carries a per-run tag and is removed
// at the end.
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

let prisma, labRoutes, eventRoutes, feedbackRoutes, POINTS, endsAt, clubToday
const tag = `f${Date.now().toString(36)}`
const made = { users: [], labs: [], events: [] }

before(async () => {
    if (skip) { return }
    prisma = (await import('../src/prismaClient.js')).default
    labRoutes = (await import('../src/routes/labRoutes.js')).default
    eventRoutes = (await import('../src/routes/eventRoutes.js')).default
    feedbackRoutes = (await import('../src/routes/feedbackRoutes.js')).default
    ;({ POINTS } = await import('../src/points.js'))
    ;({ endsAt } = await import('../src/feedback.js'))
    ;({ clubToday } = await import('../src/clubTime.js'))
})

after(async () => {
    if (skip) { return }
    await prisma.lab.deleteMany({ where: { labId: { in: made.labs } } })
    await prisma.event.deleteMany({ where: { eventId: { in: made.events } } })
    await prisma.user.deleteMany({ where: { userId: { in: made.users } } })
    await prisma.$disconnect()
})

let counter = 0
async function person(role = 'member') {
    const n = counter++
    const user = await prisma.user.create({
        data: {
            username: `${tag}_${n}`,
            email: `${tag}_${n}@example.com`,
            passwordHash: 'x',
            firstName: `Secret${n}`,
            lastName: 'Person',
            emailVerified: true,
            waiverSigned: true,
            member: { create: { role } }
        }
    })
    made.users.push(user.userId)
    return user.userId
}

// a day relative to today on the club's clock, as a @db.Date
const day = (offset) => new Date(new Date(`${clubToday()}T00:00:00.000Z`).getTime() + offset * 86_400_000)

async function lab({ offset = -2, quiz = true } = {}) {
    const row = await prisma.lab.create({
        data: {
            title: `${tag} lab`,
            date: day(offset),
            startTime: '17:00',
            ...(quiz ? { quizQuestions: { create: { question: 'pH?', options: { create: [{ answerText: '7', isCorrect: true }] } } } } : {})
        }
    })
    made.labs.push(row.labId)
    return row.labId
}

async function event({ offset = -2 } = {}) {
    const row = await prisma.event.create({ data: { title: `${tag} event`, date: day(offset) } })
    made.events.push(row.eventId)
    return row.eventId
}

const attendLab = (memberId, labId, extra = {}) =>
    prisma.memberLab.create({ data: { memberId, labId, attendanceStatus: 'attended', quizPassed: true, ...extra } })
const attendEvent = (memberId, eventId, extra = {}) =>
    prisma.memberEvent.create({ data: { memberId, eventId, attendanceStatus: 'attended', ...extra } })
const pointsOf = async (userId) => (await prisma.member.findUnique({ where: { userId } })).points

// the real routes, behind a stand-in for the auth middleware
async function as(userId, role, run) {
    const app = express()
    app.use(express.json())
    app.use((req, res, next) => { req.userId = userId; req.role = role; next() })
    app.use('/labs', labRoutes)
    app.use('/events', eventRoutes)
    app.use('/feedback', feedbackRoutes)
    const server = app.listen(0)
    const base = `http://localhost:${server.address().port}`
    const call = (method, path, body) => fetch(`${base}${path}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined
    })
    try {
        return await run(call)
    } finally {
        server.close()
    }
}

test('a lab ends at its end time, or at the end of its day without one', { skip }, () => {
    const date = new Date('2026-10-01')
    assert.equal(endsAt({ date, endTime: '19:00' }).toISOString(), '2026-10-01T23:00:00.000Z')
    assert.equal(endsAt({ date, endTime: null }).toISOString(), '2026-10-02T04:00:00.000Z')
    assert.equal(endsAt({ date: null }), null)
})

test('someone who came to a lab and passed its quiz sends feedback once, edits it, and is paid once', { skip }, async () => {
    const member = await person()
    const labId = await lab()
    await attendLab(member, labId)
    const before = await pointsOf(member)

    await as(member, 'member', async (call) => {
        const mine = await (await call('GET', `/labs/${labId}/feedback/mine`)).json()
        assert.deepEqual(mine, { eligible: true, open: true, entry: null, points: POINTS.feedback })

        const first = await call('PUT', `/labs/${labId}/feedback/mine`, { body: '  loved it  ', name: '' })
        assert.equal(first.status, 200)
        assert.deepEqual(await first.json(), { entry: { body: 'loved it', name: null }, awarded: POINTS.feedback })
        assert.equal(await pointsOf(member), before + POINTS.feedback)

        const again = await call('PUT', `/labs/${labId}/feedback/mine`, { body: 'loved it, more glitter', name: 'Sam' })
        assert.deepEqual(await again.json(), { entry: { body: 'loved it, more glitter', name: 'Sam' }, awarded: 0 })
        assert.equal(await pointsOf(member), before + POINTS.feedback)

        const prefill = await (await call('GET', `/labs/${labId}/feedback/mine`)).json()
        assert.deepEqual(prefill.entry, { body: 'loved it, more glitter', name: 'Sam' })
    })
    assert.equal(await prisma.labFeedback.count({ where: { labId } }), 1)
})

test('feedback is refused to anyone who didn\'t come, or hasn\'t passed the quiz', { skip }, async () => {
    const labId = await lab()
    const rsvped = await person()
    const failed = await person()
    const stranger = await person()
    await prisma.memberLab.create({ data: { memberId: rsvped, labId, attendanceStatus: 'rsvped' } })
    await attendLab(failed, labId, { quizPassed: false })

    for (const who of [rsvped, failed, stranger]) {
        await as(who, 'member', async (call) => {
            assert.equal((await (await call('GET', `/labs/${labId}/feedback/mine`)).json()).eligible, false)
            assert.equal((await call('PUT', `/labs/${labId}/feedback/mine`, { body: 'hi' })).status, 403)
        })
    }

    // a lab with no quiz has nothing to pass
    const noQuiz = await lab({ quiz: false })
    const came = await person()
    await attendLab(came, noQuiz, { quizPassed: null })
    await as(came, 'member', async (call) => {
        assert.equal((await call('PUT', `/labs/${noQuiz}/feedback/mine`, { body: 'hi' })).status, 200)
    })
})

test('an empty entry is refused', { skip }, async () => {
    const member = await person()
    const labId = await lab()
    await attendLab(member, labId)
    await as(member, 'member', async (call) => {
        assert.equal((await call('PUT', `/labs/${labId}/feedback/mine`, { body: '   ' })).status, 400)
        assert.equal((await call('PUT', `/labs/${labId}/feedback/mine`, {})).status, 400)
    })
})

test('before it ends, feedback waits for an officer to release it', { skip }, async () => {
    const member = await person()
    const officer = await person('officer')
    const eventId = await event({ offset: 0 })
    await attendEvent(member, eventId)

    await as(member, 'member', async (call) => {
        assert.equal((await (await call('GET', `/events/${eventId}/feedback/mine`)).json()).open, false)
        assert.equal((await call('PUT', `/events/${eventId}/feedback/mine`, { body: 'great' })).status, 403)
        // and a member can't release it themselves
        assert.equal((await call('PUT', `/events/${eventId}/feedback-release`, { released: true })).status, 403)
    })
    await as(officer, 'officer', async (call) => {
        const res = await call('PUT', `/events/${eventId}/feedback-release`, { released: true })
        assert.equal(res.status, 200)
        assert.equal((await res.json()).open, true)
    })
    await as(member, 'member', async (call) => {
        assert.equal((await call('PUT', `/events/${eventId}/feedback/mine`, { body: 'great' })).status, 200)
    })
})

test('only someone checked in can give feedback on an event', { skip }, async () => {
    const eventId = await event()
    const rsvped = await person()
    await prisma.memberEvent.create({ data: { memberId: rsvped, eventId } })
    await as(rsvped, 'member', async (call) => {
        assert.equal((await call('PUT', `/events/${eventId}/feedback/mine`, { body: 'hi' })).status, 403)
    })
})

test('staff see every entry and never who wrote it, unless they signed it', { skip }, async () => {
    const eventId = await event()
    const anon = await person()
    const named = await person()
    const officer = await person('officer')
    await attendEvent(anon, eventId)
    await attendEvent(named, eventId)

    await as(anon, 'member', (call) => call('PUT', `/events/${eventId}/feedback/mine`, { body: 'too short' }))
    await as(named, 'member', (call) => call('PUT', `/events/${eventId}/feedback/mine`, { body: 'perfect', name: 'Jo' }))

    await as(officer, 'officer', async (call) => {
        const res = await call('GET', `/events/${eventId}/feedback`)
        assert.equal(res.status, 200)
        const text = await res.text()
        const { entries } = JSON.parse(text)
        assert.deepEqual(
            entries.map((entry) => entry).sort((a, b) => a.body.localeCompare(b.body)),
            [{ body: 'perfect', name: 'Jo' }, { body: 'too short', name: null }]
        )
        // each entry is the text and the name they chose, nothing else — no
        // id, username or real name anywhere in the answer
        assert.ok(!text.includes(`${tag}_`), 'no username')
        assert.ok(!text.includes('Secret'), 'no real name')
        assert.ok(!/member|user/i.test(text), 'no member or user field')
    })
    await as(anon, 'member', async (call) => {
        assert.equal((await call('GET', `/events/${eventId}/feedback`)).status, 403)
    })
})

test('the site asks about each lab or event once, and not after feedback is in', { skip }, async () => {
    const member = await person()
    const labId = await lab({ offset: -1 })
    const eventId = await event({ offset: -3 })
    const old = await event({ offset: -40 })
    const ahead = await event({ offset: 5 })
    await attendLab(member, labId)
    await attendEvent(member, eventId)
    await attendEvent(member, old)
    await attendEvent(member, ahead)

    await as(member, 'member', async (call) => {
        const pending = async () => (await (await call('GET', '/feedback/pending')).json())
            .filter((row) => (row.kind === 'lab' ? made.labs : made.events).includes(row.id))
            .map((row) => `${row.kind}:${row.id}`)

        // newest first; the one from last month and the one still ahead aren't asked about
        assert.deepEqual(await pending(), [`lab:${labId}`, `event:${eventId}`])

        assert.equal((await call('POST', `/labs/${labId}/feedback/asked`)).status, 204)
        assert.deepEqual(await pending(), [`event:${eventId}`])

        await call('PUT', `/events/${eventId}/feedback/mine`, { body: 'fun' })
        assert.deepEqual(await pending(), [])
    })
})
