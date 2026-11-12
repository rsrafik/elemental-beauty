// The landing page's content: the people, the album's cards and the sponsors'
// pills an admin keeps on /landing-editor, what the public page reads, and the
// pictures a signed-out visitor can load — against a real Postgres. Same rules
// as events.test.js: the database's name has to contain "test", and every row
// made here is removed at the end.
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

// a 1×1 PNG, the smallest picture there is
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

let prisma, landing, sponsors, imageRoutes, imageAuth, requireRole
const tag = `l${Date.now().toString(36)}`
const made = { users: [] }

before(async () => {
    if (skip) { return }
    prisma = (await import('../src/prismaClient.js')).default
    landing = await import('../src/routes/landingRoutes.js')
    sponsors = await import('../src/routes/sponsorRoutes.js')
    const images = await import('../src/routes/imageRoutes.js')
    imageRoutes = images.default
    imageAuth = images.imageAuth
    requireRole = (await import('../src/middleware/requireRole.js')).default
})

after(async () => {
    if (skip) { return }
    const tagged = { startsWith: tag }
    await prisma.landingPerson.deleteMany({ where: { title: tagged } })
    await prisma.albumCard.deleteMany({ where: { title: tagged } })
    await prisma.sponsor.deleteMany({ where: { OR: [{ landingTitle: tagged }, { companyName: tagged }, { website: { contains: tag } }] } })
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
            firstName: tag,
            lastName: `P${n}`,
            emailVerified: true,
            waiverSigned: true,
            member: { create: { role } }
        }
    })
    made.users.push(user.userId)
    return user.userId
}

// the routes as server.js mounts them: the public read on its own, the rest
// behind requireRole('admin') (with a stand-in for authMiddleware), and the
// pictures behind the real imageAuth. The sponsors page's routes
// (sponsorRoutes.js, tested in sponsors.test.js) are beside them, for how a
// sponsor sent in on the form becomes a pill.
async function serve(role, run) {
    const app = express()
    app.use(express.json({ limit: '15mb' }))
    app.use('/api/img', imageAuth, imageRoutes)
    app.use('/api/landing', landing.publicRouter)
    app.use('/api/sponsors', sponsors.publicRouter)
    const signedIn = (req, res, next) => { req.userId = 0; req.role = role; next() }
    app.use('/api/landing', signedIn, requireRole('admin'), landing.default)
    app.use('/api/sponsors', signedIn, requireRole('admin'), sponsors.default)
    const server = app.listen(0)
    try {
        return await run(`http://localhost:${server.address().port}`)
    } finally {
        server.close()
    }
}

const admin = (run) => serve('admin', run)

const send = (url, method, body, headers = {}) => fetch(url, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body)
})

const publicPage = async (base) => {
    const response = await fetch(`${base}/api/landing`)
    assert.equal(response.status, 200)
    return response.json()
}

test('a person needs a title; the rest is optional, and the public page lists them in order', { skip }, async () => {
    await admin(async (base) => {
        const untitled = await send(`${base}/api/landing/people`, 'POST', { name: 'Ada' })
        assert.equal(untitled.status, 400)

        const first = await (await send(`${base}/api/landing/people`, 'POST', { title: `${tag} President`, name: '  Ada Lovelace ', description: 'Makes serums.', image: PNG })).json()
        assert.equal(first.name, 'Ada Lovelace')
        assert.match(first.imageUrl, new RegExp(`^/api/img/person/${first.personId}/[0-9a-f]{12}$`))

        const second = await send(`${base}/api/landing/people`, 'POST', { title: `${tag} Treasurer`, name: '', description: '   ' })
        assert.equal(second.status, 201)
        const bare = await second.json()
        assert.equal(bare.name, null)
        assert.equal(bare.description, null)
        assert.equal(bare.imageUrl, null)
        assert.ok(bare.position > first.position)

        const shown = (await publicPage(base)).people.filter((row) => row.title.startsWith(tag))
        assert.deepEqual(shown.map((row) => row.personId), [first.personId, bare.personId])
    })
})

