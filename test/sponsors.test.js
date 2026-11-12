// The sponsors page and the landing page's "sponsor a batch" form: what a
// signed-out visitor can send, what an admin keeps on /sponsors, and how the
// two meet the landing editor's pills — against a real Postgres. Same rules
// as landing.test.js: the database's name has to contain "test", and every
// row made here is removed at the end.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import rateLimit from 'express-rate-limit'

process.env.GMAIL_USER = ''
process.env.GMAIL_APP_PASSWORD = ''
process.env.RESEND_API_KEY = ''
process.env.JWT_SECRET ||= 'test-jwt-secret'
process.env.QR_SECRET ||= 'test-qr-secret'

const url = process.env.DATABASE_URL ?? ''
const skip = !/test/i.test(url.split('/').pop() ?? '')
    ? 'DATABASE_URL must point at a database with "test" in its name'
    : false

let prisma, sponsors, requireRole
const tag = `s${Date.now().toString(36)}`

before(async () => {
    if (skip) { return }
    prisma = (await import('../src/prismaClient.js')).default
    sponsors = await import('../src/routes/sponsorRoutes.js')
    requireRole = (await import('../src/middleware/requireRole.js')).default
})

after(async () => {
    if (skip) { return }
    const tagged = { startsWith: tag }
    await prisma.sponsor.deleteMany({ where: { OR: [{ companyName: tagged }, { landingTitle: tagged }] } })
    await prisma.$disconnect()
})

// the routes as server.js mounts them: the form on its own (with a fresh
// copy of its rate limit when `limited`), the rest behind requireRole('admin')
// with a stand-in for authMiddleware.
//
// How a sponsor meets the landing editor's pills is tested in
// landing.test.js: node --test runs the files side by side, and a pill made
// here would land in the middle of that file's reordering of every pill.
async function serve(role, run, { limited = false } = {}) {
    const app = express()
    app.use(express.json({ limit: '15mb' }))
    if (limited) { app.use('/api/sponsors/request', rateLimit(sponsors.FORM_LIMIT)) }
    app.use('/api/sponsors', sponsors.publicRouter)
    app.use('/api/sponsors', (req, res, next) => { req.userId = 0; req.role = role; next() }, requireRole('admin'), sponsors.default)
    const server = app.listen(0)
    try {
        return await run(`http://localhost:${server.address().port}`)
    } finally {
        server.close()
    }
}

const admin = (run) => serve('admin', run)
const signedOut = (run, options) => serve(undefined, run, options)

const send = (url, method, body) => fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
})

const FORM = () => ({
    companyName: `${tag} Glow Co`,
    contactName: 'Jo Park',
    contactInfo: 'jo@glow.example.com',
    offers: ['products'],
    details: 'Samples for a lab.'
})

const listed = async (base) => {
    const response = await fetch(`${base}/api/sponsors`)
    assert.equal(response.status, 200)
    return (await response.json()).filter((row) => row.companyName?.startsWith(tag) || row.landingTitle?.startsWith(tag))
}

test('a signed-out visitor sends the form, and it lands under pending as a form sponsor', { skip }, async () => {
    await signedOut(async (base) => {
        const response = await send(`${base}/api/sponsors/request`, 'POST', {
            ...FORM(),
            companyName: `  ${tag} Form Co  `,
            offers: ['other', 'money', 'money'],
            offerOther: ' A venue ',
            // none of these are the visitor's to set
            status: 'active',
            source: 'manual',
            onLanding: true,
            landingTitle: 'sneaky'
        })
        assert.equal(response.status, 201)
        const body = await response.json()
        assert.equal(body.sponsorId, undefined)
    })

    const row = await prisma.sponsor.findFirst({ where: { companyName: `${tag} Form Co` } })
    assert.equal(row.status, 'pending')
    assert.equal(row.source, 'form')
    assert.equal(row.onLanding, false)
    assert.equal(row.landingTitle, null)
    assert.deepEqual(row.offers, ['money', 'other'])
    assert.equal(row.offerOther, 'A venue')

    await admin(async (base) => {
        const shown = (await listed(base)).find((sponsor) => sponsor.sponsorId === row.sponsorId)
        assert.equal(shown.status, 'pending')
        assert.equal(shown.source, 'form')
        assert.equal(shown.name, `${tag} Form Co`)
        assert.equal(shown.contactInfo, 'jo@glow.example.com')
        assert.equal(shown.shown, false)
    })
})

test('the form needs a company, a contact person, an email or phone, and an offer; "other" has to say what', { skip }, async () => {
    await signedOut(async (base) => {
        const post = (body) => send(`${base}/api/sponsors/request`, 'POST', body)
        assert.equal((await post({ ...FORM(), companyName: '  ' })).status, 400)
        assert.equal((await post({ ...FORM(), contactName: undefined })).status, 400)
        assert.equal((await post({ ...FORM(), contactInfo: '' })).status, 400)
        assert.equal((await post({ ...FORM(), contactInfo: 'call me maybe' })).status, 400)
        assert.equal((await post({ ...FORM(), contactInfo: '12345' })).status, 400)
        assert.equal((await post({ ...FORM(), offers: [] })).status, 400)
        assert.equal((await post({ ...FORM(), offers: ['products', 'a yacht'] })).status, 400)
        assert.equal((await post({ ...FORM(), offers: 'money' })).status, 400)
        assert.equal((await post({ ...FORM(), offers: ['other'] })).status, 400)
        assert.equal((await post({ ...FORM(), offers: ['other'], offerOther: '   ' })).status, 400)

        // a phone number does, and so does leaving the additional info out
        const phone = await post({ ...FORM(), companyName: `${tag} Phone Co`, contactInfo: '+1 (765) 555-0134', details: '' })
        assert.equal(phone.status, 201)
        const row = await prisma.sponsor.findFirst({ where: { companyName: `${tag} Phone Co` } })
        assert.equal(row.details, null)
        // "other"'s text is only kept when "other" is picked
        const noOther = await post({ ...FORM(), companyName: `${tag} No Other`, offers: ['money'], offerOther: 'ignored' })
        assert.equal(noOther.status, 201)
        assert.equal((await prisma.sponsor.findFirst({ where: { companyName: `${tag} No Other` } })).offerOther, null)
    })
})

