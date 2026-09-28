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

test('a plain member sees no officers, EB board or j-board events, by list, by id or by RSVP', { skip }, async () => {
    const member = await person('member')
    await event('members')
    const officers = await event('officers')
    const board = await event('board')
    const jboard = await event('jboard')

    await as(member, 'member', async (base) => {
        assert.deepEqual(mine(await (await fetch(base)).json()), ['members'])
        assert.equal((await fetch(`${base}/${board}`)).status, 404)
        assert.equal((await fetch(`${base}/${officers}`)).status, 404)
        assert.equal((await fetch(`${base}/${jboard}`)).status, 404)
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

test('j-board sees j-board events but not officers ones; officers see both', { skip }, async () => {
    const jb = await person('jboard')
    const officer = await person('officer')
    const officers = await event('officers')
    const jboard = await event('jboard')

    await as(jb, 'jboard', async (base) => {
        const tracks = mine(await (await fetch(base)).json())
        assert.ok(tracks.includes('jboard'))
        assert.ok(!tracks.includes('officers'))
        assert.equal((await fetch(`${base}/${jboard}`)).status, 200)
        assert.equal((await fetch(`${base}/${officers}`)).status, 404)
        assert.equal((await fetch(`${base}/${officers}`, { method: 'DELETE' })).status, 404)
    })
    await as(officer, 'officer', async (base) => {
        const tracks = mine(await (await fetch(base)).json())
        assert.ok(tracks.includes('officers'))
        assert.ok(tracks.includes('jboard'))
        assert.equal((await fetch(`${base}/${jboard}`)).status, 200)
    })
})

test('treasurer and admin see both officers and j-board events', { skip }, async () => {
    await event('officers')
    await event('jboard')
    for (const role of ['treasurer', 'admin']) {
        const who = await person(role)
        await as(who, role, async (base) => {
            const tracks = mine(await (await fetch(base)).json())
            assert.ok(tracks.includes('officers') && tracks.includes('jboard'), role)
        })
    }
})

test("j-board can't file an officers event; officers and j-board can both file j-board ones", { skip }, async () => {
    const officer = await person('officer')
    const jb = await person('jboard')
    const post = (base, track) => fetch(base, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: `${tag} ${track}`, type: 'official', date: '2030-02-01', track })
    })

    await as(officer, 'officer', async (base) => {
        const reply = await post(base, 'jboard')
        assert.equal(reply.status, 201)
        made.events.push((await reply.json()).eventId)
    })
    await as(jb, 'jboard', async (base) => {
        assert.equal((await post(base, 'officers')).status, 403)
        const reply = await post(base, 'jboard')
        assert.equal(reply.status, 201)
        made.events.push((await reply.json()).eventId)
    })
})

test('"hide from events" is saved on create and edit, and must be a boolean', { skip }, async () => {
    const officer = await person('officer')
    await as(officer, 'officer', async (base) => {
        const send = (method, url, body) => fetch(url, {
            method,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body)
        })
        const reply = await send('POST', base, { title: `${tag} hidden`, type: 'social', date: '2030-03-01', hideFromEvents: true })
        assert.equal(reply.status, 201)
        const created = await reply.json()
        made.events.push(created.eventId)
        assert.equal(created.hideFromEvents, true)

        const edited = await send('PUT', `${base}/${created.eventId}`, { hideFromEvents: false })
        assert.equal((await edited.json()).hideFromEvents, false)
        assert.equal((await send('PUT', `${base}/${created.eventId}`, { hideFromEvents: 'yes' })).status, 400)
    })
})

test('a j-board event an officer, treasurer or admin added is read-only to j-board', { skip }, async () => {
    const jb = await person('jboard')
    const put = (base, id) => fetch(`${base}/${id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: `${tag} renamed` })
    })

    for (const role of ['officer', 'treasurer', 'admin']) {
        const creator = await person(role)
        const id = await as(creator, role, async (base) => {
            const reply = await fetch(base, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ title: `${tag} by ${role}`, type: 'official', date: '2030-04-01', track: 'jboard' })
            })
            const created = await reply.json()
            made.events.push(created.eventId)
            assert.equal(created.canEdit, true, `${role} can edit their own`)
            return created.eventId
        })

        await as(jb, 'jboard', async (base) => {
            const row = await (await fetch(`${base}/${id}`)).json()
            assert.equal(row.canEdit, false, `${role}'s event, by id`)
            assert.ok(row.creatorName, 'the popup has a name to show')
            const listed = (await (await fetch(base)).json()).find((event) => event.eventId === id)
            assert.equal(listed.canEdit, false, `${role}'s event, in the list`)
            assert.equal((await put(base, id)).status, 403)
            assert.equal((await fetch(`${base}/${id}`, { method: 'DELETE' })).status, 403)
        })
    }

    // j-board's own j-board event, and one with no creator on record, stay theirs
    const own = await as(jb, 'jboard', async (base) => {
        const reply = await fetch(base, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ title: `${tag} by jboard`, type: 'official', date: '2030-04-01', track: 'jboard' })
        })
        const created = await reply.json()
        made.events.push(created.eventId)
        return created.eventId
    })
    const legacy = await event('jboard')
    await as(jb, 'jboard', async (base) => {
        assert.equal((await put(base, own)).status, 200)
        assert.equal((await put(base, legacy)).status, 200)
    })
})

test('a j-board event has a team instead of a seat cap; any other event has no team', { skip }, async () => {
    const officer = await person('officer')
    await as(officer, 'officer', async (base) => {
        const post = (body) => fetch(base, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ title: `${tag} team`, type: 'official', date: '2030-03-01', ...body })
        })
        const jboard = await (await post({ track: 'jboard', team: 'social_media', capacity: 12 })).json()
        made.events.push(jboard.eventId)
        assert.equal(jboard.team, 'social_media')
        assert.equal(jboard.capacity, null)

        const members = await (await post({ track: 'members', team: 'formula', capacity: 12 })).json()
        made.events.push(members.eventId)
        assert.equal(members.team, null)
        assert.equal(members.capacity, 12)

        assert.equal((await post({ track: 'jboard', team: 'marketing' })).status, 400)

        // officers and EB board events have neither
        const board = await (await post({ track: 'board', team: 'formula', capacity: 12 })).json()
        made.events.push(board.eventId)
        assert.equal(board.capacity, null)
        assert.equal(board.team, null)

        // moved off j-board, it loses its team
        const moved = await (await fetch(`${base}/${jboard.eventId}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ track: 'board' })
        })).json()
        assert.equal(moved.team, null)
    })
})
