// The calendar subscription and its feed, against a real Postgres. Run with
// `npm test`; the database rules are the same as events.test.js (its name has
// to contain "test"). Every row made here carries a per-run tag and is removed
// at the end. The ICS formatting tests at the bottom need no database.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import jwt from 'jsonwebtoken'

process.env.GMAIL_USER = ''
process.env.GMAIL_APP_PASSWORD = ''
process.env.RESEND_API_KEY = ''
process.env.JWT_SECRET ||= 'test-jwt-secret'
process.env.QR_SECRET ||= 'test-qr-secret'

const url = process.env.DATABASE_URL ?? ''
const skip = !/test/i.test(url.split('/').pop() ?? '')
    ? 'DATABASE_URL must point at a database with "test" in its name'
    : false

let prisma, calendarRoutes, feedRouter, authMiddleware, feedToken
const tag = `c${Date.now().toString(36)}`
const made = { users: [], events: [], labs: [] }

before(async () => {
    if (skip) { return }
    prisma = (await import('../src/prismaClient.js')).default
    const routes = await import('../src/routes/calendarRoutes.js')
    calendarRoutes = routes.default
    feedRouter = routes.feedRouter
    feedToken = routes.feedToken
    authMiddleware = (await import('../src/middleware/authMiddleware.js')).default
})

