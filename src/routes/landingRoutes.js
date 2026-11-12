import express from 'express'
import prisma from '../prismaClient.js'
import { readImage } from '../images.js'
import { memo, SHARED_MS } from '../memo.js'
import { onLandingPage, publicPill, readWebsite, sponsorName } from '../sponsors.js'

// What the public landing page (/landing) shows in place of the placeholders
// in frontend/components/landing/content.js: the people under "who we are",
// the album's cards, and the sponsors' pills. A section with nothing in it
// keeps its placeholders — that's the page's call, this only says what there is.
//
//   GET /api/landing           anyone, signed in or not (publicRouter)
//   everything else            an admin, on /landing-editor (mounted behind
//                              authMiddleware + requireRole('admin'))
//
// Pictures go out as addresses (/api/img/person|album|sponsor/...), which are
// open to anyone too (src/routes/imageRoutes.js).
//
// The people:  title (required, what the rail shows), name, description, image
// The album:   title and image (required), date, description
//
// Each section is in the order the editor's cards are dragged into
// (PUT /people/order, /album/order, /sponsors/order).
// A pill:      title, image (one of them required), website — on a Sponsor
//              row (src/sponsors.js), the same one the sponsors page keeps

export const publicRouter = express.Router()
const router = express.Router()

// a photo picked in the browser, shrunk there first (frontend/lib/images.js)
const IMAGE = /^data:image\/(png|jpe?g|webp|gif);base64,/
const MAX_IMAGE = 3_000_000
const BAD_IMAGE = 'The picture has to be a photo (PNG or JPEG), under 2MB'

const DATE = /^\d{4}-\d{2}-\d{2}$/

const text = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) || null : null

// An image off the body: { keep: true } when it was left out or sent back as
// the address it was given, otherwise { image } — a data URL or null.
function readPicture(value) {
    const image = readImage(value)
    if (image === undefined) { return { keep: true } }
    if (image === null || image === '') { return { image: null } }
    if (typeof image !== 'string' || !IMAGE.test(image) || image.length > MAX_IMAGE) { return { error: BAD_IMAGE } }
    return { image }
}

const ymd = (date) => date ? date.toISOString().slice(0, 10) : null

const personOut = (row) => ({
    personId: row.personId,
    title: row.title,
    name: row.name,
    description: row.description,
    imageUrl: row.imageUrl,
    position: row.position
})

const cardOut = (row) => ({
    cardId: row.cardId,
    title: row.title,
    date: ymd(row.date),
    description: row.description,
    imageUrl: row.imageUrl
})

// a pill as the editor sees it: the public half, and where the sponsor stands
const pillOut = (row) => ({
    ...publicPill(row),
    companyName: row.companyName,
    status: row.status,
    source: row.source,
    shown: onLandingPage(row)
})

const PEOPLE = { orderBy: [{ position: 'asc' }, { personId: 'asc' }] }
const ALBUM = { orderBy: [{ position: 'asc' }, { cardId: 'desc' }] }
const PILLS = { orderBy: [{ landingOrder: 'asc' }, { sponsorId: 'asc' }] }

function fail(res, err) {
    if (err.code === 'P2025') { return res.status(404).json({ message: 'Not found' }) }
    console.error(err.message)
    res.sendStatus(500)
}

// ---- the public page --------------------------------------------------------

