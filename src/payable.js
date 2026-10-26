import { clubFormat, clubInstant, clubToday, startsAt } from './clubTime.js'
import { DUES_EXEMPT, asksDues, schoolYearOf } from './dues.js'

// Where someone stands on paying for one lab or event — what the door would
// charge them, whether they've sent a payment in, and when it's due. Its own
// file because both sides of the spot rules need it: src/offers.js (confirming
// a spot or accepting an offer waits on a payment) and src/payments.js
// (approving one, and moving people who didn't pay to the waitlist).
//
// The due date: a week before the lab or event, at 11:59 PM on the club's
// clock — a Friday lab's is the Friday before — or, for someone asked to
// confirm their spot by an earlier deadline than that (the check-in page's
// "confirmation"), that deadline. Anyone signed up who still owes and hasn't
// sent anything in by then is moved to the waitlist. Someone who comes to owe
// after it's passed — signed up late, or had their entry taken back — gets 48
// hours from then instead (LATE_HOURS, `payBy` on their row), with a reminder
// a day.
//
// Paying stands in for confirming: someone who owes can't confirm their spot
// or accept an offer of one with a button — sending the payment does it. Once
// it's sent they hold the spot (an offer becomes theirs, and no confirmation
// deadline or offer's 48 hours can take it); once it's approved they're
// officially confirmed. A payment that's sent but still waiting to be checked
// keeps their spot until it's looked at; one sent back has 48 hours to be
// fixed (REVISE_HOURS); one rejected moves them to the waitlist.

// the two kinds of thing a fee can be for
export const ITEMS = {
    lab: { model: 'lab', link: 'memberLab', key: 'labId', compound: 'memberId_labId', page: (id) => `/labs/view?id=${id}` },
    event: { model: 'event', link: 'memberEvent', key: 'eventId', compound: 'memberId_eventId', page: (id) => `/events/view?id=${id}` }
}

// the spot a fee is paid on — signed up, not just queued for one
export const HOLDS = ['rsvped', 'offered', 'absent']

// how long a sent-back payment has to be fixed and sent again
export const REVISE_HOURS = 48
// how long someone who came to owe after the due date has to pay
export const LATE_HOURS = 48
// how often someone owing is reminded, signed up late or offered a spot
export const REMIND_HOURS = 24
// how long an emailed offer of a spot lasts (see src/offers.js)
export const OFFER_HOURS = 48

// When an offer on `link` (emailed at its offerSentAt) lapses for `parent`, or
// null: not emailed yet, or it's inside the last 48 hours before it starts,
// where offers are left to the door (expireOffers in offers.js)
export function offerLapse(link, parent, now = new Date()) {
    if (!link?.offerSentAt || !parent?.date) return null
    if (startsAt(parent).getTime() - now.getTime() <= OFFER_HOURS * 3_600_000) return null
    return new Date(new Date(link.offerSentAt).getTime() + OFFER_HOURS * 3_600_000)
}

// When `row`'s (a lab's or event's) payment is due, for someone whose own row
// for it (`link`: their member_lab / member_event, or anything with its
// `confirmBy` and `payBy`) says: { at, by } — `by` is
//
//   'week'     the day a week before, at 23:59 club time
//   'confirm'  their confirmation deadline, when it's earlier than that
//   'late'     the 48 hours they were given, owing after it had passed
//
// Null for a draft with no date.
export function paymentDue(row, link = null) {
    if (!row?.date) return null
    if (link?.payBy) return { at: new Date(link.payBy), by: 'late' }
    const day = new Date(row.date.getTime() - 7 * 86_400_000).toISOString().slice(0, 10)
    const week = clubInstant(day, '23:59')
    const confirm = link?.confirmBy ? new Date(link.confirmBy) : null
    return confirm && confirm < week ? { at: confirm, by: 'confirm' } : { at: week, by: 'week' }
}

export function paymentDueAt(row, link = null) {
    return paymentDue(row, link)?.at ?? null
}

