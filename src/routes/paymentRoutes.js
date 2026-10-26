import express from 'express'
import prisma from '../prismaClient.js'
import { log } from '../activity.js'
import {
    PAYMENT_INCLUDE, approvePayment, declinePayment, itemOf, notifyPayer, payable, runsDoor
} from '../payments.js'
import { acceptByPaying } from '../offers.js'
import { duesDeadlines, goggleDeadlines, goggleStanding, schoolYearOfLab } from '../payable.js'

const router = express.Router()
// mounted behind authMiddleware + requireRole('member') in server.js

// Payments members make on their own and tell the club about — see
// MemberPayment in schema.prisma and src/payments.js.
//
// A member's:
//   GET  /options?labId= | ?eventId= | (neither, for /vip)
//        what they can pay for there, the ways to pay, and what they've sent
//   POST /  { kind: 'dues' | 'fee' | 'goggles', labId? | eventId?, methodId, reference, screenshot? }
//           'goggles' is a lab's goggle rental — anyone signed up, VIP or
//           staff too, up to 24 hours before it starts (payable.js)
//           sent from a lab or event they hold an offer for, it takes the
//           spot: paying is accepting (src/offers.js)
//   PUT  /:id  the same fields, on their own payment while it's still pending
//              — a wrong transaction id fixed before anyone looks at it. A
//              screenshot left out stays; null takes it off.
//
//   GET  /history  everything they've paid the club, newest first — the
//        account page's "payment history" (see the route)
//   GET  /deadlines  their unpaid due dates, one per lab or event they're
//        signed up for (or offered) and owe for, and each lab's goggle rental
//        they haven't sent in — the calendar's red days:
//        [{ kind, id, title, amount, at, by }] (duesDeadlines and
//        goggleDeadlines in payable.js), soonest first
//
// Officers' and up — the check-in page's payments (the advisor reads them):
//   GET  /?labId= &eventId= &kind= &status= &schoolYear=
//   POST /:id/approve    writes the income row and settles it, and confirms
//                        their spot in the lab or event it was sent from;
//                        emails them
//   POST /:id/send-back  { reason } — they fix it and send it again, within 48
//                        hours when it's for a lab or event, or they're moved
//                        to its waitlist; emails them why
//   POST /:id/reject     { reason? } — not accepted, and they're moved to that
//                        lab's or event's waitlist; emails them

const KINDS = ['dues', 'fee', 'goggles']
const STATUSES = ['pending', 'approved', 'rejected', 'declined', 'reversed']
const IMAGE = /^data:image\/(png|jpe?g|webp|gif);base64,/
const MAX_IMAGE = 3_000_000

const readsBooks = (req) => runsDoor(req) || req.role === 'advisor'

// labId / eventId off a query or body: ['lab', 12], ['event', 4] or null
function placeFrom(source) {
    const labId = source.labId != null && source.labId !== '' ? Number(source.labId) : null
    const eventId = source.eventId != null && source.eventId !== '' ? Number(source.eventId) : null
    if (labId != null && eventId != null) return { error: 'One of labId or eventId, not both' }
    if (labId != null) return Number.isInteger(labId) ? { place: ['lab', labId] } : { error: 'Invalid lab id' }
    if (eventId != null) return Number.isInteger(eventId) ? { place: ['event', eventId] } : { error: 'Invalid event id' }
    return { place: null }
}

// a payment as both sides read it
function shape(payment, { withMember = false } = {}) {
    const from = payment.lab ?? payment.event
    return {
        paymentId: payment.paymentId,
        memberId: payment.memberId,
        kind: payment.kind,
        labId: payment.labId,
        eventId: payment.eventId,
        title: from?.title ?? null,
        schoolYear: payment.schoolYear,
        amount: Number(payment.amount),
        methodId: payment.methodId,
        methodTitle: payment.methodTitle,
        reference: payment.reference,
        screenshot: payment.screenshot,
        status: payment.status,
        rejectionReason: payment.rejectionReason,
        submittedAt: payment.submittedAt,
        reviewedAt: payment.reviewedAt,
        ...(withMember ? {
            firstName: payment.member.user.firstName,
            lastName: payment.member.user.lastName,
            username: payment.member.user.username,
            role: payment.member.role
        } : {})
    }
}