// The home page asks this on every visit, from anyone, and it only changes
// when an admin saves something on /landing-editor or /sponsors — so the
// answer is kept (src/memo.js) and a visit costs the database nothing. Any
// write to the three tables clears it (KEPT in src/prismaClient.js). Only the
// columns the page shows are read.
const PILL_SELECT = { sponsorId: true, landingTitle: true, website: true, imageUrl: true, landingOrder: true }
const readLanding = () => memo('landing', SHARED_MS, async () => {
    const [people, album, sponsors] = await Promise.all([
        prisma.landingPerson.findMany({ ...PEOPLE, select: { personId: true, title: true, name: true, description: true, imageUrl: true, position: true } }),
        prisma.albumCard.findMany({ ...ALBUM, select: { cardId: true, title: true, date: true, description: true, imageUrl: true } }),
        prisma.sponsor.findMany({ where: { onLanding: true, status: 'active' }, ...PILLS, select: PILL_SELECT })
    ])
    return {
        people: people.map(personOut),
        album: album.map(cardOut),
        // a pill with neither a title nor a picture has nothing to show
        sponsors: sponsors.map(publicPill).filter((pill) => pill.title || pill.imageUrl)
    }
})

publicRouter.get('/', async (req, res) => {
    try {
        res.json(await readLanding())
    } catch (err) {
        fail(res, err)
    }
})

// ---- the editor -------------------------------------------------------------

router.get('/admin', async (req, res) => {
    try {
        const [people, album, sponsors] = await Promise.all([
            prisma.landingPerson.findMany(PEOPLE),
            prisma.albumCard.findMany(ALBUM),
            prisma.sponsor.findMany({ where: { onLanding: true }, ...PILLS })
        ])
        res.json({ people: people.map(personOut), album: album.map(cardOut), sponsors: sponsors.map(pillOut) })
    } catch (err) {
        fail(res, err)
    }
})

// -- the people

function readPerson(body) {
    const title = text(body.title, 80)
    if (!title) { return { error: 'Give them a title — it’s what the landing page shows before they’re clicked' } }
    const picture = readPicture(body.image)
    if (picture.error) { return { error: picture.error } }
    return {
        fields: {
            title,
            name: text(body.name, 80),
            description: text(body.description, 600),
            ...(picture.keep ? {} : { image: picture.image })
        }
    }
}

router.post('/people', async (req, res) => {
    const { fields, error } = readPerson(req.body ?? {})
    if (error) { return res.status(400).json({ message: error }) }
    try {
        // on the end of the rail
        const last = await prisma.landingPerson.aggregate({ _max: { position: true } })
        const row = await prisma.landingPerson.create({ data: { ...fields, position: (last._max.position ?? -1) + 1 } })
        res.status(201).json(personOut(row))
    } catch (err) {
        fail(res, err)
    }
})

// A section's order, as the editor's cards were dragged: { ids } — every one
// of them, first to last. Answers with the section in its new order.
function reorder({ model, id, field, where = {}, list, out, what }) {
    return async (req, res) => {
        const ids = req.body?.ids
        if (!Array.isArray(ids) || !ids.every(Number.isInteger) || new Set(ids).size !== ids.length) {
            return res.status(400).json({ message: 'Send the order as a list of ids' })
        }
        try {
            const all = await prisma[model].findMany({ where, select: { [id]: true } })
            if (all.length !== ids.length || !all.every((row) => ids.includes(row[id]))) {
                return res.status(400).json({ message: `The order has to list every ${what} once` })
            }
            await prisma.$transaction(ids.map((key, at) => prisma[model].update({ where: { [id]: key }, data: { [field]: at } })))
            res.json((await prisma[model].findMany({ where, ...list })).map(out))
        } catch (err) {
            fail(res, err)
        }
    }
}

router.put('/people/order', reorder({ model: 'landingPerson', id: 'personId', field: 'position', list: PEOPLE, out: personOut, what: 'person' }))

router.put('/people/:id', async (req, res) => {
    const personId = parseInt(req.params.id)
    if (isNaN(personId)) { return res.status(400).json({ message: 'Invalid id' }) }
    const { fields, error } = readPerson(req.body ?? {})
    if (error) { return res.status(400).json({ message: error }) }
    try {
        res.json(personOut(await prisma.landingPerson.update({ where: { personId }, data: fields })))
    } catch (err) {
        fail(res, err)
    }
})