after(async () => {
    if (skip) { return }
    await prisma.event.deleteMany({ where: { eventId: { in: made.events } } })
    await prisma.lab.deleteMany({ where: { labId: { in: made.labs } } })
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

// far enough ahead to be inside the feed's window whenever this runs
const DAY = new Date('2030-01-15')

// Each test titles its rows with a prefix of its own (scope()), so one test's
// events never show up on the next one's feed.
let scopes = 0
const scope = () => `${tag}s${scopes++}`

async function event(prefix, track, extra = {}) {
    const row = await prisma.event.create({
        data: { title: `${prefix} ${extra.title ?? track}`, date: DAY, track, ...extra, title: `${prefix} ${extra.title ?? track}` }
    })
    made.events.push(row.eventId)
    return row.eventId
}

async function lab(prefix, published) {
    const row = await prisma.lab.create({
        data: { title: `${prefix} lab ${published ? 'published' : 'draft'}`, date: DAY, published }
    })
    made.labs.push(row.labId)
    return row.labId
}

// The routes as server.js mounts them: the feed in the open, the popup's
// behind a stand-in for the auth middleware (role read fresh, like the real one).
async function serve(run) {
    const app = express()
    app.use(express.json())
    app.use('/feed', feedRouter)
    app.use('/calendar', async (req, res, next) => {
        req.userId = Number(req.headers['x-user'])
        req.role = (await prisma.member.findUnique({ where: { userId: req.userId } })).role
        next()
    }, calendarRoutes)
    app.get('/whoami', authMiddleware, (req, res) => res.json({ userId: req.userId }))
    const server = app.listen(0)
    const base = `http://localhost:${server.address().port}`
    try {
        return await run(base)
    } finally {
        server.close()
    }
}

const call = (base, userId, method, body) => fetch(`${base}/calendar/subscription`, {
    method,
    headers: { 'x-user': String(userId), 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
})
const feed = async (base, userId) => {
    const res = await fetch(`${base}/feed/${feedToken(userId)}.ics`)
    return { status: res.status, type: res.headers.get('content-type'), text: await res.text() }
}
// which of this test's rows are on a feed, by title
const ours = (text, prefix) => text.split('\r\n').filter((line) => line.startsWith(`SUMMARY:${prefix} `)).map((line) => line.slice(`SUMMARY:${prefix} `.length)).sort()

test('a member is offered online, open and members, and can’t save a board track', { skip }, async () => {
    const p = scope()
    const member = await person('member')
    await serve(async (base) => {
        const first = await (await call(base, member, 'GET')).json()
        assert.equal(first.subscribed, false)
        assert.deepEqual([...first.available].sort(), ['members', 'online', 'open'])
        assert.deepEqual([...first.tracks].sort(), ['members', 'online', 'open'])
        assert.match(first.googleUrl, /^https:\/\/calendar\.google\.com\/calendar\/render\?cid=webcal%3A%2F%2F/)

        assert.equal((await call(base, member, 'PUT', { tracks: ['open', 'board'] })).status, 400)
        assert.equal((await call(base, member, 'PUT', { tracks: [] })).status, 400)
        assert.equal((await call(base, member, 'PUT', { tracks: ['nope'] })).status, 400)
    })
})

test('a member’s feed has only their picked tracks and published labs — no drafts, no board', { skip }, async () => {
    const p = scope()
    const member = await person('member')
    for (const track of ['members', 'officers', 'open', 'online', 'board', 'jboard']) { await event(p, track) }
    await lab(p, true)
    await lab(p, false)

    await serve(async (base) => {
        assert.equal((await call(base, member, 'PUT', { tracks: ['members', 'online', 'open'] })).status, 200)
        const { status, type, text } = await feed(base, member)
        assert.equal(status, 200)
        assert.match(type, /^text\/calendar/)
        assert.match(text, /X-WR-CALNAME:Elemental Beauty/)
        assert.match(text, /X-APPLE-CALENDAR-COLOR:#AD1457/)
        assert.deepEqual(ours(text, p), ['lab published', 'members', 'online', 'open'])
    })
})

test('an admin can pick every track, and the feed follows a change of picks at the same address', { skip }, async () => {
    const p = scope()
    const admin = await person('admin')
    for (const track of ['members', 'officers', 'open', 'online', 'board', 'jboard']) { await event(p, track) }

    await serve(async (base) => {
        const offered = await (await call(base, admin, 'GET')).json()
        assert.equal(offered.available.length, 6)

        const all = await (await call(base, admin, 'PUT', { tracks: offered.available })).json()
        assert.equal(all.subscribed, true)
        assert.deepEqual(ours((await feed(base, admin)).text, p).filter((t) => !t.startsWith('lab')),
            ['board', 'jboard', 'members', 'officers', 'online', 'open'])

        const fewer = await (await call(base, admin, 'PUT', { tracks: ['board'] })).json()
        assert.equal(fewer.url, all.url, 'the feed address never changes')
        assert.deepEqual(ours((await feed(base, admin)).text, p), ['board'])
    })
})

test('a demotion drops the board tracks from the feed, and leaving none gives an empty calendar', { skip }, async () => {
    const p = scope()
    const officer = await person('officer')
    await event(p, 'board')
    await event(p, 'open')

    await serve(async (base) => {
        await call(base, officer, 'PUT', { tracks: ['board', 'open'] })
        assert.deepEqual(ours((await feed(base, officer)).text, p), ['board', 'open'])

        await prisma.member.update({ where: { userId: officer }, data: { role: 'member' } })
        assert.deepEqual(ours((await feed(base, officer)).text, p), ['open'])
        const reply = await (await call(base, officer, 'GET')).json()
        assert.deepEqual(reply.tracks, ['open'])
        assert.deepEqual(reply.lost, ['board'])

        await prisma.member.update({ where: { userId: officer }, data: { role: 'officer' } })
        await call(base, officer, 'PUT', { tracks: ['board'] })
        await prisma.member.update({ where: { userId: officer }, data: { role: 'member' } })
        const empty = await feed(base, officer)
        assert.equal(empty.status, 200)
        assert.match(empty.text, /BEGIN:VCALENDAR[\s\S]*END:VCALENDAR/)
        assert.doesNotMatch(empty.text, /BEGIN:VEVENT/)
    })
})

test('a j-board member’s feed has their team’s j-board events, not another team’s', { skip }, async () => {
    const p = scope()
    const jboard = await person('jboard')
    await prisma.member.update({ where: { userId: jboard }, data: { jboardTeams: ['formula'] } })
    await event(p, 'jboard', { team: 'formula', title: 'formula' })
    await event(p, 'jboard', { team: 'treasury', title: 'treasury' })
    await event(p, 'jboard', { title: 'everyone' })

    await serve(async (base) => {
        const offered = await (await call(base, jboard, 'GET')).json()
        assert.ok(!offered.available.includes('officers'))
        await call(base, jboard, 'PUT', { tracks: ['jboard'] })
        assert.deepEqual(ours((await feed(base, jboard)).text, p), ['everyone', 'formula'])
    })
})

test('stop syncing empties the feed and resets the button', { skip }, async () => {
    const p = scope()
    const member = await person('member')
    await event(p, 'open')
    await serve(async (base) => {
        await call(base, member, 'PUT', { tracks: ['open'] })
        assert.deepEqual(ours((await feed(base, member)).text, p), ['open'])
        const reply = await (await call(base, member, 'DELETE')).json()
        assert.equal(reply.subscribed, false)
        assert.doesNotMatch((await feed(base, member)).text, /BEGIN:VEVENT/)
    })
})

test('a gone member gets an empty calendar, a forged link a 404', { skip }, async () => {
    const p = scope()
    const member = await person('member')
    await event(p, 'open')
    await serve(async (base) => {
        await call(base, member, 'PUT', { tracks: ['open'] })
        await prisma.user.delete({ where: { userId: member } })
        const gone = await feed(base, member)
        assert.equal(gone.status, 200)
        assert.doesNotMatch(gone.text, /BEGIN:VEVENT/)

        const forged = jwt.sign({ purpose: 'calendar', uid: member }, 'not-the-secret', { noTimestamp: true })
        assert.equal((await fetch(`${base}/feed/${forged}.ics`)).status, 404)
        // a sign-in token isn't a feed link either
        const login = jwt.sign({ id: member }, process.env.JWT_SECRET)
        assert.equal((await fetch(`${base}/feed/${login}.ics`)).status, 404)
    })
})

test('the feed leaves out cover images, and meeting links off tracks that don’t take one', { skip }, async () => {
    const p = scope()
    const admin = await person('admin')
    await event(p, 'online', { meetingUrl: 'https://zoom.us/j/123', image: 'data:image/png;base64,AAAA' })
    await event(p, 'members', { meetingUrl: 'https://zoom.us/j/999' })
    await serve(async (base) => {
        await call(base, admin, 'PUT', { tracks: ['online', 'members'] })
        const { text } = await feed(base, admin)
        assert.doesNotMatch(text, /base64/)
        assert.match(text, /Join: https:\/\/zoom\.us\/j\/123/)
        assert.doesNotMatch(text, /zoom\.us\/j\/999/)
    })
})

test('a feed link can’t be used to sign in', { skip }, async () => {
    const p = scope()
    const member = await person('member')
    await serve(async (base) => {
        const asLogin = await fetch(`${base}/whoami`, { headers: { authorization: `Bearer ${feedToken(member)}` } })
        assert.equal(asLogin.status, 401)
        const real = await fetch(`${base}/whoami`, { headers: { authorization: `Bearer ${jwt.sign({ id: member }, process.env.JWT_SECRET)}` } })
        assert.equal(real.status, 200)
    })
})

test('the advisor may save their own calendar picks', async () => {
    const { advisorMayDo } = await import('../src/middleware/advisor.js')
    assert.equal(advisorMayDo('PUT', '/api/calendar/subscription'), true)
    assert.equal(advisorMayDo('DELETE', '/api/calendar/subscription'), true)
    assert.equal(advisorMayDo('PUT', '/api/events/4'), false)
})

test('ICS text is escaped, folded at 75 octets without splitting a character, and timed in UTC', async () => {
    const { buildCalendar, escapeText, foldLine } = await import('../src/calendarFeed.js')
    assert.equal(escapeText('a, b; c\\d\r\ne'), 'a\\, b\\; c\\\\d\\ne')

    const long = `SUMMARY:${'💄'.repeat(40)}`
    const folded = foldLine(long)
    for (const line of folded.split('\r\n')) { assert.ok(Buffer.byteLength(line) <= 75) }
    assert.equal(folded.split('\r\n').map((line, i) => (i ? line.slice(1) : line)).join(''), long)

    const text = buildCalendar([
        { uid: 'event-1', title: 'GBM', day: '2026-10-01', startTime: '17:30', endTime: null },
        { uid: 'event-2', title: 'Dues due', day: '2026-12-31', startTime: null },
    ])
    // 5:30pm EDT is 21:30 UTC, and no end time means an hour
    assert.match(text, /DTSTART:20261001T213000Z\r\nDTEND:20261001T223000Z/)
    // an all-day one ends the next day, across the year
    assert.match(text, /DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101/)
    assert.ok(text.endsWith('END:VCALENDAR\r\n'))
})