// Theirs that are about this place: the fee for this lab or event, dues for
// its year, and a lab's goggle rentals — /vip shows the year's dues alone.
function mineWhere(memberId, place, schoolYear) {
    const dues = { kind: 'dues', schoolYear }
    if (!place) return { memberId, ...dues }
    const key = place[0] === 'lab' ? 'labId' : 'eventId'
    return {
        memberId,
        OR: [dues, { kind: 'fee', [key]: place[1] }, ...(place[0] === 'lab' ? [{ kind: 'goggles', labId: place[1] }] : [])]
    }
}

router.get('/options', async (req, res) => {
    const { place, error } = placeFrom(req.query)
    if (error) { return res.status(400).json({ message: error }) }
    try {
        const standing = await payable(prisma, req.userId, ...(place ?? []))
        if (!standing) { return res.status(404).json({ message: 'Not found' }) }
        // a lab's goggle rental, beside paying to come
        const goggles = place?.[0] === 'lab' ? await goggleStanding(prisma, req.userId, place[1]) : null
        const [methods, mine] = await Promise.all([
            prisma.paymentMethod.findMany({ orderBy: { methodId: 'asc' } }),
            prisma.memberPayment.findMany({
                where: mineWhere(req.userId, place, standing.schoolYear),
                include: PAYMENT_INCLUDE,
                orderBy: { submittedAt: 'desc' }
            })
        ])
        res.json({ ...standing, goggles, methods, payments: mine.map((payment) => shape(payment)) })
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// The fields a member fills in, off the body: what it was for, how they paid,
// the transaction id and the screenshot. `keepScreenshot` is an edit, where
// one left out stays as it was. Returns { fields } or { error }.
function readPayment(body, { keepScreenshot = false } = {}) {
    if (!KINDS.includes(body.kind)) { return { error: 'Say what it was for: VIP dues, the lab fee or goggles' } }
    const reference = typeof body.reference === 'string' ? body.reference.trim().replace(/^#/, '').slice(0, 80) : ''
    if (!reference) { return { error: 'Type the transaction id your payment app gave you' } }
    const fields = { kind: body.kind, reference }
    if (!(keepScreenshot && body.screenshot === undefined)) {
        const screenshot = body.screenshot ?? null
        if (screenshot !== null && (typeof screenshot !== 'string' || !IMAGE.test(screenshot) || screenshot.length > MAX_IMAGE)) {
            return { error: 'The screenshot has to be a picture, under 2MB' }
        }
        fields.screenshot = screenshot
    }
    const methodId = Number(body.methodId)
    if (!Number.isInteger(methodId)) { return { error: 'Pick how you paid' } }
    fields.methodId = methodId
    return { fields }
}

// Whether `memberId` can pay for `kind` at `place` — the choice ({ kind,
// amount }) and their standing, or why not (409). `except` is the payment
// being edited, which doesn't count as one already waiting.
async function choiceFor(memberId, place, kind, except = null) {
    if (kind === 'goggles') return goggleChoice(memberId, place, except)
    const standing = await payable(prisma, memberId, ...(place ?? []))
    if (!standing) { return { status: 404, message: 'Not found' } }
    const choice = standing.choices.find((option) => option.kind === kind)
    if (!choice) {
        const why = standing.exempt ? 'Staff don’t pay dues'
            : standing.duesPaid ? `Your ${standing.schoolYear} dues are already paid, so there’s nothing to pay`
                : kind === 'fee' && standing.door ? 'Your entry for this one is already settled'
                    : kind === 'fee' && !standing.holds ? 'Sign up first. The fee is for your spot'
                        : kind === 'fee' ? 'There’s no fee for this one'
                            : 'There’s nothing to pay for that here'
        return { status: 409, message: why }
    }

    // one waiting at a time for the same thing
    const key = place?.[0] === 'event' ? 'eventId' : 'labId'
    const waiting = await prisma.memberPayment.findFirst({
        where: {
            memberId,
            status: 'pending',
            ...(except ? { paymentId: { not: except } } : {}),
            ...(kind === 'dues' ? { kind: 'dues', schoolYear: standing.schoolYear } : { kind: 'fee', [key]: place[1] })
        }
    })
    if (waiting) { return { status: 409, message: 'You’ve already sent one, and it’s waiting to be looked at' } }
    return { choice, standing }
}

// choiceFor for a goggle rental: a lab they hold a spot in, rented at the
// club's price, before its deadline, one waiting at a time
async function goggleChoice(memberId, place, except = null) {
    if (place?.[0] !== 'lab') { return { status: 400, message: 'Goggles are rented from a lab’s page' } }
    const goggles = await goggleStanding(prisma, memberId, place[1])
    if (!goggles) { return { status: 404, message: 'Not found' } }
    if (goggles.price <= 0) { return { status: 409, message: 'The club isn’t renting goggles right now' } }
    if (!goggles.holds) { return { status: 409, message: 'Sign up first. Goggles are rented for your spot' } }
    if (!goggles.open) { return { status: 409, message: 'Goggle rental closed 24 hours before the lab' } }
    const waiting = await prisma.memberPayment.findFirst({
        where: {
            memberId, status: 'pending', kind: 'goggles', labId: place[1],
            ...(except ? { paymentId: { not: except } } : {})
        }
    })
    if (waiting) { return { status: 409, message: 'You’ve already sent one, and it’s waiting to be looked at' } }
    const lab = await prisma.lab.findUnique({ where: { labId: place[1] }, select: { date: true } })
    return { choice: { kind: 'goggles', amount: goggles.price }, standing: { schoolYear: schoolYearOfLab(lab) } }
}

router.post('/', async (req, res) => {
    const body = req.body ?? {}
    const { place, error } = placeFrom(body)
    if (error) { return res.status(400).json({ message: error }) }
    const read = readPayment(body)
    if (read.error) { return res.status(400).json({ message: read.error }) }
    const { methodId, reference, screenshot } = read.fields
    if (body.kind === 'fee' && !place) { return res.status(400).json({ message: 'A lab fee is paid from that lab’s page' }) }

    try {
        const method = await prisma.paymentMethod.findUnique({ where: { methodId } })
        if (!method) { return res.status(400).json({ message: 'That payment platform isn’t offered any more. Pick another' }) }

        const found = await choiceFor(req.userId, place, body.kind)
        if (found.message) { return res.status(found.status).json({ message: found.message }) }
        const { choice, standing } = found
        const key = place?.[0] === 'event' ? 'eventId' : 'labId'

        const payment = await prisma.memberPayment.create({
            data: {
                memberId: req.userId,
                kind: body.kind,
                ...(place ? { [key]: place[1] } : {}),
                schoolYear: standing.schoolYear,
                amount: choice.amount,
                methodId,
                methodTitle: method.title,
                reference,
                screenshot
            },
            include: PAYMENT_INCLUDE
        })
        // paying for a spot they've been offered takes it (renting goggles
        // doesn't)
        const accepted = place && body.kind !== 'goggles' ? await acceptByPaying(place[0], place[1], req.userId) : false
        res.status(201).json({ ...shape(payment), accepted })
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Everything someone has paid, however it was paid — a payment they sent in,
// or money taken at the door or marked on the dues card — as one list:
//
//   paid            the year's VIP dues, and every lab or event entry that's
//                   in the books, with the day it was approved (the day it
//                   landed in the ledger)
//   pending         a payment they sent in that nobody's looked at yet
//
// Each: { key, kind: 'dues' | 'fee', title, amount, method, reference,
// approvedOn, status }. A sent-back or taken-back payment isn't money the
// club has, so it's left off.
router.get('/deadlines', async (req, res) => {
    try {
        const [dues, goggles] = await Promise.all([duesDeadlines(prisma, req.userId), goggleDeadlines(prisma, req.userId)])
        res.json([...dues, ...goggles].sort((a, b) => new Date(a.at) - new Date(b.at)))
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

router.get('/history', async (req, res) => {
    const memberId = req.userId
    try {
        const [dues, labs, events, waiting] = await Promise.all([
            prisma.duesPayment.findMany({ where: { memberId, amount: { gt: 0 } } }),
            prisma.memberLab.findMany({
                where: { memberId, doorPayment: 'fee', doorTransactionId: { not: null } },
                select: { doorTransactionId: true, lab: { select: { title: true } } }
            }),
            prisma.memberEvent.findMany({
                where: { memberId, doorPayment: 'fee', doorTransactionId: { not: null } },
                select: { doorTransactionId: true, event: { select: { title: true } } }
            }),
            prisma.memberPayment.findMany({ where: { memberId, status: 'pending' }, include: PAYMENT_INCLUDE })
        ])
        const rentals = await prisma.memberPayment.findMany({
            where: { memberId, kind: 'goggles', status: 'approved', transactionId: { not: null } },
            include: { ...PAYMENT_INCLUDE, transaction: { select: { date: true, amount: true } } }
        })

        // the income rows behind the paid ones, and the payment each one came
        // from when they sent it in (for its platform and transaction id)
        const ledgerIds = [
            ...dues.map((row) => row.transactionId),
            ...labs.map((row) => row.doorTransactionId),
            ...events.map((row) => row.doorTransactionId)
        ].filter((id) => id != null)
        const [ledger, sent] = await Promise.all([
            prisma.transaction.findMany({ where: { transactionId: { in: ledgerIds } } }),
            prisma.memberPayment.findMany({ where: { transactionId: { in: ledgerIds } }, include: PAYMENT_INCLUDE })
        ])
        const rowOf = new Map(ledger.map((row) => [row.transactionId, row]))
        const sentFor = new Map(sent.map((payment) => [payment.transactionId, payment]))
        const day = (date) => date ? date.toISOString().slice(0, 10) : null

        const history = [
            ...dues.map((row) => {
                const payment = sentFor.get(row.transactionId)
                const from = payment?.lab ?? payment?.event
                return {
                    key: `dues-${row.duesId}`,
                    kind: 'dues',
                    title: `VIP dues ${row.schoolYear}${from ? ` (sent from ${from.title})` : ''}`,
                    amount: Number(row.amount),
                    method: payment?.methodTitle ?? null,
                    reference: payment?.reference ?? null,
                    approvedOn: day(row.paidOn),
                    status: 'paid'
                }
            }),
            ...[...labs.map((row) => ({ id: row.doorTransactionId, title: row.lab.title })),
                ...events.map((row) => ({ id: row.doorTransactionId, title: row.event.title }))]
                .filter((row) => rowOf.has(row.id))
                .map((row) => {
                    const payment = sentFor.get(row.id)
                    return {
                        key: `fee-${row.id}`,
                        kind: 'fee',
                        title: row.title,
                        amount: Number(rowOf.get(row.id).amount),
                        method: payment?.methodTitle ?? null,
                        reference: payment?.reference ?? null,
                        approvedOn: day(rowOf.get(row.id).date),
                        status: 'paid'
                    }
                }),
            ...rentals.map((payment) => ({
                key: `goggles-${payment.paymentId}`,
                kind: 'goggles',
                title: `Goggle rental (${payment.lab?.title ?? 'a lab'})`,
                amount: Number(payment.transaction?.amount ?? payment.amount),
                method: payment.methodTitle,
                reference: payment.reference,
                approvedOn: day(payment.transaction?.date),
                status: 'paid'
            })),
            ...waiting.map((payment) => ({
                key: `pending-${payment.paymentId}`,
                kind: payment.kind,
                title: payment.kind === 'dues'
                    ? `VIP dues ${payment.schoolYear}`
                    : payment.kind === 'goggles'
                        ? `Goggle rental (${payment.lab?.title ?? 'a lab'})`
                        : (payment.lab ?? payment.event)?.title ?? 'entry fee',
                amount: Number(payment.amount),
                method: payment.methodTitle,
                reference: payment.reference,
                approvedOn: null,
                status: 'pending'
            })),
        ]
        // waiting ones first, then newest first
        history.sort((a, b) => {
            if ((a.approvedOn == null) !== (b.approvedOn == null)) { return a.approvedOn == null ? -1 : 1 }
            return String(b.approvedOn ?? '').localeCompare(String(a.approvedOn ?? ''))
        })
        res.json(history)
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

router.put('/:id', async (req, res) => {
    const paymentId = parseInt(req.params.id)
    if (isNaN(paymentId)) { return res.status(400).json({ message: 'Invalid payment id' }) }
    const read = readPayment(req.body ?? {}, { keepScreenshot: true })
    if (read.error) { return res.status(400).json({ message: read.error }) }

    try {
        const payment = await prisma.memberPayment.findUnique({ where: { paymentId } })
        // someone else's reads as not there at all
        if (!payment || payment.memberId !== req.userId) { return res.status(404).json({ message: 'Payment not found' }) }
        if (payment.status !== 'pending') {
            return res.status(409).json({ message: 'It’s already been looked at. Send a new one instead' })
        }
        // a goggle rental stays one, and nothing else turns into one
        if ((payment.kind === 'goggles') !== (read.fields.kind === 'goggles')) {
            return res.status(400).json({ message: 'A goggle rental can’t be changed into another payment, or the other way round. Send a new one' })
        }
        const method = await prisma.paymentMethod.findUnique({ where: { methodId: read.fields.methodId } })
        if (!method) { return res.status(400).json({ message: 'That payment platform isn’t offered any more. Pick another' }) }
        const found = await choiceFor(req.userId, itemOf(payment), read.fields.kind, paymentId)
        if (found.message) { return res.status(found.status).json({ message: found.message }) }

        const updated = await prisma.memberPayment.update({
            where: { paymentId },
            data: {
                ...read.fields,
                methodTitle: method.title,
                amount: found.choice.amount,
                schoolYear: found.standing.schoolYear
            },
            include: PAYMENT_INCLUDE
        })
        res.json(shape(updated))
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

router.get('/', async (req, res) => {
    if (!readsBooks(req)) { return res.status(403).json({ message: 'Insufficient permissions' }) }
    const { place, error } = placeFrom(req.query)
    if (error) { return res.status(400).json({ message: error }) }
    const { kind, status, schoolYear } = req.query
    if (kind !== undefined && !KINDS.includes(kind)) { return res.status(400).json({ message: 'kind must be dues or fee' }) }
    if (status !== undefined && !STATUSES.includes(status)) { return res.status(400).json({ message: `status must be one of: ${STATUSES.join(', ')}` }) }

    try {
        const where = {
            ...(place ? { [place[0] === 'lab' ? 'labId' : 'eventId']: place[1] } : {}),
            ...(kind ? { kind } : {}),
            ...(status ? { status } : {}),
            ...(schoolYear ? { schoolYear } : {})
        }
        const rows = await prisma.memberPayment.findMany({ where, include: PAYMENT_INCLUDE, orderBy: { submittedAt: 'asc' } })
        res.json(rows.map((payment) => shape(payment, { withMember: true })))
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

router.post('/:id/approve', async (req, res) => {
    if (!runsDoor(req)) { return res.status(403).json({ message: 'Only officers and up can approve a payment' }) }
    const paymentId = parseInt(req.params.id)
    if (isNaN(paymentId)) { return res.status(400).json({ message: 'Invalid payment id' }) }
    try {
        const approved = await prisma.$transaction(async (tx) => {
            const payment = await tx.memberPayment.findUnique({ where: { paymentId }, include: PAYMENT_INCLUDE })
            if (!payment) { throw Object.assign(new Error('Payment not found'), { status: 404 }) }
            return approvePayment(tx, payment, req.userId)
        })
        res.json(shape(approved, { withMember: true }))
        notifyPayer(approved).catch((err) => console.error(`Payment email failed: ${err.message}`))
    } catch (err) {
        if (err.status) { return res.status(err.status).json({ message: err.message }) }
        // marked paid somewhere else in the same moment
        if (err.code === 'P2002') { return res.status(409).json({ message: 'Their dues were just marked paid' }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

// "send back": they fix it and send it again (see the top of the file)
router.post('/:id/send-back', async (req, res) => {
    if (!runsDoor(req)) { return res.status(403).json({ message: 'Only officers and up can send a payment back' }) }
    const paymentId = parseInt(req.params.id)
    if (isNaN(paymentId)) { return res.status(400).json({ message: 'Invalid payment id' }) }
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 500) : ''
    if (!reason) { return res.status(400).json({ message: 'Say why, so they can fix it' }) }
    try {
        const payment = await prisma.memberPayment.findUnique({ where: { paymentId }, include: PAYMENT_INCLUDE })
        if (!payment) { return res.status(404).json({ message: 'Payment not found' }) }
        if (payment.status !== 'pending') { return res.status(409).json({ message: 'Only a pending payment can be sent back' }) }
        const rejected = await prisma.memberPayment.update({
            where: { paymentId },
            data: { status: 'rejected', rejectionReason: reason, reviewedAt: new Date() },
            include: PAYMENT_INCLUDE
        })
        const at = itemOf(payment)
        await log({
            actorId: req.userId, action: 'payment_rejected', targetId: payment.memberId,
            details: { kind: payment.kind, schoolYear: payment.schoolYear, title: (payment.lab ?? payment.event)?.title ?? null, reason, ...(at ? { item: at[0], id: at[1] } : {}) }
        })
        res.json(shape(rejected, { withMember: true }))
        notifyPayer(rejected).catch((err) => console.error(`Payment email failed: ${err.message}`))
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// "reject": not accepted, and they're moved to the waitlist of the lab or
// event it was sent from (declinePayment in src/payments.js)
router.post('/:id/reject', async (req, res) => {
    if (!runsDoor(req)) { return res.status(403).json({ message: 'Only officers and up can reject a payment' }) }
    const paymentId = parseInt(req.params.id)
    if (isNaN(paymentId)) { return res.status(400).json({ message: 'Invalid payment id' }) }
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 500) : ''
    try {
        const declined = await prisma.$transaction(async (tx) => {
            const payment = await tx.memberPayment.findUnique({ where: { paymentId }, include: PAYMENT_INCLUDE })
            if (!payment) { throw Object.assign(new Error('Payment not found'), { status: 404 }) }
            return declinePayment(tx, payment, reason)
        })
        const at = itemOf(declined)
        await log({
            actorId: req.userId, action: 'payment_rejected', targetId: declined.memberId,
            details: {
                kind: declined.kind, schoolYear: declined.schoolYear, title: (declined.lab ?? declined.event)?.title ?? null,
                reason: reason || null, declined: true, moved: declined.moved, ...(at ? { item: at[0], id: at[1] } : {})
            }
        })
        res.json(shape(declined, { withMember: true }))
        notifyPayer(declined).catch((err) => console.error(`Payment email failed: ${err.message}`))
    } catch (err) {
        if (err.status) { return res.status(err.status).json({ message: err.message }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

export default router