router.delete('/people/:id', async (req, res) => {
    const personId = parseInt(req.params.id)
    if (isNaN(personId)) { return res.status(400).json({ message: 'Invalid id' }) }
    try {
        await prisma.landingPerson.delete({ where: { personId } })
        res.json({ message: 'Removed' })
    } catch (err) {
        fail(res, err)
    }
})

// -- the album

// `editing`: the picture may be left as it is, but never taken off
function readCard(body, { editing = false } = {}) {
    const title = text(body.title, 80)
    if (!title) { return { error: 'Give the card a title' } }
    const picture = readPicture(body.image)
    if (picture.error) { return { error: picture.error } }
    if ((picture.keep && !editing) || picture.image === null) { return { error: 'Every album card needs a photo' } }
    let date = null
    if (body.date != null && body.date !== '') {
        if (typeof body.date !== 'string' || !DATE.test(body.date) || isNaN(new Date(body.date))) {
            return { error: 'The date has to be a day (YYYY-MM-DD)' }
        }
        date = new Date(`${body.date}T00:00:00Z`)
    }
    return {
        fields: {
            title,
            date,
            description: text(body.description, 400),
            ...(picture.keep ? {} : { image: picture.image })
        }
    }
}

// a new card goes on the front of the deck
router.post('/album', async (req, res) => {
    const { fields, error } = readCard(req.body ?? {})
    if (error) { return res.status(400).json({ message: error }) }
    try {
        const first = await prisma.albumCard.aggregate({ _min: { position: true } })
        res.status(201).json(cardOut(await prisma.albumCard.create({ data: { ...fields, position: (first._min.position ?? 1) - 1 } })))
    } catch (err) {
        fail(res, err)
    }
})

router.put('/album/order', reorder({ model: 'albumCard', id: 'cardId', field: 'position', list: ALBUM, out: cardOut, what: 'card' }))

router.put('/album/:id', async (req, res) => {
    const cardId = parseInt(req.params.id)
    if (isNaN(cardId)) { return res.status(400).json({ message: 'Invalid id' }) }
    const { fields, error } = readCard(req.body ?? {}, { editing: true })
    if (error) { return res.status(400).json({ message: error }) }
    try {
        res.json(cardOut(await prisma.albumCard.update({ where: { cardId }, data: fields })))
    } catch (err) {
        fail(res, err)
    }
})

router.delete('/album/:id', async (req, res) => {
    const cardId = parseInt(req.params.id)
    if (isNaN(cardId)) { return res.status(400).json({ message: 'Invalid id' }) }
    try {
        await prisma.albumCard.delete({ where: { cardId } })
        res.json({ message: 'Removed' })
    } catch (err) {
        fail(res, err)
    }
})

// -- the sponsors' pills

// `had` is whether the row already has a picture, for a pill whose picture
// is left as it is
function readPill(body, { had = false } = {}) {
    const title = text(body.title, 60)
    const picture = readPicture(body.image)
    if (picture.error) { return { error: picture.error } }
    const { website, error } = readWebsite(body.website)
    if (error) { return { error } }
    const hasPicture = picture.keep ? had : picture.image !== null
    if (!title && !hasPicture) { return { error: 'A sponsor pill needs a title, a picture, or both' } }
    return {
        fields: {
            landingTitle: title,
            website,
            ...(picture.keep ? {} : { image: picture.image })
        }
    }
}

const nextPillOrder = async () => {
    const last = await prisma.sponsor.aggregate({ where: { onLanding: true }, _max: { landingOrder: true } })
    return (last._max.landingOrder ?? -1) + 1
}

// A pill made here is a sponsor added by hand, and an active one — it's on
// the page.
router.post('/sponsors', async (req, res) => {
    const { fields, error } = readPill(req.body ?? {})
    if (error) { return res.status(400).json({ message: error }) }
    try {
        const row = await prisma.sponsor.create({
            data: { ...fields, source: 'manual', status: 'active', onLanding: true, landingOrder: await nextPillOrder() }
        })
        res.status(201).json(pillOut(row))
    } catch (err) {
        fail(res, err)
    }
})