// 'Friday, October 22 at 11:59 PM'
export function dueText(at) {
    return clubFormat(at, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// 'a week before it starts, by Friday, October 22 at 11:59 PM' / 'by your
// confirmation deadline, Tuesday, October 12 at 5:00 PM' / 'within 48 hours,
// by …', or null
export function dueWhen(row, link = null) {
    const due = paymentDue(row, link)
    if (!due) return null
    if (due.by === 'late') return `within ${LATE_HOURS} hours, by ${dueText(due.at)}, since the usual due date had already passed`
    return due.by === 'confirm'
        ? `by your confirmation deadline, ${dueText(due.at)}`
        : `a week before it starts, by ${dueText(due.at)}`
}

// The big line every lab or event payment email carries (emailTemplate's
// `callout`), or undefined when there's no date.
export function dueCallout(row, link = null) {
    const at = paymentDueAt(row, link)
    return at ? { label: 'Payment due', text: dueText(at) } : undefined
}

// What on `memberId`'s row for one lab or event moves their payment due date
// (paymentDue): { confirmBy, payBy }, or null if they have none
export async function dueLinkOf(db, memberId, kindName, id) {
    const kind = ITEMS[kindName]
    return db[kind.link].findUnique({
        where: { [kind.compound]: { memberId, [kind.key]: id } },
        select: { confirmBy: true, payBy: true }
    })
}

// When a payment sent back at `reviewedAt` has to be sent again by
export function reviseBy(reviewedAt) {
    return new Date(new Date(reviewedAt).getTime() + REVISE_HOURS * 3_600_000)
}

// Where `memberId` stands, from one lab's or event's page (`kindName`, `id`)
// or from /vip (both null):
//
//   { item       { kind, id, title, date } — null from /vip
//     schoolYear the dues year it's about (the lab's, or this one)
//     exempt     staff, who never pay
//     duesPaid   the year's dues are settled — nothing to pay at all
//     door       'fee' / 'waive' — the entry's settled for this one
//     holds      signed up for it (a fee can only be paid on a spot)
//     owes       the door would ask them — signed up or not
//     price      its non-member price (0 = none, or /vip)
//     dueAt      when it's due (a week before, 11:59 PM, or their
//                confirmation deadline if that's sooner, or the 48 hours
//                they were given owing late), or null
//     dueBy      'week' / 'confirm' / 'late' — which it is
//     sent       they've sent a payment in that covers it, waiting or
//                approved (paymentSent)
//     fixBy      their newest payment for it was sent back: the new due
//                date, 48 hours on (reviseBy) — else null
//     nextDue    from /vip only: when their dues have to be in by to keep a
//                spot (nextDueOf), or null
//     choices    [{ kind: 'fee' | 'dues', amount }] — what they could pay
//                for now }
//
// Null if the lab or event doesn't exist.
export async function payable(db, memberId, kindName = null, id = null) {
    let item = null
    let link = null
    let row = null
    if (kindName) {
        const kind = ITEMS[kindName]
        row = await db[kind.model].findUnique({ where: { [kind.key]: id } })
        if (!row) return null
        item = { kind: kindName, id, title: row.title, date: row.date }
        link = await db[kind.link].findUnique({ where: { [kind.compound]: { memberId, [kind.key]: id } } })
    }
    const schoolYear = schoolYearOf(item?.date ? item.date.toISOString().slice(0, 10) : clubToday())
    const [member, target, paid] = await Promise.all([
        db.member.findUnique({ where: { userId: memberId }, select: { role: true } }),
        db.yearTarget.findUnique({ where: { schoolYear }, select: { duesAmount: true } }),
        db.duesPayment.findUnique({ where: { memberId_schoolYear: { memberId, schoolYear } } })
    ])
    const exempt = !member || DUES_EXEMPT.includes(member.role)
    const duesPaid = Boolean(paid)
    const door = link?.doorPayment ?? null
    const holds = HOLDS.includes(link?.attendanceStatus)
    const duesAmount = Number(target?.duesAmount ?? 0)
    const price = Number(row?.nonmemberPrice ?? 0)
    // a lab, or a members-only event — one open to all charges nobody
    const charges = row ? asksDues(kindName, row) : true

    const choices = []
    if (!exempt && !duesPaid) {
        if (charges && item && holds && !door && price > 0) choices.push({ kind: 'fee', amount: price })
        if (charges && duesAmount > 0) choices.push({ kind: 'dues', amount: duesAmount })
    }
    const owes = Boolean(item) && !exempt && !duesPaid && !door && charges && (price > 0 || duesAmount > 0)
    const due = paymentDue(row, link)
    const sent = item ? await paymentSent(db, memberId, kindName, id, schoolYear) : false
    const fixBy = item && !sent ? await sentBackBy(db, memberId, kindName, id) : null
    const nextDue = !kindName && !exempt && !duesPaid ? await nextDueOf(db, memberId) : null
    return {
        item, schoolYear, exempt, duesPaid, door, holds, owes, price,
        dueAt: due?.at ?? null, dueBy: due?.by ?? null, sent, fixBy, nextDue, choices
    }
}

// Whether they've sent a payment in that covers this one and hasn't been
// turned down: its fee, or the year's dues, waiting or approved.
export async function paymentSent(db, memberId, kindName, id, schoolYear) {
    const key = ITEMS[kindName].key
    const found = await db.memberPayment.findFirst({
        where: {
            memberId,
            status: { in: ['pending', 'approved'] },
            OR: [{ kind: 'fee', [key]: id }, { kind: 'dues', schoolYear }]
        },
        select: { paymentId: true }
    })
    return Boolean(found)
}

// When their newest payment for this one has to be fixed and sent again by,
// if it was sent back — the due date that takes over from the old one — or
// null.
export async function sentBackBy(db, memberId, kindName, id) {
    const newest = await db.memberPayment.findFirst({
        where: { memberId, [ITEMS[kindName].key]: id },
        orderBy: { submittedAt: 'desc' },
        select: { status: true, reviewedAt: true }
    })
    return newest?.status === 'rejected' && newest.reviewedAt ? reviseBy(newest.reviewedAt) : null
}

// For /vip: VIP dues on their own aren't due by any day. They are once
// someone's signed up for (or been offered) a lab or event they'd pay for —
// paying the dues pays for it. Of those they owe for and haven't paid, the one
// happening soonest: its due date, as that one's page has it —
//
//   'week' / 'confirm' / 'late'  signed up (paymentDue)
//   'fix'                        signed up, a payment sent back: 48 hours on
//   'offer'                      offered: when the offer lapses
//   'start'                      offered, inside the last 48 hours: before it
//                                starts
//
// { kind, id, title, at, by, amount }, or null. Moved off it to the
// waitlist, it's the next one's — or nothing, with nothing else.
export async function nextDueOf(db, memberId, now = new Date()) {
    return (await duesDeadlines(db, memberId, now))[0] ?? null
}

// Every one of those due dates, soonest happening first — the calendar's red
// days. `amount` is what it'd take: its fee, or the year's dues if it has none.
export async function duesDeadlines(db, memberId, now = new Date()) {
    const spots = []
    for (const kindName of Object.keys(ITEMS)) {
        const kind = ITEMS[kindName]
        const rows = await db[kind.link].findMany({
            where: { memberId, attendanceStatus: { in: ['rsvped', 'offered'] } },
            include: { [kind.model]: true }
        })
        for (const link of rows) {
            const parent = link[kind.model]
            if (!parent?.date || startsAt(parent).getTime() <= now.getTime()) continue
            spots.push({ kindName, link, parent, starts: startsAt(parent) })
        }
    }
    spots.sort((a, b) => a.starts - b.starts)
    const deadlines = []
    for (const { kindName, link, parent, starts } of spots) {
        const id = parent[ITEMS[kindName].key]
        const standing = await payable(db, memberId, kindName, id)
        if (!standing?.owes || standing.sent) continue
        let due
        if (link.attendanceStatus === 'offered') {
            const lapse = offerLapse(link, parent, now)
            due = lapse ? { at: lapse, by: 'offer' } : { at: starts, by: 'start' }
        } else if (standing.fixBy) {
            due = { at: standing.fixBy, by: 'fix' }
        } else {
            due = { at: standing.dueAt, by: standing.dueBy }
        }
        const amount = standing.price > 0
            ? standing.price
            : standing.choices.find((choice) => choice.kind === 'dues')?.amount ?? 0
        deadlines.push({ kind: kindName, id, title: parent.title, amount, ...due })
    }
    return deadlines
}
