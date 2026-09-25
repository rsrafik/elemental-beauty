import jwt from 'jsonwebtoken'
import prisma from './prismaClient.js'
import { sendEmail } from './email.js'
import { actionEmail } from './emailTemplate.js'
import { APP_URL } from './verification.js'

// Waitlist offers, for labs and events alike.
//
// Someone moved off a waitlist doesn't get the spot outright: they're
// `offered` — the seat is held for them, and they sit in the check-in page's
// "not checked in" column with a blue envelope. The envelope emails them an
// "Accept" button; accepting (the emailed link, or the lab's own page) makes
// them `rsvped`, officially signed up.
//
// An offer lapses when it's gone 48 hours unanswered since the email AND the
// lab or event is still more than 48 hours off: they're dropped, and the next
// person on the waitlist is offered the spot in their place (waiting for an
// officer to send them their envelope). Inside those last 48 hours an
// unanswered offer is left alone — the officers at the door handle it.
//
// People are moved off a waitlist three ways, and all three land here as an
// offer: an officer's yellow button, a seat freed by someone un-RSVPing or
// being removed, and a lapsed offer handing on.
//
// Confirmations work the same way the other way round. The check-in page's
// "confirmation" emails everyone signed up who hasn't confirmed yet a
// "Confirm my spot" button (with a lab's prelab PDF attached). Anyone who
// hasn't confirmed 48 hours after that email, while the lab or event is still
// more than 48 hours off, loses the spot — and it's offered on down the
// waitlist. Once a confirmation round has gone out, accepting an offer counts
// as confirming, and a lab's prelab is emailed to whoever accepts.

export const OFFER_HOURS = 48
const HOUR = 60 * 60 * 1000

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
        // members don't have a page per event yet
        page: () => '/events'
    }
}

const where = (kind, parentId, memberId) => ({ [kind.compound]: { memberId, [kind.key]: parentId } })