// Sponsors that could be connected: every one not on the page, in any of
// the sponsors page's sections.
router.get('/sponsors/connectable', async (req, res) => {
    try {
        const rows = await prisma.sponsor.findMany({
            where: { onLanding: false },
            orderBy: [{ companyName: 'asc' }, { sponsorId: 'asc' }],
            select: { sponsorId: true, companyName: true, landingTitle: true, status: true, source: true, offers: true }
        })
        res.json(rows.map((row) => ({ ...row, name: sponsorName(row) })))
    } catch (err) {
        fail(res, err)
    }
})

// Connect an existing sponsor: it goes on the page as a pill, and becomes
// active on the sponsors page. The pill's title starts as the company's name.
router.post('/sponsors/:id/connect', async (req, res) => {
    const sponsorId = parseInt(req.params.id)
    if (isNaN(sponsorId)) { return res.status(400).json({ message: 'Invalid id' }) }
    try {
        const row = await prisma.sponsor.findUnique({ where: { sponsorId }, select: { onLanding: true, landingTitle: true, companyName: true } })
        if (!row) { return res.status(404).json({ message: 'Not found' }) }
        if (row.onLanding) { return res.status(409).json({ message: 'That sponsor is already on the landing page' }) }
        const updated = await prisma.sponsor.update({
            where: { sponsorId },
            data: {
                onLanding: true,
                status: 'active',
                landingTitle: row.landingTitle || row.companyName?.slice(0, 60) || null,
                landingOrder: await nextPillOrder()
            }
        })
        res.json(pillOut(updated))
    } catch (err) {
        fail(res, err)
    }
})

// the pills on the page (every onLanding one, shown or not)
router.put('/sponsors/order', reorder({ model: 'sponsor', id: 'sponsorId', field: 'landingOrder', where: { onLanding: true }, list: PILLS, out: pillOut, what: 'pill' }))

router.put('/sponsors/:id', async (req, res) => {
    const sponsorId = parseInt(req.params.id)
    if (isNaN(sponsorId)) { return res.status(400).json({ message: 'Invalid id' }) }
    try {
        const row = await prisma.sponsor.findUnique({ where: { sponsorId }, select: { imageKey: true, onLanding: true } })
        if (!row || !row.onLanding) { return res.status(404).json({ message: 'Not found' }) }
        const { fields, error } = readPill(req.body ?? {}, { had: Boolean(row.imageKey) })
        if (error) { return res.status(400).json({ message: error }) }
        res.json(pillOut(await prisma.sponsor.update({ where: { sponsorId }, data: fields })))
    } catch (err) {
        fail(res, err)
    }
})

// Taking a pill off the page. A sponsor the club knows anything else about —
// it came in through the form, or has a company, a contact, an offer, notes —
// stays on the sponsors page; one that was only ever a pill is gone.
router.delete('/sponsors/:id', async (req, res) => {
    const sponsorId = parseInt(req.params.id)
    if (isNaN(sponsorId)) { return res.status(400).json({ message: 'Invalid id' }) }
    try {
        const row = await prisma.sponsor.findUnique({ where: { sponsorId } })
        if (!row || !row.onLanding) { return res.status(404).json({ message: 'Not found' }) }
        const onlyAPill = row.source === 'manual' && !row.companyName && !row.contactName && !row.contactInfo &&
            !row.offers.length && !row.offerOther && !row.details
        if (onlyAPill) {
            await prisma.sponsor.delete({ where: { sponsorId } })
        } else {
            await prisma.sponsor.update({ where: { sponsorId }, data: { onLanding: false } })
        }
        res.json({ message: 'Removed', deleted: onlyAPill })
    } catch (err) {
        fail(res, err)
    }
})

export default router