test('editing a person keeps their picture when its address is sent back, and null takes it off', { skip }, async () => {
    await admin(async (base) => {
        const row = await (await send(`${base}/api/landing/people`, 'POST', { title: `${tag} Lab lead`, image: PNG })).json()

        const kept = await (await send(`${base}/api/landing/people/${row.personId}`, 'PUT', { title: `${tag} Lab lead`, name: 'Bea', image: row.imageUrl })).json()
        assert.equal(kept.imageUrl, row.imageUrl)
        assert.equal(kept.name, 'Bea')

        const cleared = await (await send(`${base}/api/landing/people/${row.personId}`, 'PUT', { title: `${tag} Lab lead`, image: null })).json()
        assert.equal(cleared.imageUrl, null)

        assert.equal((await send(`${base}/api/landing/people/${row.personId}`, 'PUT', { title: `${tag} x`, image: 'data:text/html;base64,PGI+' })).status, 400)
        assert.equal((await send(`${base}/api/landing/people/999999999`, 'PUT', { title: `${tag} x` })).status, 404)
    })
})

test('the people can be put in a new order, which has to name every one of them once', { skip }, async () => {
    await admin(async (base) => {
        const a = await (await send(`${base}/api/landing/people`, 'POST', { title: `${tag} A` })).json()
        const b = await (await send(`${base}/api/landing/people`, 'POST', { title: `${tag} B` })).json()
        const everyone = (await (await fetch(`${base}/api/landing/admin`)).json()).people.map((row) => row.personId)

        assert.equal((await send(`${base}/api/landing/people/order`, 'PUT', { ids: [a.personId] })).status, 400)
        assert.equal((await send(`${base}/api/landing/people/order`, 'PUT', { ids: [...everyone, everyone[0]] })).status, 400)

        const reversed = [...everyone].reverse()
        const after = await (await send(`${base}/api/landing/people/order`, 'PUT', { ids: reversed })).json()
        assert.deepEqual(after.map((row) => row.personId), reversed)
        const shown = (await publicPage(base)).people.map((row) => row.personId)
        assert.ok(shown.indexOf(b.personId) < shown.indexOf(a.personId))

        assert.equal((await send(`${base}/api/landing/people/${a.personId}`, 'DELETE')).status, 200)
        assert.ok(!(await publicPage(base)).people.some((row) => row.personId === a.personId))
    })
})

