import jwt from 'jsonwebtoken'
import prisma from './prismaClient.js'
import { sendEmail } from './email.js'
import { actionEmail } from './emailTemplate.js'
import { APP_URL } from './verification.js'
import { clubFormat, startsAt } from './clubTime.js'
import { OFFER_HOURS, dueCallout, dueText, dueWhen, payable, paymentDueAt } from './payable.js'

// Waitlist offers, for labs and events alike.
//
// Someone moved off a waitlist doesn't get the spot outright: they're
// `offered` — the seat is held for them, and they sit in the check-in page's
// "not checked in" column with a blue envelope. The envelope emails them an
// "Accept" button; accepting (the emailed link, or the lab's own page) makes
// them `rsvped`, officially signed up.
//
// An offer lapses when it's gone 48 hours unanswered since the email AND the
// lab or event is still more than 48 hours off: they go to the back of the
// waitlist, and the next person on it is offered the spot in their place
// (waiting for an officer to send them their envelope). Inside those last 48
// hours an unanswered offer is left alone — the officers at the door handle it.
//
// People are moved off a waitlist three ways, and all three land here as an
// offer: an officer's yellow button, a seat freed by someone un-RSVPing or
// being removed, and a lapsed offer handing on.
//
// Confirmations work much the same the other way round. The check-in page's
// "confirmation" emails everyone signed up who hasn't confirmed yet a
// "Confirm my spot" button (with a lab's prelab PDF attached) and a deadline
// the officer picks in its popup. Missing it only costs someone their spot
// when the waitlist needs it: then just enough of those who missed it are
// picked at random, moved to the back of the waitlist, and their spots offered
// on down it. With nobody waiting, the deadline isn't enforced (see
// enforceConfirmations). Once a confirmation round has gone out, accepting an
// offer counts as confirming, and a lab's prelab is emailed to whoever accepts.
//
// Nobody is dropped for not answering — only moved to the back of the line.
//
// Paying stands in for both. Someone who owes for a lab or members-only event
// (not a VIP, nothing paid at the door) has no confirm or accept button: the
// emails send them to its page, where sending the payment does it (see
// payable.js). Once it's sent they hold the spot — an offer becomes theirs
// (acceptByPaying), and neither the offer's 48 hours nor a confirmation
// deadline can move them — and once it's approved they're officially
// confirmed (approvePayment in payments.js), so the confirmation round tells
// them they're set instead of asking. Their confirmation deadline is their
// payment due date too, when it's sooner than the week before; not paying by
// it is payments.js's to enforce (enforcePaymentRules), not this file's.
//
// Whoever's moved to the back of the waitlist is emailed why
// (notifyMovedToWaitlist).

export { OFFER_HOURS }
const HOUR = 60 * 60 * 1000

// waitlisted -> offered. Any confirmation left over from a spot they lost is
// cleared: they start fresh with this one.
export const OFF_WAITLIST = {
    attendanceStatus: 'offered', waitlistedAt: null, offerSentAt: null,
    confirmSentAt: null, confirmBy: null, confirmedAt: null, payBy: null, payRemindedAt: null
}

// A lapsed offer or a missed confirmation: to the back of the waitlist. A
// missed confirmation keeps its `confirmBy`, which is how enforceConfirmations
// tells them apart from people who joined the waitlist themselves.
const BACK_OF_WAITLIST = {
    attendanceStatus: 'waitlisted', offerSentAt: null, confirmSentAt: null, confirmedAt: null,
    payBy: null, payRemindedAt: null
}

export const KINDS = {
    lab: {
        parent: 'lab',
        link: 'memberLab',
        key: 'labId',
        compound: 'memberId_labId',
        noun: 'lab',
        page: (id) => `/labs/view?id=${id}`
    },
    event: {
        parent: 'event',
        link: 'memberEvent',
        key: 'eventId',
        compound: 'memberId_eventId',
        noun: 'event',
        page: (id) => `/events/view?id=${id}`
    }
}

const where = (kind, parentId, memberId) => ({ [kind.compound]: { memberId, [kind.key]: parentId } })

// When a lab or event starts — on the club's clock, whatever the server's is
// (see clubTime.js). Re-exported: the routes ask it too.
export { startsAt }