// When a lab or event starts, in the server's own timezone — its date, at its
// start time (the top of the day if it has none).
export function startsAt(row) {
    const day = row.date.toISOString().slice(0, 10)
    return new Date(`${day}T${row.startTime || '00:00'}:00`)
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
        data: { attendanceStatus: 'offered', waitlistedAt: null, offerSentAt: null }
    })
    return next.memberId
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
    const sent = await sendEmail({
        to: user.email,
        subject: `A spot opened up: ${parent.title}`,
        ...actionEmail({
            heading: user.firstName ? `Good news, ${user.firstName}!` : 'Good news!',
            lines: [
                `You’re off the waitlist — a spot opened up in ${parent.title} on ${when(parent)}.`,
                'It’s yours if you want it. Accept below and you’re officially signed up.'
            ],
            button: { label: 'Accept my spot', url: `${APP_URL}/offer?token=${token}` },
            after: [
                `Please accept within ${OFFER_HOURS} hours — after that the spot may go to the next person on the waitlist.`
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
// accepted, already checked in, or the offer's gone.
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
    if (row.attendanceStatus !== 'offered') { return { status: 'gone', title } }
    // once a confirmation round has gone out, taking a spot counts as
    // confirming it — and the prelab follows them
    const parent = await prisma[kind.parent].findUnique({ where: { [kind.key]: parentId }, select: { confirmSentAt: true } })
    const confirming = Boolean(parent?.confirmSentAt)
    await prisma[kind.link].update({
        where: where(kind, parentId, memberId),
        data: { attendanceStatus: 'rsvped', offerSentAt: null, ...(confirming ? { confirmedAt: new Date() } : {}) }
    })
    if (confirming) {
        await sendPrelabTo(kindName, parentId, memberId).catch((err) =>
            console.error(`Prelab email failed: ${err.message}`))
    }
    return { status: 'accepted', title }
}

// Lapse every offer that's run out (see the top of this file). Run hourly and
// whenever a check-in page loads its roster, so the page never shows one
// that should already have moved on.
export async function expireOffers() {
    const now = Date.now()
    const cutoff = new Date(now - OFFER_HOURS * HOUR)
    let lapsed = 0

    for (const kindName of Object.keys(KINDS)) {
        const kind = KINDS[kindName]
        // an offer nobody accepted, and a spot nobody confirmed
        const stale = await prisma[kind.link].findMany({
            where: {
                OR: [
                    { attendanceStatus: 'offered', offerSentAt: { lte: cutoff } },
                    { attendanceStatus: 'rsvped', confirmedAt: null, confirmSentAt: { lte: cutoff } }
                ]
            },
            include: { [kind.parent]: { select: { date: true, startTime: true, capacity: true } } }
        })
        for (const row of stale) {
            const parent = row[kind.parent]
            if (!parent.date || startsAt(parent).getTime() - now <= OFFER_HOURS * HOUR) { continue }
            const parentId = row[kind.key]
            await prisma.$transaction(async (tx) => {
                await tx[kind.link].delete({ where: where(kind, parentId, row.memberId) })
                // the freed seat goes on down the waitlist, if there's room
                // under the cap for it
                if (parent.capacity == null) { return }
                const taken = await tx[kind.link].count({
                    where: { [kind.key]: parentId, attendanceStatus: { in: ['rsvped', 'attended', 'offered'] } }
                })
                if (taken < parent.capacity) { await offerNext(tx, kindName, parentId) }
            })
            lapsed++
        }
    }
    if (lapsed > 0) { console.log(`Offer sweep: ${lapsed} unanswered offer(s) or confirmation(s) passed on`) }
    return lapsed
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

// "confirmation": email everyone signed up who hasn't confirmed yet a link to
// confirm their spot, with the prelab attached. Returns { sent, attached }.
export async function sendConfirmations(kindName, parentId) {
    const kind = KINDS[kindName]
    const parent = await prisma[kind.parent].findUnique({ where: { [kind.key]: parentId } })
    if (!parent) { throw Object.assign(new Error(`That ${kind.noun} doesn’t exist`), { status: 404 }) }

    const rows = await prisma[kind.link].findMany({
        where: { [kind.key]: parentId, attendanceStatus: 'rsvped', confirmedAt: null },
        include: { member: { select: { user: { select: { email: true, firstName: true } } } } }
    })
    if (rows.length === 0) {
        throw Object.assign(new Error('Everyone signed up has already confirmed'), { status: 409 })
    }
    const prelab = await prelabOf(kindName, parentId)

    let sent = 0
    for (const row of rows) {
        const user = row.member.user
        const token = jwt.sign(
            { purpose: 'confirm', kind: kindName, parentId, memberId: row.memberId },
            process.env.JWT_SECRET,
            { expiresIn: '14d' }
        )
        await sendEmail({
            to: user.email,
            subject: `Please confirm your spot: ${parent.title}`,
            ...actionEmail({
                heading: user.firstName ? `Still coming, ${user.firstName}?` : 'Still coming?',
                lines: [
                    `You’re signed up for ${parent.title} on ${when(parent)}. Please confirm you’re still coming.`
                ],
                button: { label: 'Confirm my spot', url: `${APP_URL}/offer?token=${token}` },
                after: [
                    `Please confirm within ${OFFER_HOURS} hours — if we don’t hear back, your spot may go to someone on the waitlist.`,
                    ...(prelab ? ['The prelab is attached — please read through it before the lab.'] : [])
                ],
                reason: `You’re getting this because you signed up for ${parent.title}.`
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
    return { sent, attached: prelab?.filename ?? null }
}

// rsvped + asked -> confirmed. Anything else is said back as it is.
export async function confirmSpot(kindName, parentId, memberId) {
    const kind = KINDS[kindName]
    const row = await prisma[kind.link].findUnique({
        where: where(kind, parentId, memberId),
        include: { [kind.parent]: { select: { title: true } } }
    })
    const title = row?.[kind.parent]?.title ?? null
    if (!row) { return { status: 'gone', title } }
    if (row.attendanceStatus === 'attended' || row.confirmedAt) { return { status: 'already', title } }
    if (row.attendanceStatus !== 'rsvped') { return { status: 'gone', title } }
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
                'The prelab is attached — please read through it before the lab.'
            ],
            reason: `You’re getting this because you took a spot in ${parent.title}.`
        }),
        attachments: [prelab]
    })
}