test('the form is rate limited per address', { skip }, async () => {
    await signedOut(async (base) => {
        const statuses = []
        for (let at = 0; at <= sponsors.FORM_LIMIT.limit; at++) {
            // invalid on purpose: the limit counts every try, and nothing is made
            statuses.push((await send(`${base}/api/sponsors/request`, 'POST', {})).status)
        }
        assert.ok(statuses.slice(0, -1).every((status) => status === 400))
        assert.equal(statuses.at(-1), 429)
    }, { limited: true })
})

test('an admin adds a sponsor by hand, edits it, and moves it between the sections', { skip }, async () => {
    await admin(async (base) => {
        assert.equal((await send(`${base}/api/sponsors`, 'POST', { contactName: 'Nobody' })).status, 400)
        assert.equal((await send(`${base}/api/sponsors`, 'POST', { companyName: `${tag} Bad`, status: 'won' })).status, 400)
        assert.equal((await send(`${base}/api/sponsors`, 'POST', { companyName: `${tag} Bad`, offers: ['other'] })).status, 400)

        // by hand only the company is needed, and the contact can be anything
        const made = await send(`${base}/api/sponsors`, 'POST', { companyName: `${tag} Hand Co`, contactInfo: 'met at the career fair', source: 'form' })
        assert.equal(made.status, 201)
        const row = await made.json()
        assert.equal(row.source, 'manual')
        assert.equal(row.status, 'pending')
        assert.equal(row.contactInfo, 'met at the career fair')
        assert.deepEqual(row.offers, [])

        const contacting = await send(`${base}/api/sponsors`, 'POST', { companyName: `${tag} Straight In`, status: 'contacting' })
        assert.equal((await contacting.json()).status, 'contacting')

        const edited = await (await send(`${base}/api/sponsors/${row.sponsorId}`, 'PUT', {
            companyName: `${tag} Hand Co Ltd`,
            contactName: 'Sam',
            contactInfo: 'sam@hand.example.com',
            offers: ['money', 'other'],
            offerOther: 'Lab space',
            details: 'Wants a logo on the shirts.',
            source: 'form'
        })).json()
        assert.equal(edited.companyName, `${tag} Hand Co Ltd`)
        assert.deepEqual(edited.offers, ['money', 'other'])
        assert.equal(edited.offerOther, 'Lab space')
        assert.equal(edited.source, 'manual')
        // left out of the edit: the status stays
        assert.equal(edited.status, 'pending')
        assert.equal((await send(`${base}/api/sponsors/${row.sponsorId}`, 'PUT', { companyName: '' })).status, 400)
        assert.equal((await send(`${base}/api/sponsors/999999999`, 'PUT', { companyName: `${tag} x` })).status, 404)

        for (const status of ['contacting', 'active', 'archive', 'pending']) {
            const moved = await send(`${base}/api/sponsors/${row.sponsorId}/status`, 'PUT', { status })
            assert.equal(moved.status, 200)
            assert.equal((await moved.json()).status, status)
        }
        assert.equal((await send(`${base}/api/sponsors/${row.sponsorId}/status`, 'PUT', { status: 'done' })).status, 400)
        assert.equal((await send(`${base}/api/sponsors/999999999/status`, 'PUT', { status: 'active' })).status, 404)
        assert.equal((await send(`${base}/api/sponsors/nope/status`, 'PUT', { status: 'active' })).status, 400)
    })
})

test('only an admin can see or change the sponsors; anyone can send the form', { skip }, async () => {
    for (const role of [undefined, 'member', 'officer', 'jboard', 'treasurer']) {
        await serve(role, async (base) => {
            assert.equal((await fetch(`${base}/api/sponsors`)).status, 403)
            assert.equal((await send(`${base}/api/sponsors`, 'POST', { companyName: `${tag} Nope` })).status, 403)
            assert.equal((await send(`${base}/api/sponsors/1/status`, 'PUT', { status: 'active' })).status, 403)
            assert.equal((await send(`${base}/api/sponsors/1`, 'PUT', { companyName: `${tag} Nope` })).status, 403)
            assert.equal((await send(`${base}/api/sponsors/1`, 'DELETE')).status, 403)
            assert.equal((await send(`${base}/api/sponsors/request`, 'POST', { ...FORM(), companyName: `${tag} Anyone ${role}` })).status, 201)
        })
    }
    assert.equal(await prisma.sponsor.count({ where: { companyName: `${tag} Nope` } }), 0)
})
