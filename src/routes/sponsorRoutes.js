import express from 'express'
import prisma from '../prismaClient.js'
import { OFFERS, STATUSES, onLandingPage, sponsorName } from '../sponsors.js'

// The sponsors page (/sponsors) and the landing page's "sponsor a batch" form.
// One Sponsor row each (src/sponsors.js), the same rows the landing editor's
// pills are on (src/routes/landingRoutes.js keeps those).
//
//   POST /api/sponsors/request   anyone, signed in or not (publicRouter, rate
//                                limited in server.js): the form. It comes in
//                                as source 'form', status 'pending'.
//   everything else              an admin (mounted behind authMiddleware +
//                                requireRole('admin'); the advisor reads)
//
//   GET    /                     every sponsor, newest first
//   POST   /                     one added by hand (source 'manual')
//   PUT    /:id                  its details (and its status, if sent)
//   PUT    /:id/status           { status } — moved to another section
//   DELETE /:id                  gone, pill and all
//
// Moving a sponsor out of active takes its pill off the public page without
// touching the pill (onLandingPage); moving it back puts it back.

// How often one address can send the form: ten in 15 minutes, enough for
// someone fixing a typo and resending (server.js puts it in front)
export const FORM_LIMIT = {
    windowMs: 15 * 60 * 1000,
    limit: 10,
    message: { message: 'Too many requests. Try again in 15 minutes' }
}

export const publicRouter = express.Router()
const router = express.Router()

const LIMITS = { companyName: 120, contactName: 120, contactInfo: 200, offerOther: 300, details: 2000 }

const text = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) || null : null

// An email address, or a phone number: 7 to 15 digits, with the spaces,
// dashes, dots, brackets and leading + people write them with.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE = /^\+?[\d\s().-]+$/
export function isContact(value) {
    if (EMAIL.test(value)) { return true }
    const digits = value.replace(/\D/g, '').length
    return PHONE.test(value) && digits >= 7 && digits <= 15
}

// What they're offering, off the body: a list of OFFERS, each once, in
// OFFERS' order. Anything that isn't one is an error, not dropped quietly.
function readOffers(value) {
    if (value == null) { return { offers: [] } }
    if (!Array.isArray(value) || value.some((offer) => !OFFERS.includes(offer))) {
        return { error: `What they're offering has to be any of ${OFFERS.join(', ')}` }
    }
    return { offers: OFFERS.filter((offer) => value.includes(offer)) }
}

// The request half of a sponsor, off a body. `form` is the public form, which
// needs everything but the additional info, and a contact that's an email or
// a phone number. By hand an admin needs only the company: they may know
// little else yet, and the contact may be "Jane, at the career fair".
// Either way "other" needs to say what it is.
function readRequest(body, { form = false } = {}) {
    const companyName = text(body.companyName, LIMITS.companyName)
    const contactName = text(body.contactName, LIMITS.contactName)
    const contactInfo = text(body.contactInfo, LIMITS.contactInfo)
    const details = text(body.details, LIMITS.details)
    const { offers, error } = readOffers(body.offers)
    if (error) { return { error } }
    const offerOther = offers.includes('other') ? text(body.offerOther, LIMITS.offerOther) : null

    if (!companyName) { return { error: 'Give the company’s name' } }
    if (form) {
        if (!contactName) { return { error: 'Give the name of the person to contact' } }
        if (!contactInfo) { return { error: 'Give an email address or a phone number to reach them on' } }
        if (!isContact(contactInfo)) { return { error: 'The contact has to be an email address or a phone number' } }
        if (!offers.length) { return { error: 'Pick what you’re offering: products, money, or something else' } }
    }
    if (offers.includes('other') && !offerOther) { return { error: 'Say what the “other” offer is' } }

    return { fields: { companyName, contactName, contactInfo, offers, offerOther, details } }
}

const readStatus = (value) => STATUSES.includes(value) ? value : null