test('an album card needs a title and a photo, and its photo can be changed but not taken off', { skip }, async () => {
    await admin(async (base) => {
        assert.equal((await send(`${base}/api/landing/album`, 'POST', { title: `${tag} Callout` })).status, 400)
        assert.equal((await send(`${base}/api/landing/album`, 'POST', { image: PNG })).status, 400)
        assert.equal((await send(`${base}/api/landing/album`, 'POST', { title: `${tag} Callout`, image: PNG, date: 'Oct 3' })).status, 400)

        const created = await send(`${base}/api/landing/album`, 'POST', { title: `${tag} Callout`, image: PNG, date: '2026-10-03', description: '' })
        assert.equal(created.status, 201)
        const card = await created.json()
        assert.equal(card.date, '2026-10-03')
        assert.equal(card.description, null)
        assert.match(card.imageUrl, /^\/api\/img\/album\//)

        // the address sent back is the photo it has
        const edited = await (await send(`${base}/api/landing/album/${card.cardId}`, 'PUT', { title: `${tag} Fall callout`, image: card.imageUrl, date: null })).json()
        assert.equal(edited.title, `${tag} Fall callout`)
        assert.equal(edited.imageUrl, card.imageUrl)
        assert.equal(edited.date, null)
        assert.equal((await send(`${base}/api/landing/album/${card.cardId}`, 'PUT', { title: `${tag} Fall callout`, image: null })).status, 400)

        const shown = (await publicPage(base)).album.find((row) => row.cardId === card.cardId)
        assert.equal(shown.title, `${tag} Fall callout`)

        assert.equal((await send(`${base}/api/landing/album/${card.cardId}`, 'DELETE')).status, 200)
        assert.ok(!(await publicPage(base)).album.some((row) => row.cardId === card.cardId))
    })
})

test('a new album card goes on the front of the deck, and the cards and pills keep the order they are dragged into', { skip }, async () => {
    await admin(async (base) => {
        const older = await (await send(`${base}/api/landing/album`, 'POST', { title: `${tag} Older`, image: PNG })).json()
        const newer = await (await send(`${base}/api/landing/album`, 'POST', { title: `${tag} Newer`, image: PNG })).json()
        let deck = (await publicPage(base)).album.map((row) => row.cardId)
        assert.ok(deck.indexOf(newer.cardId) < deck.indexOf(older.cardId))

        const everyCard = (await (await fetch(`${base}/api/landing/admin`)).json()).album.map((row) => row.cardId)
        // an order has to name every card
        assert.equal((await send(`${base}/api/landing/album/order`, 'PUT', { ids: [newer.cardId] })).status, 400)
        const moved = [older.cardId, ...everyCard.filter((id) => id !== older.cardId)]
        const after = await (await send(`${base}/api/landing/album/order`, 'PUT', { ids: moved })).json()
        assert.deepEqual(after.map((row) => row.cardId), moved)
        deck = (await publicPage(base)).album.map((row) => row.cardId)
        assert.ok(deck.indexOf(older.cardId) < deck.indexOf(newer.cardId))

        const a = await (await send(`${base}/api/landing/sponsors`, 'POST', { title: `${tag} First` })).json()
        const b = await (await send(`${base}/api/landing/sponsors`, 'POST', { title: `${tag} Second` })).json()
        const everyPill = (await (await fetch(`${base}/api/landing/admin`)).json()).sponsors.map((row) => row.sponsorId)
        assert.ok(everyPill.indexOf(a.sponsorId) < everyPill.indexOf(b.sponsorId))
        // a sponsor that isn't on the page isn't part of the order
        const offPage = await prisma.sponsor.create({ data: { companyName: `${tag} Off page` } })
        assert.equal((await send(`${base}/api/landing/sponsors/order`, 'PUT', { ids: [...everyPill, offPage.sponsorId] })).status, 400)
        const pills = await (await send(`${base}/api/landing/sponsors/order`, 'PUT', { ids: [...everyPill].reverse() })).json()
        assert.deepEqual(pills.map((row) => row.sponsorId), [...everyPill].reverse())
        const shown = (await publicPage(base)).sponsors.map((row) => row.sponsorId)
        assert.ok(shown.indexOf(b.sponsorId) < shown.indexOf(a.sponsorId))
    })
})

test('a sponsor pill needs a title or a picture; its website is made a link, and nonsense is refused', { skip }, async () => {
    await admin(async (base) => {
        assert.equal((await send(`${base}/api/landing/sponsors`, 'POST', { website: `${tag}.com` })).status, 400)
        assert.equal((await send(`${base}/api/landing/sponsors`, 'POST', { title: `${tag} Bad`, website: 'javascript:alert(1)' })).status, 400)
        assert.equal((await send(`${base}/api/landing/sponsors`, 'POST', { title: `${tag} Bad`, website: 'not a site' })).status, 400)

        const titled = await (await send(`${base}/api/landing/sponsors`, 'POST', { title: `${tag} Acme`, website: `${tag}.example.com/about` })).json()
        assert.equal(titled.website, `https://${tag}.example.com/about`)
        assert.equal(titled.status, 'active')
        assert.equal(titled.source, 'manual')
        assert.equal(titled.shown, true)

        const pictured = await send(`${base}/api/landing/sponsors`, 'POST', { image: PNG })
        assert.equal(pictured.status, 201)
        const logo = await pictured.json()
        assert.equal(logo.title, null)
        assert.match(logo.imageUrl, /^\/api\/img\/sponsor\//)

        // its picture is kept, so the title can go; both can't
        assert.equal((await send(`${base}/api/landing/sponsors/${logo.sponsorId}`, 'PUT', { title: '', image: logo.imageUrl, website: `${tag}.example.org` })).status, 200)
        assert.equal((await send(`${base}/api/landing/sponsors/${logo.sponsorId}`, 'PUT', { title: '', image: null })).status, 400)
        assert.equal((await send(`${base}/api/landing/sponsors/${titled.sponsorId}`, 'PUT', { title: '' })).status, 400)

        const pills = (await publicPage(base)).sponsors
        const shown = pills.find((pill) => pill.sponsorId === titled.sponsorId)
        assert.deepEqual(shown, { sponsorId: titled.sponsorId, title: `${tag} Acme`, website: `https://${tag}.example.com/about`, imageUrl: null })
        assert.ok(pills.some((pill) => pill.sponsorId === logo.sponsorId))

        // a pill that was only ever a pill is gone once it's taken off
        const removed = await (await send(`${base}/api/landing/sponsors/${titled.sponsorId}`, 'DELETE')).json()
        assert.equal(removed.deleted, true)
        assert.equal(await prisma.sponsor.findUnique({ where: { sponsorId: titled.sponsorId } }), null)
        await send(`${base}/api/landing/sponsors/${logo.sponsorId}`, 'DELETE')
    })
})

test('connecting an existing sponsor puts it on the page and makes it active; taking it off keeps the sponsor', { skip }, async () => {
    const request = await prisma.sponsor.create({
        data: {
            companyName: `${tag} Glow Co`,
            contactName: 'Sam',
            contactInfo: 'sam@glow.example',
            offers: ['products', 'other'],
            offerOther: 'a lab visit',
            status: 'contacting',
            source: 'form'
        }
    })
    await admin(async (base) => {
        const listed = await (await fetch(`${base}/api/landing/sponsors/connectable`)).json()
        const found = listed.find((row) => row.sponsorId === request.sponsorId)
        assert.equal(found.name, `${tag} Glow Co`)
        assert.equal(found.status, 'contacting')

        const pill = await (await send(`${base}/api/landing/sponsors/${request.sponsorId}/connect`, 'POST')).json()
        assert.equal(pill.status, 'active')
        assert.equal(pill.title, `${tag} Glow Co`)
        assert.equal((await send(`${base}/api/landing/sponsors/${request.sponsorId}/connect`, 'POST')).status, 409)
        assert.ok(!(await (await fetch(`${base}/api/landing/sponsors/connectable`)).json()).some((row) => row.sponsorId === request.sponsorId))

        // the public page gets the pill, and nothing about who to contact
        const shown = (await publicPage(base)).sponsors.find((row) => row.sponsorId === request.sponsorId)
        assert.deepEqual(Object.keys(shown).sort(), ['imageUrl', 'sponsorId', 'title', 'website'])

        // archived on the sponsors page, it's off the public page but still in the editor
        await prisma.sponsor.update({ where: { sponsorId: request.sponsorId }, data: { status: 'archive' } })
        assert.ok(!(await publicPage(base)).sponsors.some((row) => row.sponsorId === request.sponsorId))
        const editor = (await (await fetch(`${base}/api/landing/admin`)).json()).sponsors.find((row) => row.sponsorId === request.sponsorId)
        assert.equal(editor.shown, false)

        const removed = await (await send(`${base}/api/landing/sponsors/${request.sponsorId}`, 'DELETE')).json()
        assert.equal(removed.deleted, false)
        const kept = await prisma.sponsor.findUnique({ where: { sponsorId: request.sponsorId } })
        assert.equal(kept.onLanding, false)
        assert.equal(kept.contactInfo, 'sam@glow.example')
    })
})

test('a sent-in sponsor can be connected on the landing editor; archiving it takes the pill off the page, deleting it takes it away', { skip }, async () => {
    await serve(undefined, async (base) => {
        const sent = await send(`${base}/api/sponsors/request`, 'POST', {
            companyName: `${tag} Pill Co`,
            contactName: 'Jo Park',
            contactInfo: 'jo@pill.example.com',
            offers: ['money']
        })
        assert.equal(sent.status, 201)
    })
    const { sponsorId } = await prisma.sponsor.findFirst({ where: { companyName: `${tag} Pill Co` } })

    await admin(async (base) => {
        const page = async () => (await publicPage(base)).sponsors.map((pill) => pill.sponsorId)
        const listed = async () => (await (await fetch(`${base}/api/sponsors`)).json()).filter((row) => row.companyName?.startsWith(tag))

        const connectable = await (await fetch(`${base}/api/landing/sponsors/connectable`)).json()
        assert.ok(connectable.some((row) => row.sponsorId === sponsorId))
        assert.equal((await send(`${base}/api/landing/sponsors/${sponsorId}/connect`, 'POST')).status, 200)
        assert.ok((await page()).includes(sponsorId))

        const connected = (await listed()).find((row) => row.sponsorId === sponsorId)
        assert.equal(connected.status, 'active')
        assert.equal(connected.onLanding, true)
        assert.equal(connected.shown, true)
        assert.equal(connected.landingTitle, `${tag} Pill Co`)

        const archived = await (await send(`${base}/api/sponsors/${sponsorId}/status`, 'PUT', { status: 'archive' })).json()
        assert.equal(archived.onLanding, true)
        assert.equal(archived.shown, false)
        assert.ok(!(await page()).includes(sponsorId))

        // back to active, back on the page — the pill was never touched
        await send(`${base}/api/sponsors/${sponsorId}/status`, 'PUT', { status: 'active' })
        assert.ok((await page()).includes(sponsorId))

        // editing its details leaves the pill as it is
        const edited = await (await send(`${base}/api/sponsors/${sponsorId}`, 'PUT', { companyName: `${tag} Pill Co Renamed` })).json()
        assert.equal(edited.landingTitle, `${tag} Pill Co`)
        assert.equal(edited.onLanding, true)

        assert.equal((await send(`${base}/api/sponsors/${sponsorId}`, 'DELETE')).status, 200)
        assert.equal(await prisma.sponsor.findUnique({ where: { sponsorId } }), null)
        assert.ok(!(await page()).includes(sponsorId))
        assert.equal((await send(`${base}/api/sponsors/${sponsorId}`, 'DELETE')).status, 404)
    })
})

test('the landing page’s pictures load for someone signed out; a sponsor’s only while it is on the page', { skip }, async () => {
    const officer = await person('officer')
    const token = jwt.sign({ id: officer }, process.env.JWT_SECRET)
    await admin(async (base) => {
        const someone = await (await send(`${base}/api/landing/people`, 'POST', { title: `${tag} Outreach`, image: PNG })).json()
        const card = await (await send(`${base}/api/landing/album`, 'POST', { title: `${tag} Social`, image: PNG })).json()
        const pill = await (await send(`${base}/api/landing/sponsors`, 'POST', { title: `${tag} Pictured`, image: PNG })).json()

        for (const path of [someone.imageUrl, card.imageUrl, pill.imageUrl]) {
            const response = await fetch(`${base}${path}`)
            assert.equal(response.status, 200, path)
            assert.equal(response.headers.get('content-type'), 'image/png')
        }

        // off the page, the sponsor's picture is staff's
        await prisma.sponsor.update({ where: { sponsorId: pill.sponsorId }, data: { status: 'pending' } })
        assert.equal((await fetch(`${base}${pill.imageUrl}`)).status, 404)
        assert.equal((await fetch(`${base}${pill.imageUrl}`, { headers: { Authorization: `Bearer ${token}` } })).status, 200)

        // the other kinds still need a sign-in
        assert.equal((await fetch(`${base}/api/img/lab/1/0123456789ab`)).status, 401)
    })
})

test('only an admin can change the landing page, and anyone can read it', { skip }, async () => {
    await serve('officer', async (base) => {
        assert.equal((await send(`${base}/api/landing/people`, 'POST', { title: `${tag} Nope` })).status, 403)
        assert.equal((await send(`${base}/api/landing/album`, 'POST', { title: `${tag} Nope`, image: PNG })).status, 403)
        assert.equal((await send(`${base}/api/landing/sponsors`, 'POST', { title: `${tag} Nope` })).status, 403)
        assert.equal((await fetch(`${base}/api/landing/admin`)).status, 403)
        assert.equal((await fetch(`${base}/api/landing`)).status, 200)
    })
    await serve(null, async (base) => {
        assert.equal((await send(`${base}/api/landing/people`, 'POST', { title: `${tag} Nope` })).status, 403)
        const page = await publicPage(base)
        assert.ok(Array.isArray(page.people) && Array.isArray(page.album) && Array.isArray(page.sponsors))
    })
})