// Take the lab's or event's row lock for the rest of the caller's transaction.
// Every seat decision — count what's taken, then add or hand on a spot — runs
// under it, so two of them for the same lab or event queue up instead of both
// counting the same free seat. Postgres's default isolation doesn't do that on
// its own: two transactions can each count 9 of 10 taken and each add one.
export async function lockParent(tx, kindName, parentId) {
    if (kindName === 'lab') {
        await tx.$queryRaw`SELECT 1 FROM labs WHERE lab_id = ${parentId} FOR UPDATE`
    } else {
        await tx.$queryRaw`SELECT 1 FROM events WHERE event_id = ${parentId} FOR UPDATE`
    }
}

// Hand the oldest waitlist place a spot, inside the caller's transaction.
// The caller has already decided there's a seat to give. Returns the member
// it went to, or null if nobody's waiting.
export async function offerNext(tx, kindName, parentId) {
    const kind = KINDS[kindName]
    const junction = tx[kind.link]
    const next = await junction.findFirst({
        where: { [kind.key]: parentId, attendanceStatus: 'waitlisted' },
        orderBy: { waitlistedAt: 'asc' }
    })
    if (!next) { return null }
    await junction.update({
        where: where(kind, parentId, next.memberId),
        data: OFF_WAITLIST
    })
    return next.memberId
}

// signed up (or offered) -> the back of the waitlist, inside `tx` (which has
// taken lockParent): the seat they held goes on down the waitlist, if the cap
// leaves room for it. Returns whether they were moved — false if they weren't
// holding a spot.
export async function moveToWaitlist(tx, kindName, parentId, memberId) {
    const kind = KINDS[kindName]
    const row = await tx[kind.link].findUnique({ where: where(kind, parentId, memberId) })
    if (!row || !['rsvped', 'offered'].includes(row.attendanceStatus)) { return false }
    await tx[kind.link].update({
        where: where(kind, parentId, memberId),
        data: { ...BACK_OF_WAITLIST, waitlistedAt: new Date() }
    })
    const parent = await tx[kind.parent].findUnique({ where: { [kind.key]: parentId }, select: { capacity: true } })
    if (parent?.capacity != null) {
        const taken = await tx[kind.link].count({ where: { [kind.key]: parentId, attendanceStatus: HELD } })
        if (taken < parent.capacity) { await offerNext(tx, kindName, parentId) }
    }
    return true
}

// Why someone was moved to the back of a waitlist, in the email that says so
const MOVED = {
    unpaid: () => 'You hadn’t sent a payment in by the payment due date, so your spot has gone to the waitlist.',
    declined: (note) => `Your payment wasn’t accepted${note ? `: ${note}` : '.'}`,
    not_revised: () => 'Your payment was sent back to be fixed, and it wasn’t sent again within 48 hours.',
    unconfirmed: () => 'You didn’t confirm your spot by the deadline, and someone on the waitlist needed it.'
}

// Tell `memberId` they're on the waitlist for it now, and why (`reason` is a
// key of MOVED; `note` is a rejection's reason). The payment ones carry the
// due date, big. Never throws: a mail hiccup is logged.
export async function notifyMovedToWaitlist({ kindName, parentId, memberId, reason, note = null, missedBy = null }) {
    try {
        const kind = KINDS[kindName]
        const row = await prisma[kind.link].findUnique({
            where: where(kind, parentId, memberId),
            include: { [kind.parent]: true, member: { select: { user: { select: { email: true, firstName: true } } } } }
        })
        if (!row) { return }
        const parent = row[kind.parent]
        const about = reason !== 'unconfirmed'
        // the due date they missed (moving them cleared a late one's payBy,
        // so it's handed in)
        await sendEmail({
            to: row.member.user.email,
            subject: `You’ve been moved to the waitlist: ${parent.title}`,
            ...actionEmail({
                heading: 'You’re on the waitlist now',
                ...(about ? { callout: dueCallout(parent, { confirmBy: row.confirmBy, payBy: missedBy }) } : {}),
                lines: [
                    `You were signed up for ${parent.title} on ${when(parent)}, but you’ve been moved to the back of its waitlist.`,
                    `Why: ${MOVED[reason](note)}`,
                    'If a spot opens up, you’ll be offered it, and you can pay then to take it.'
                ],
                button: { label: `See the ${kind.noun}`, url: `${APP_URL}${kind.page(parentId)}` },
                reason: `You’re getting this because you signed up for ${parent.title}.`
            })
        })
    } catch (err) {
        console.error(`Waitlist email failed: ${err.message}`)
    }
}