// a sponsor as the sponsors page sees it: the whole request, and its pill in
// brief (whether it's on the landing page, and shown there)
const sponsorOut = (row) => ({
    sponsorId: row.sponsorId,
    name: sponsorName(row),
    companyName: row.companyName,
    contactName: row.contactName,
    contactInfo: row.contactInfo,
    offers: row.offers,
    offerOther: row.offerOther,
    details: row.details,
    status: row.status,
    source: row.source,
    landingTitle: row.landingTitle,
    website: row.website,
    imageUrl: row.imageUrl ?? null,
    onLanding: row.onLanding,
    shown: onLandingPage(row),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
})

function fail(res, err) {
    if (err.code === 'P2025') { return res.status(404).json({ message: 'Not found' }) }
    console.error(err.message)
    res.sendStatus(500)
}

const readId = (req, res) => {
    const sponsorId = parseInt(req.params.id)
    if (isNaN(sponsorId)) { res.status(400).json({ message: 'Invalid id' }); return null }
    return sponsorId
}

// ---- the public form --------------------------------------------------------

// Only what the form asks for is read: a status, a source or a pill sent
// along with it is ignored.
publicRouter.post('/request', async (req, res) => {
    const { fields, error } = readRequest(req.body ?? {}, { form: true })
    if (error) { return res.status(400).json({ message: error }) }
    try {
        await prisma.sponsor.create({ data: { ...fields, source: 'form', status: 'pending' } })
        // nothing of the row goes back: the visitor isn't staff
        res.status(201).json({ message: 'Thanks! We’ll be in touch.' })
    } catch (err) {
        fail(res, err)
    }
})

// ---- the sponsors page ------------------------------------------------------

router.get('/', async (req, res) => {
    try {
        const rows = await prisma.sponsor.findMany({ orderBy: [{ createdAt: 'desc' }, { sponsorId: 'desc' }] })
        res.json(rows.map(sponsorOut))
    } catch (err) {
        fail(res, err)
    }
})

router.post('/', async (req, res) => {
    const body = req.body ?? {}
    const { fields, error } = readRequest(body)
    if (error) { return res.status(400).json({ message: error }) }
    const status = body.status === undefined ? 'pending' : readStatus(body.status)
    if (!status) { return res.status(400).json({ message: `The status has to be one of ${STATUSES.join(', ')}` }) }
    try {
        const row = await prisma.sponsor.create({ data: { ...fields, status, source: 'manual' } })
        res.status(201).json(sponsorOut(row))
    } catch (err) {
        fail(res, err)
    }
})

router.put('/:id/status', async (req, res) => {
    const sponsorId = readId(req, res)
    if (sponsorId === null) { return }
    const status = readStatus(req.body?.status)
    if (!status) { return res.status(400).json({ message: `The status has to be one of ${STATUSES.join(', ')}` }) }
    try {
        res.json(sponsorOut(await prisma.sponsor.update({ where: { sponsorId }, data: { status } })))
    } catch (err) {
        fail(res, err)
    }
})

// Its details, all of them (what's left out is cleared, as on the form). The
// pill's own fields are the landing editor's, and the source never changes.
router.put('/:id', async (req, res) => {
    const sponsorId = readId(req, res)
    if (sponsorId === null) { return }
    const body = req.body ?? {}
    const { fields, error } = readRequest(body)
    if (error) { return res.status(400).json({ message: error }) }
    const status = body.status === undefined ? undefined : readStatus(body.status)
    if (status === null) { return res.status(400).json({ message: `The status has to be one of ${STATUSES.join(', ')}` }) }
    try {
        res.json(sponsorOut(await prisma.sponsor.update({ where: { sponsorId }, data: { ...fields, ...(status ? { status } : {}) } })))
    } catch (err) {
        fail(res, err)
    }
})

// Gone for good, and so is its pill if it had one.
router.delete('/:id', async (req, res) => {
    const sponsorId = readId(req, res)
    if (sponsorId === null) { return }
    try {
        await prisma.sponsor.delete({ where: { sponsorId } })
        res.json({ message: 'Deleted' })
    } catch (err) {
        fail(res, err)
    }
})

export default router