// 'Tuesday, September 29 at 5:00 PM in WTHR 200'
function when(row) {
    const day = row.date.toISOString().slice(0, 10)
    const [y, m, d] = day.split('-').map(Number)
    let text = new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    if (row.startTime) {
        const [h, min] = row.startTime.split(':').map(Number)
        text += ` at ${h % 12 || 12}:${String(min).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
    }
    if (row.location) { text += ` in ${row.location}` }
    return text
}

// The blue envelope: email the offer and note when. Returns when it went, or
// throws with a message the page can show.
export async function sendOffer(kindName, parentId, memberId) {
    const kind = KINDS[kindName]
    const row = await prisma[kind.link].findUnique({
        where: where(kind, parentId, memberId),
        include: {
            [kind.parent]: true,
            member: { select: { user: { select: { email: true, firstName: true } } } }
        }
    })
    if (!row || row.attendanceStatus !== 'offered') {
        throw Object.assign(new Error('That member doesn’t have an open offer'), { status: 409 })
    }
    const parent = row[kind.parent]
    const user = row.member.user

    const token = jwt.sign(
        { purpose: 'offer', kind: kindName, parentId, memberId },
        process.env.JWT_SECRET,
        { expiresIn: '14d' }
    )
    // someone who owes for it accepts by paying, on its page
    const standing = await payable(prisma, memberId, kindName, parentId)
    const payFirst = Boolean(standing?.owes && !standing.sent)
    const sent = await sendEmail({
        to: user.email,
        subject: `A spot opened up: ${parent.title}`,
        ...actionEmail({
            heading: user.firstName ? `Good news, ${user.firstName}!` : 'Good news!',
            ...(payFirst ? { callout: dueCallout(parent) } : {}),
            lines: [
                `You’re off the waitlist! A spot opened up in ${parent.title} on ${when(parent)}.`,
                ...(payFirst
                    ? [
                        'It’s yours if you want it, but your spot can only be accepted once you pay. Send your payment on its page and the spot is yours. It’s officially confirmed once we approve the payment.',
                        'Payments aren’t refunded if you can’t make it, because we buy your materials ahead of time.'
                    ]
                    : ['It’s yours if you want it. Accept below and you’re officially signed up.'])
            ],
            button: payFirst
                ? { label: 'Pay to accept my spot', url: `${APP_URL}${kind.page(parentId)}` }
                : { label: 'Accept my spot', url: `${APP_URL}/offer?token=${token}` },
            after: [
                payFirst
                    ? `Please pay within ${OFFER_HOURS} hours. After that the spot may go to the next person on the waitlist, and you’ll move to the back of it.`
                    : `Please accept within ${OFFER_HOURS} hours. After that the spot may go to the next person on the waitlist, and you’ll move to the back of it.`
            ],
            reason: `You’re getting this because you joined the waitlist for ${parent.title}.`
        })
    })
    // without a mail service this is only printed to the server's console —
    // still worth recording, so the envelope shows it went
    const at = new Date()
    await prisma[kind.link].update({ where: where(kind, parentId, memberId), data: { offerSentAt: at } })
    return { sentAt: at, delivered: sent }
}

// offered -> rsvped. Anything else is left as it is and said back: already
// accepted, already checked in, back on the waitlist, or the offer's gone —
// or 'pay_first' for someone who owes for it, who accepts by paying instead.
export async function acceptOffer(kindName, parentId, memberId) {
    const kind = KINDS[kindName]
    const row = await prisma[kind.link].findUnique({
        where: where(kind, parentId, memberId),
        include: { [kind.parent]: { select: { title: true } } }
    })
    const title = row?.[kind.parent]?.title ?? null
    if (!row) { return { status: 'gone', title } }
    if (row.attendanceStatus === 'rsvped' || row.attendanceStatus === 'attended') {
        return { status: 'already', title }
    }
    if (row.attendanceStatus === 'waitlisted') { return { status: 'waitlisted', title } }
    if (row.attendanceStatus !== 'offered') { return { status: 'gone', title } }
    const standing = await payable(prisma, memberId, kindName, parentId)
    if (standing?.owes && !standing.sent) { return { status: 'pay_first', title } }
    // one who owes and has paid holds it, but isn't confirmed until the
    // payment's approved
    await takeOffer(kindName, parentId, memberId, { confirm: !standing?.owes })
    return { status: 'accepted', title }
}

// Someone holding an offer just sent a payment for it: that accepts it — the
// spot's theirs, confirmed once the payment's approved. Anything but an open
// offer is left alone. Returns whether it was taken.
export async function acceptByPaying(kindName, parentId, memberId) {
    const kind = KINDS[kindName]
    const row = await prisma[kind.link].findUnique({ where: where(kind, parentId, memberId) })
    if (row?.attendanceStatus !== 'offered') { return false }
    await takeOffer(kindName, parentId, memberId, { confirm: false })
    return true
}

// offered -> rsvped. Once a confirmation round has gone out, taking a spot
// counts as confirming it (`confirm` — not for one who's paid, whose approval
// does) — and either way the prelab follows them.
async function takeOffer(kindName, parentId, memberId, { confirm }) {
    const kind = KINDS[kindName]
    const parent = await prisma[kind.parent].findUnique({ where: { [kind.key]: parentId }, select: { confirmSentAt: true } })
    const late = Boolean(parent?.confirmSentAt)
    await prisma[kind.link].update({
        where: where(kind, parentId, memberId),
        data: { attendanceStatus: 'rsvped', offerSentAt: null, ...(late && confirm ? { confirmedAt: new Date() } : {}) }
    })
    if (late) {
        await sendPrelabTo(kindName, parentId, memberId).catch((err) =>
            console.error(`Prelab email failed: ${err.message}`))
    }
}

const HELD = { in: ['rsvped', 'attended', 'offered'] }

// Lapse every offer that's run out, and enforce missed confirmation deadlines
// where the waitlist needs the spots (see the top of this file). Run hourly,
// whenever a check-in page loads its roster, and when someone joins a
// waitlist — so the page never shows something that should have moved on.
export async function expireOffers() {
    const now = Date.now()
    const cutoff = new Date(now - OFFER_HOURS * HOUR)
    let lapsed = 0

    for (const kindName of Object.keys(KINDS)) {
        const kind = KINDS[kindName]

        // an offer nobody accepted in 48 hours — left alone in the last 48
        // hours before the lab or event, where the door handles it
        const stale = await prisma[kind.link].findMany({
            where: { attendanceStatus: 'offered', offerSentAt: { lte: cutoff } },
            include: { [kind.parent]: { select: { date: true, startTime: true, capacity: true } } }
        })
        for (const row of stale) {
            const parent = row[kind.parent]
            if (!parent.date || startsAt(parent).getTime() - now <= OFFER_HOURS * HOUR) { continue }
            const parentId = row[kind.key]
            await prisma.$transaction(async (tx) => {
                await lockParent(tx, kindName, parentId)
                await tx[kind.link].update({
                    where: where(kind, parentId, row.memberId),
                    data: { ...BACK_OF_WAITLIST, waitlistedAt: new Date() }
                })
                // the freed seat goes on down the waitlist, if there's room
                // under the cap for it
                if (parent.capacity == null) { return }
                const taken = await tx[kind.link].count({ where: { [kind.key]: parentId, attendanceStatus: HELD } })
                if (taken < parent.capacity) { await offerNext(tx, kindName, parentId) }
            })
            lapsed++
        }

        lapsed += await enforceConfirmations(kindName, now)
    }
    if (lapsed > 0) { console.log(`Offer sweep: ${lapsed} unanswered offer(s) or confirmation(s) passed on`) }
    return lapsed
}

// Missed confirmation deadlines only cost anyone their spot when somebody on
// the waitlist actually needs it. Per lab or event:
//
//   nobody waiting   the deadline isn't enforced — everyone who missed it
//                    keeps their spot, until someone joins the waitlist
//   people waiting   just enough of those who missed it are picked, at
//                    random, to make room for them: each is moved to the back
//                    of the waitlist and their spot offered to the top of it.
//                    With 10 seats all taken, 2 who missed it and 1 waiting,
//                    one of the 2 goes.
//
// Someone already moved back for missing the deadline doesn't count as
// waiting — otherwise two who both missed it would keep swapping places.
//
// Nor does it count anyone who owes for it: for them the deadline is a
// payment due date, and paying meets it (enforcePaymentRules in payments.js).
//
// No cap means no queue for seats, so there's nothing to enforce.
async function enforceConfirmations(kindName, now) {
    const kind = KINDS[kindName]
    const missed = await prisma[kind.link].findMany({
        where: { attendanceStatus: 'rsvped', confirmedAt: null, confirmBy: { lte: new Date(now) } },
        select: { memberId: true, [kind.key]: true }
    })
    // grouped by lab or event
    const byParent = new Map()
    for (const row of missed) {
        const id = row[kind.key]
        if ((await payable(prisma, row.memberId, kindName, id))?.owes) { continue }
        if (!byParent.has(id)) { byParent.set(id, []) }
        byParent.get(id).push(row.memberId)
    }

    let removed = 0
    for (const [parentId, memberIds] of byParent) {
        const moved = await prisma.$transaction(async (tx) => {
            await lockParent(tx, kindName, parentId)
            const parent = await tx[kind.parent].findUnique({ where: { [kind.key]: parentId }, select: { capacity: true } })
            if (!parent || parent.capacity == null) { return [] }
            const waiting = await tx[kind.link].count({
                where: { [kind.key]: parentId, attendanceStatus: 'waitlisted', confirmBy: null }
            })
            if (waiting === 0) { return [] }
            const taken = await tx[kind.link].count({ where: { [kind.key]: parentId, attendanceStatus: HELD } })

            // enough seats to fit everyone waiting under the cap — no more
            // than missed the deadline, and none if there's already room
            const needed = Math.min(memberIds.length, Math.max(0, taken + waiting - parent.capacity))
            const out = shuffle(memberIds).slice(0, needed)
            const back = new Date()
            for (const memberId of out) {
                await tx[kind.link].update({
                    where: where(kind, parentId, memberId),
                    data: { ...BACK_OF_WAITLIST, waitlistedAt: back }
                })
            }
            // hand every free seat on, one per person waiting — never more
            // than were already waiting, so those just moved back stay there
            let free = parent.capacity - (taken - out.length)
            while (free > 0 && await offerNext(tx, kindName, parentId)) { free-- }
            return out
        })
        for (const memberId of moved) {
            await notifyMovedToWaitlist({ kindName, parentId, memberId, reason: 'unconfirmed' })
        }
        removed += moved.length
    }
    return removed
}

// Fisher–Yates, on a copy — who loses their spot is left to chance
function shuffle(list) {
    const copy = [...list]
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
}

// For the /offer page: who and what a link is for — an offer to accept or a
// spot to confirm — or null if it's neither.
export function readOfferToken(token) {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        if (!['offer', 'confirm'].includes(decoded.purpose) || !KINDS[decoded.kind]) { return null }
        return decoded
    } catch {
        return null
    }
}

// ---- confirmations --------------------------------------------------------

// The lab's prelab as an attachment, or null. Events don't have one.
async function prelabOf(kindName, parentId) {
    if (kindName !== 'lab') { return null }
    const lab = await prisma.lab.findUnique({
        where: { labId: parentId },
        select: { prelabPdf: true, prelabPdfName: true }
    })
    return lab?.prelabPdf
        ? { filename: lab.prelabPdfName || 'prelab.pdf', content: Buffer.from(lab.prelabPdf) }
        : null
}

// 'Tuesday, September 29 at 5:00 PM' — on the club's clock, not the server's
function deadlineText(at) {
    return clubFormat(at, {
        weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit'
    })
}

// "confirmation": email everyone signed up a word about their spot, by
// `deadline` (a Date), with the prelab attached:
//
//   owes, nothing sent   paying is how they confirm — the button goes to its
//                        page, and the payment's due by the deadline, or a
//                        week before if that's sooner (the due date, big)
//   owes, payment        their spot's held while it's checked, and confirmed
//     waiting            once it's approved: nothing to do
//   nothing owed         "Confirm my spot" — the one-click link
//   already confirmed    paid and approved before this went out (that
//     by paying          confirms them): they're told they're set
//
// Sent again, it's an update: everyone asked last time and still unconfirmed
// gets `deadline` as their new one (and with it their payment due date, when
// it's sooner than the week before), in an email that says it's an updated
// date and to disregard the one before.
//
// Returns { sent, attached, updated } — `updated` when it replaced a deadline.
export async function sendConfirmations(kindName, parentId, deadline) {
    if (!(deadline instanceof Date) || isNaN(deadline.getTime()) || deadline.getTime() <= Date.now()) {
        throw Object.assign(new Error('Pick a deadline that hasn’t passed yet'), { status: 400 })
    }
    const kind = KINDS[kindName]
    const parent = await prisma[kind.parent].findUnique({ where: { [kind.key]: parentId } })
    if (!parent) { throw Object.assign(new Error(`That ${kind.noun} doesn’t exist`), { status: 404 }) }

    const include = { member: { select: { user: { select: { email: true, firstName: true } } } } }
    const [asking, paidUp] = await Promise.all([
        prisma[kind.link].findMany({ where: { [kind.key]: parentId, attendanceStatus: 'rsvped', confirmedAt: null }, include }),
        // confirmed by an approved payment, and never asked
        prisma[kind.link].findMany({ where: { [kind.key]: parentId, attendanceStatus: 'rsvped', confirmedAt: { not: null }, confirmSentAt: null }, include })
    ])
    if (asking.length === 0 && paidUp.length === 0) {
        throw Object.assign(new Error('Everyone signed up has already confirmed'), { status: 409 })
    }
    const prelab = await prelabOf(kindName, parentId)
    const page = `${APP_URL}${kind.page(parentId)}`
    const prelabLine = prelab ? ['The prelab is attached. Please read through it before the lab.'] : []
    const why = `You’re getting this because you signed up for ${parent.title}.`

    const later = `If we don’t hear back by then, your spot may go to someone on the waitlist, and you’ll move to the back of it.`
    // asked before: it says so, up top, with the deadline it replaces
    const asUpdate = (email, previous) => previous
        ? {
            ...email,
            heading: 'Your confirmation date has changed',
            callout: email.callout ?? { label: 'New confirmation date', text: deadlineText(deadline) },
            lines: [
                `The date to confirm by is now ${deadlineText(deadline)}. Please ignore the earlier one (${deadlineText(previous)}).`,
                ...email.lines
            ]
        }
        : email
    let sent = 0
    let updated = false
    for (const row of asking) {
        const user = row.member.user
        const previous = row.confirmSentAt && row.confirmBy ? row.confirmBy : null
        if (previous) { updated = true }
        const standing = await payable(prisma, row.memberId, kindName, parentId)
        const owes = Boolean(standing?.owes)
        const token = jwt.sign(
            { purpose: 'confirm', kind: kindName, parentId, memberId: row.memberId },
            process.env.JWT_SECRET,
            { expiresIn: '14d' }
        )
        await sendEmail({
            to: user.email,
            subject: previous ? `Updated confirmation date: ${parent.title}` : `Please confirm your spot: ${parent.title}`,
            ...actionEmail(asUpdate(owes && !standing.sent
                ? {
                    heading: user.firstName ? `Pay to confirm your spot, ${user.firstName}` : 'Pay to confirm your spot',
                    // sent back: the 48 hours to fix it are the due date now
                    callout: standing.fixBy
                        ? { label: 'New payment due', text: dueText(standing.fixBy) }
                        : dueCallout(parent, { confirmBy: deadline, payBy: row.payBy }),
                    lines: [
                        `You’re signed up for ${parent.title} on ${when(parent)}.`,
                        'To officially confirm your spot, you need to pay. Send your payment on its page. Once it’s sent your spot is held, and it’s confirmed when we approve it.',
                        standing.fixBy
                            ? `Your payment was sent back, so the due date has moved. It was due ${dueText(paymentDueAt(parent, { confirmBy: deadline }))}. Fix it and send it again by ${dueText(standing.fixBy)}, or you’ll be moved to the waitlist.`
                            : `Payment is due ${dueWhen(parent, { confirmBy: deadline, payBy: row.payBy })}. If you haven’t paid by then, you’ll be moved to the waitlist.`,
                        'Payments aren’t refunded if you can’t make it, because we buy your materials ahead of time.'
                    ],
                    button: { label: 'Pay to confirm my spot', url: page },
                    after: prelabLine,
                    reason: why
                }
                : owes
                ? {
                    heading: user.firstName ? `Your spot is held, ${user.firstName}` : 'Your spot is held',
                    callout: dueCallout(parent, { confirmBy: deadline, payBy: row.payBy }),
                    lines: [
                        `You’re signed up for ${parent.title} on ${when(parent)}, and we’ve got the payment you sent.`,
                        'It’s being checked now. Your spot is held until then, and it’s officially confirmed once we approve it. There’s nothing else to do.'
                    ],
                    button: { label: `See the ${kind.noun}`, url: page },
                    after: prelabLine,
                    reason: why
                }
                : {
                    heading: user.firstName ? `Still coming, ${user.firstName}?` : 'Still coming?',
                    lines: [
                        `You’re signed up for ${parent.title} on ${when(parent)}. Please confirm you’re still coming.`
                    ],
                    button: { label: 'Confirm my spot', url: `${APP_URL}/offer?token=${token}` },
                    after: [`Please confirm by ${deadlineText(deadline)}. ${later}`, ...prelabLine],
                    reason: why
                }, previous)),
            ...(prelab ? { attachments: [prelab] } : {})
        })
        await prisma[kind.link].update({
            where: where(kind, parentId, row.memberId),
            data: { confirmSentAt: new Date(), confirmBy: deadline }
        })
        sent++
    }
    for (const row of paidUp) {
        const user = row.member.user
        await sendEmail({
            to: user.email,
            subject: `You’re confirmed: ${parent.title}`,
            ...actionEmail({
                heading: user.firstName ? `You’re all set, ${user.firstName}` : 'You’re all set',
                callout: dueCallout(parent),
                lines: [
                    `You already paid for ${parent.title} on ${when(parent)}, so your spot is confirmed. There’s nothing else to do.`,
                    ...prelabLine
                ],
                button: { label: `See the ${kind.noun}`, url: page },
                reason: why
            }),
            ...(prelab ? { attachments: [prelab] } : {})
        })
        await prisma[kind.link].update({
            where: where(kind, parentId, row.memberId),
            data: { confirmSentAt: new Date() }
        })
        sent++
    }
    await prisma[kind.parent].update({ where: { [kind.key]: parentId }, data: { confirmSentAt: new Date() } })
    return { sent, attached: prelab?.filename ?? null, updated }
}

// rsvped + asked -> confirmed. Anything else is said back as it is —
// 'already' if they're confirmed (an approved payment confirms them too),
// 'pay_first' if they owe and haven't sent a payment in yet, and 'held' if
// they owe and have: their payment's approval confirms them, not this.
export async function confirmSpot(kindName, parentId, memberId) {
    const kind = KINDS[kindName]
    const row = await prisma[kind.link].findUnique({
        where: where(kind, parentId, memberId),
        include: { [kind.parent]: { select: { title: true } } }
    })
    const title = row?.[kind.parent]?.title ?? null
    if (!row) { return { status: 'gone', title } }
    if (row.attendanceStatus === 'attended' || row.confirmedAt) { return { status: 'already', title } }
    if (row.attendanceStatus === 'waitlisted') { return { status: 'waitlisted', title } }
    if (row.attendanceStatus !== 'rsvped') { return { status: 'gone', title } }
    const standing = await payable(prisma, memberId, kindName, parentId)
    if (standing?.owes) { return { status: standing.sent ? 'held' : 'pay_first', title } }
    await prisma[kind.link].update({
        where: where(kind, parentId, memberId),
        data: { confirmedAt: new Date() }
    })
    return { status: 'confirmed', title }
}

// Someone who's just accepted a spot after the confirmation round went out:
// the prelab they'd otherwise have missed.
async function sendPrelabTo(kindName, parentId, memberId) {
    const prelab = await prelabOf(kindName, parentId)
    if (!prelab) { return }
    const kind = KINDS[kindName]
    const row = await prisma[kind.link].findUnique({
        where: where(kind, parentId, memberId),
        include: {
            [kind.parent]: true,
            member: { select: { user: { select: { email: true, firstName: true } } } }
        }
    })
    const parent = row[kind.parent]
    await sendEmail({
        to: row.member.user.email,
        subject: `Prelab for ${parent.title}`,
        ...actionEmail({
            heading: 'Here’s your prelab',
            lines: [
                `You’re signed up for ${parent.title} on ${when(parent)}.`,
                'The prelab is attached. Please read through it before the lab.'
            ],
            reason: `You’re getting this because you took a spot in ${parent.title}.`
        }),
        attachments: [prelab]
    })
}
