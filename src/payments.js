import prisma from './prismaClient.js'
import { sendEmail } from './email.js'
import { actionEmail } from './emailTemplate.js'
import { APP_URL } from './verification.js'
import { fullName, log } from './activity.js'
import { clubToday, dateColumn, startsAt } from './clubTime.js'
import { treasurers } from './reimbursementEmails.js'
import { ledgerSource, recordDues } from './dues.js'
import { lockParent, moveToWaitlist, notifyMovedToWaitlist } from './offers.js'
import {
    HOLDS, ITEMS, LATE_HOURS, REMIND_HOURS, REVISE_HOURS,
    dueCallout, dueLinkOf, dueText, dueWhen, goggleDueAt, offerLapse, payable, paymentDue, paymentDueAt, reviseBy
} from './payable.js'

// Payments a member makes on their own — Venmo, Zelle, whatever's on the
// accepted payments card — and tells the club about (MemberPayment in
// schema.prisma), plus the other ways the door's money gets taken back. The
// routes are routes/paymentRoutes.js; this is what they and the check-in page
// share:
//
//   approvePayment   writes the income row and settles it — the same as the
//                    door's "paid entry" / "paid dues" — and confirms their
//                    spot in the lab or event it was sent from
//   declinePayment   "reject": not accepted, and they're moved to that lab's
//                    or event's waitlist ("send back" is the gentler one: they
//                    fix it and send it again, within 48 hours)
//   enforcePaymentRules  the hourly sweep: a payment due date that's passed
//                    (a week before, 11:59 PM, or someone's confirmation
//                    deadline if that's sooner) moves whoever owes and sent
//                    nothing to the waitlist, and so does a sent-back payment
//                    left unfixed for 48 hours. One that's sent and waiting
//                    keeps their spot until somebody looks at it. Whoever
//                    comes to owe after the due date gets 48 hours of their
//                    own (owingLate), and they and anyone offered a spot who
//                    owes are reminded once a day.
//   undoDoorPayment  the check-in page's grey $: the entry paid (or waived)
//                    for one lab or event taken back, and its income row out
//                    of the ledger
//   releaseLedgerRow what deleting an income row (the ledger's bin, the dues
//                    card's undo) does to whatever was settled by it
//
// Paid entries aren't refunded if someone can't come after all — the club
// buys the materials ahead — so leaving a lab is just leaving it.
//
// And the emails around them: every one about a lab's or event's payment
// carries its due date, big (dueCallout). None of them follows the /account
// switches: they're about the person's own money, like a receipt's.

// what a member can pay for, and the due-date rules — see payable.js
export { HOLDS, ITEMS, payable }

// The treasurer and admin keep the books. J-board's treasury team gets past a
// 'treasurer' gate elsewhere (requireRole), but only for grants and
// sponsorships, so it's named here rather than ranked.
export function keepsBooks(req) {
    return req.role === 'treasurer' || req.role === 'admin'
}

// Officers and up run the door, and with it the check-in page's payments:
// approving what members sent in, sending it back or rejecting it.
const DOOR = ['officer', 'jboard', 'treasurer', 'admin']
export function runsDoor(req) {
    return DOOR.includes(req.role)
}

const money = (amount) => Number(amount).toLocaleString('en-US', { style: 'currency', currency: 'USD' })

const dayText = (date) => date
    ? new Date(`${date.toISOString().slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : 'the day'

const conflict = (message) => Object.assign(new Error(message), { status: 409 })

// 'lab' / 'event' and its id, for a payment (or any row with labId / eventId)
export function itemOf(row) {
    if (row.labId != null) return ['lab', row.labId]
    if (row.eventId != null) return ['event', row.eventId]
    return null
}

// ---- approving ---------------------------------------------------------------

// The include every payment read needs: who, from where, and how.
export const PAYMENT_INCLUDE = {
    member: { select: { role: true, user: { select: { firstName: true, lastName: true, username: true, email: true } } } },
    lab: { select: { labId: true, title: true, date: true, startTime: true } },
    event: { select: { eventId: true, title: true, date: true, startTime: true } }
}

// Approve `payment` (read with PAYMENT_INCLUDE) inside `tx`: the income row,
// and what it settles —
//
//   dues     their DuesPayment for the year (they turn VIP), filed under 'dues'
//   fee      the entry for its lab or event, filed under 'fees', kept on their
//            row there so the door's $ goes grey and the tick doesn't ask
//   goggles  a pair of goggles rented for its lab, filed under
//            'goggle_rental' — nothing else hangs on it (see payable.js)
//
// The row's title is ledgerSource's — 'Mina Reyes — Body Butter — #4F2K9 —
// Venmo'. Refused (409) when it's already been settled some other way —
// paid at the door, say — so the money can't land twice.
export async function approvePayment(tx, payment, actorId) {
    if (payment.status !== 'pending') throw conflict('Only a pending payment can be approved')
    const { user } = payment.member
    const name = fullName(user)
    const from = payment.lab ?? payment.event
    const paidBy = { reference: payment.reference, method: payment.methodTitle }
    const day = dateColumn(clubToday())

    if (payment.kind === 'goggles') {
        if (!payment.lab) throw conflict('That lab is gone')
        const ledger = await tx.transaction.create({
            data: {
                type: 'income',
                source: ledgerSource({ name, what: `Goggle rental (${payment.lab.title})`, ...paidBy }),
                amount: payment.amount,
                category: 'goggle_rental',
                date: day
            }
        })
        const approved = await tx.memberPayment.update({
            where: { paymentId: payment.paymentId },
            data: { status: 'approved', reviewedAt: new Date(), rejectionReason: null, transactionId: ledger.transactionId },
            include: PAYMENT_INCLUDE
        })
        return { ...approved, confirmed: false }
    }

    const paid = await tx.duesPayment.findUnique({
        where: { memberId_schoolYear: { memberId: payment.memberId, schoolYear: payment.schoolYear } }
    })
    if (paid) throw conflict(`Their ${payment.schoolYear} dues are already paid, so nothing's owed`)

    let transactionId
    if (payment.kind === 'dues') {
        const created = await recordDues(tx, {
            memberId: payment.memberId, user, schoolYear: payment.schoolYear,
            amount: Number(payment.amount), day, actorId,
            source: ledgerSource({ name, what: `VIP dues ${payment.schoolYear}${from ? ` (${from.title})` : ''}`, ...paidBy })
        })
        transactionId = created.transactionId
    } else {
        const [kindName, id] = itemOf(payment) ?? []
        if (!kindName) throw conflict('That lab or event is gone')
        const kind = ITEMS[kindName]
        const where = { [kind.compound]: { memberId: payment.memberId, [kind.key]: id } }
        const link = await tx[kind.link].findUnique({ where })
        if (!link || !HOLDS.includes(link.attendanceStatus)) {
            throw conflict(`They aren’t signed up for ${from.title} any more`)
        }
        if (link.doorPayment) throw conflict(`Their entry for ${from.title} is already settled`)
        const ledger = await tx.transaction.create({
            data: {
                type: 'income',
                source: ledgerSource({ name, what: from.title, ...paidBy }),
                amount: payment.amount,
                category: 'fees',
                date: day
            }
        })
        transactionId = ledger.transactionId
        await tx[kind.link].update({ where, data: { doorPayment: 'fee', doorTransactionId: transactionId } })
        await log({
            actorId, action: 'fee_paid', targetId: payment.memberId,
            details: { schoolYear: payment.schoolYear, kind: kindName, id, title: from.title, amount: Number(payment.amount) }
        }, tx)
    }

    // Paying is confirming: someone signed up for the lab or event it was sent
    // from is confirmed for it — before a confirmation round, or instead of
    // answering one. (Sending it took an offer they held — acceptByPaying.)
    let confirmed = false
    const at = itemOf(payment)
    if (at) {
        const kind = ITEMS[at[0]]
        const where = { [kind.compound]: { memberId: payment.memberId, [kind.key]: at[1] } }
        const link = await tx[kind.link].findUnique({ where })
        if (link?.attendanceStatus === 'rsvped') {
            if (!link.confirmedAt) await tx[kind.link].update({ where, data: { confirmedAt: new Date() } })
            confirmed = true
        }
    }

    const approved = await tx.memberPayment.update({
        where: { paymentId: payment.paymentId },
        data: { status: 'approved', reviewedAt: new Date(), rejectionReason: null, transactionId },
        include: PAYMENT_INCLUDE
    })
    return { ...approved, confirmed }
}

// "Reject", inside `tx`: not accepted, and they're moved to the back of the
// waitlist of the lab or event it was sent from (VIP dues sent from /vip have
// none, so they're only turned down — and so is a goggle rental, which no
// spot hangs on). `reason` is optional. Returns the payment, with `moved`.
export async function declinePayment(tx, payment, reason) {
    if (payment.status !== 'pending') throw conflict('Only a pending payment can be rejected')
    const declined = await tx.memberPayment.update({
        where: { paymentId: payment.paymentId },
        data: { status: 'declined', rejectionReason: reason || null, reviewedAt: new Date() },
        include: PAYMENT_INCLUDE
    })
    let moved = false
    const at = payment.kind === 'goggles' ? null : itemOf(payment)
    if (at) {
        await lockParent(tx, at[0], at[1])
        moved = await moveToWaitlist(tx, at[0], at[1], payment.memberId)
    }
    return { ...declined, moved }
}

// ---- the due date ------------------------------------------------------------

// The hourly sweep (and every check-in page's roster read), three rules:
//
//   sent back, not fixed  a payment sent back for a lab or event and not sent
//                         again within 48 hours: it's declined, and they're
//                         moved to that one's waitlist
//   an early deadline     someone asked to confirm by a deadline sooner than
//                         the week before: that's their due date, so once it
//                         passes, owing and with nothing sent in, they're
//                         moved to the waitlist
//   the due date          once a lab's or event's due date passes (a week
//                         before, 11:59 PM), everyone signed up who owes and
//                         has sent nothing in is moved to its waitlist — once
//                         per lab or event (paymentsDueSweptAt)
//   owing late            anyone signed up who comes to owe after that (signed
//                         up late, or an entry taken back) gets 48 hours from
//                         then (owingLate) and a reminder a day; past them,
//                         with nothing sent, they're moved to its waitlist
//   offered, owing        someone holding an offer they'd have to pay for is
//                         reminded once a day, until they pay or it lapses
//
// A payment waiting to be checked keeps their spot through any of them, and
// so does one sent back that's still inside its 48 hours. Each person moved is
// emailed why. Returns how many were moved.
export async function enforcePaymentRules(now = new Date()) {
    let moved = 0
    const cutoff = new Date(now.getTime() - REVISE_HOURS * 3_600_000)

    // Owes for it, has sent nothing in, and isn't fixing one sent back: the
    // spot goes to the waitlist (emailed why, with `missedBy` — a late one's
    // 48 hours, which moving clears). Returns whether it did.
    const moveUnpaid = async (kindName, id, memberId, missedBy = null) => {
        const standing = await payable(prisma, memberId, kindName, id)
        if (!standing?.owes || standing.sent) return false
        const fixing = await prisma.memberPayment.count({
            where: { memberId, status: 'rejected', reviewedAt: { gt: cutoff }, [ITEMS[kindName].key]: id }
        })
        if (fixing > 0) return false
        const wasMoved = await prisma.$transaction(async (tx) => {
            await lockParent(tx, kindName, id)
            return moveToWaitlist(tx, kindName, id, memberId)
        })
        if (wasMoved) {
            moved++
            await notifyMovedToWaitlist({ kindName, parentId: id, memberId, reason: 'unpaid', missedBy })
        }
        return wasMoved
    }

    // sent back and left
    const stale = await prisma.memberPayment.findMany({
        // (a goggle rental sent back isn't anyone's spot — its own deadline
        // is the day before)
        where: {
            status: 'rejected', reviewedAt: { lte: cutoff }, kind: { in: ['fee', 'dues'] },
            OR: [{ labId: { not: null } }, { eventId: { not: null } }]
        },
        include: { lab: true, event: true }
    })
    for (const payment of stale) {
        const [kindName, id] = itemOf(payment)
        const parent = payment.lab ?? payment.event
        // it's happened (or is happening) — the door has it now
        if (!parent?.date || startsAt(parent).getTime() <= now.getTime()) continue
        // they sent another since, which stands on its own
        const newer = await prisma.memberPayment.count({
            where: { memberId: payment.memberId, submittedAt: { gt: payment.submittedAt }, [ITEMS[kindName].key]: id }
        })
        if (newer > 0) continue
        const wasMoved = await prisma.$transaction(async (tx) => {
            await tx.memberPayment.update({ where: { paymentId: payment.paymentId }, data: { status: 'declined' } })
            await lockParent(tx, kindName, id)
            return moveToWaitlist(tx, kindName, id, payment.memberId)
        })
        if (wasMoved) {
            moved++
            await notifyMovedToWaitlist({ kindName, parentId: id, memberId: payment.memberId, reason: 'not_revised' })
        }
    }

    // an early deadline — only where the week-before sweep is still to come
    // (one that's run has had its say)
    for (const kindName of Object.keys(ITEMS)) {
        const kind = ITEMS[kindName]
        const asked = await prisma[kind.link].findMany({
            where: {
                attendanceStatus: 'rsvped', confirmedAt: null, confirmBy: { lte: now },
                [kind.model]: { paymentsDueSweptAt: null }
            },
            include: { [kind.model]: true }
        })
        for (const link of asked) {
            const parent = link[kind.model]
            if (paymentDue(parent, link)?.by !== 'confirm') continue
            if (startsAt(parent).getTime() <= now.getTime()) continue
            await moveUnpaid(kindName, link[kind.key], link.memberId)
        }
    }

    // the due date
    for (const kindName of Object.keys(ITEMS)) {
        const kind = ITEMS[kindName]
        // (a lab can be a draft with no date; an event always has one)
        const parents = await prisma[kind.model].findMany({
            where: { paymentsDueSweptAt: null, ...(kindName === 'lab' ? { date: { not: null } } : {}) }
        })
        for (const parent of parents) {
            const due = paymentDueAt(parent)
            if (!due || due.getTime() > now.getTime()) continue
            const id = parent[kind.key]
            if (startsAt(parent).getTime() > now.getTime()) {
                // (one already given 48 hours of their own keeps them)
                const signed = await prisma[kind.link].findMany({ where: { [kind.key]: id, attendanceStatus: 'rsvped', payBy: null } })
                for (const link of signed) await moveUnpaid(kindName, id, link.memberId)
            }
            await prisma[kind.model].update({ where: { [kind.key]: id }, data: { paymentsDueSweptAt: now } })
        }
    }

    // owing late, and offered a spot owing: the 48 hours, and a reminder a day
    const remindedBefore = new Date(now.getTime() - REMIND_HOURS * 3_600_000)
    for (const kindName of Object.keys(ITEMS)) {
        const kind = ITEMS[kindName]
        const rows = await prisma[kind.link].findMany({
            where: {
                attendanceStatus: { in: ['rsvped', 'offered'] },
                [kind.model]: { date: { gte: new Date(now.getTime() - 2 * 86_400_000) } }
            },
            include: { [kind.model]: true }
        })
        for (const link of rows) {
            const parent = link[kind.model]
            const id = link[kind.key]
            if (!parent?.date || startsAt(parent).getTime() <= now.getTime()) continue
            if (link.attendanceStatus === 'offered') {
                // reminded a day after the offer email, then daily
                if (!link.offerSentAt) continue
                const last = Math.max(link.offerSentAt.getTime(), link.payRemindedAt?.getTime() ?? 0)
                if (last > remindedBefore.getTime()) continue
                const standing = await payable(prisma, link.memberId, kindName, id)
                if (!standing?.owes || standing.sent) continue
                await remindOne(kindName, parent, link, standing, now)
                continue
            }
            if (!link.payBy) {
                await owingLate(kindName, id, link.memberId, { now })
                continue
            }
            if (link.payBy.getTime() <= now.getTime()) {
                await moveUnpaid(kindName, id, link.memberId, link.payBy)
                continue
            }
            if (link.payRemindedAt && link.payRemindedAt.getTime() > remindedBefore.getTime()) continue
            const standing = await payable(prisma, link.memberId, kindName, id)
            if (!standing?.owes || standing.sent || standing.fixBy) continue
            await remindOne(kindName, parent, link, standing, now)
        }
    }
    if (moved > 0) console.log(`Payment sweep: ${moved} moved to a waitlist`)
    return moved
}

// ---- owing late --------------------------------------------------------------

// Someone signed up for a lab or event who comes to owe for it after its
// payment due date has passed — they signed up late, or an entry they'd paid
// was taken back — gets LATE_HOURS from then to pay: their row's `payBy`
// (paymentDue reads it as their due date). Starts that clock if it applies
// and isn't running yet, and with `remind` emails them the first reminder
// (anything else — the "please disregard" email — already told them).
// Nothing for someone paid, waiting on a payment, or fixing one sent back.
// Returns whether it started.
export async function owingLate(kindName, id, memberId, { now = new Date(), remind = true } = {}) {
    const kind = ITEMS[kindName]
    const where = { [kind.compound]: { memberId, [kind.key]: id } }
    const link = await prisma[kind.link].findUnique({ where, include: { [kind.model]: true } })
    const parent = link?.[kind.model]
    if (link?.attendanceStatus !== 'rsvped' || link.payBy || !parent?.date) return false
    if (startsAt(parent).getTime() <= now.getTime()) return false
    const due = paymentDue(parent, link)
    if (due.at.getTime() > now.getTime()) return false
    const standing = await payable(prisma, memberId, kindName, id)
    if (!standing?.owes || standing.sent || standing.fixBy) return false
    const started = await prisma[kind.link].update({
        where,
        data: { payBy: new Date(now.getTime() + LATE_HOURS * 3_600_000), payRemindedAt: now }
    })
    if (remind) await remindOne(kindName, parent, started, standing, now, { record: false })
    return true
}

// One reminder to pay — remindUnpaid's email, for one person — and when it
// went noted on their row (unless `record` is off: the caller did).
async function remindOne(kindName, parent, link, standing, now, { record = true } = {}) {
    const kind = ITEMS[kindName]
    const user = await prisma.user.findUnique({ where: { userId: link.memberId }, select: { email: true, firstName: true } })
    if (!user) return
    const offered = link.attendanceStatus === 'offered'
    const offerBy = offered ? offerLapse(link, parent, now) : null
    await remindUnpaid(
        {
            kind: kindName, id: parent[kind.key], title: parent.title, date: parent.date, startTime: parent.startTime,
            price: standing.price, duesAmount: standing.choices.find((choice) => choice.kind === 'dues')?.amount ?? 0,
            schoolYear: standing.schoolYear
        },
        [{ email: user.email, firstName: user.firstName, confirmBy: link.confirmBy, payBy: link.payBy, offerBy }],
        { offered }
    ).catch((err) => console.error(`Payment reminder failed: ${err.message}`))
    if (record) {
        await prisma[kind.link].update({
            where: { [kind.compound]: { memberId: link.memberId, [kind.key]: parent[kind.key] } },
            data: { payRemindedAt: now }
        })
    }
}

// ---- taking it back ----------------------------------------------------------

// The check-in page's grey $, inside `tx`: the entry paid (or waived) for one
// lab or event on `link` (their member_lab / member_event row) is taken back.
// A paid one's income row comes out of the ledger, and a payment they sent in
// for it goes to 'reversed' — they're unpaid again, and can send another.
// Returns that payment (for its email) or null.
export async function undoDoorPayment(tx, { kindName, link, actorId, title }) {
    const kind = ITEMS[kindName]
    const payment = link.doorTransactionId != null
        ? await tx.memberPayment.findUnique({ where: { transactionId: link.doorTransactionId } })
        : null
    await tx[kind.link].update({
        where: { [kind.compound]: { memberId: link.memberId, [kind.key]: link[kind.key] } },
        data: { doorPayment: null, doorTransactionId: null }
    })
    if (link.doorTransactionId != null) {
        await tx.transaction.delete({ where: { transactionId: link.doorTransactionId } })
    }
    if (payment) {
        await tx.memberPayment.update({
            where: { paymentId: payment.paymentId },
            data: { status: 'reversed', reviewedAt: new Date() }
        })
    }
    await log({
        actorId, action: 'door_payment_undone', targetId: link.memberId,
        details: { kind: kindName, id: link[kind.key], title, was: link.doorPayment }
    }, tx)
    return payment
}

// Before an income row is deleted (inside `tx`): whatever it settled goes back
// to how it was before.
//
//   an entry's row     their lab or event row reads unpaid again, and a
//                      payment they sent in for it is 'reversed'
//   a dues row         (the DuesPayment cascades with it, so they're unpaid —
//                      and syncVipRoles takes VIP back) a payment they sent
//                      in for it goes back to 'pending', to be approved again
//                      or sent back
//
// Returns { payment, status } for the email to send, or null.
export async function releaseLedgerRow(tx, transactionId) {
    for (const kindName of Object.keys(ITEMS)) {
        await tx[ITEMS[kindName].link].updateMany({
            where: { doorTransactionId: transactionId },
            data: { doorPayment: null, doorTransactionId: null }
        })
    }
    const payment = await tx.memberPayment.findUnique({ where: { transactionId } })
    if (!payment) return null
    const status = payment.kind === 'dues' ? 'pending' : 'reversed'
    await tx.memberPayment.update({
        where: { paymentId: payment.paymentId },
        data: { status, transactionId: null, reviewedAt: status === 'pending' ? null : new Date() }
    })
    return { payment, status }
}

// ---- emails ------------------------------------------------------------------

// '$20.00 for Body Butter' / 'your $25.00 2026–27 VIP dues'. `whose` is 'their'
// in the treasurer's email, which talks about the member rather than to them.
function whatFor(payment, whose = 'your') {
    const from = payment.lab ?? payment.event
    if (payment.kind === 'goggles') return `${money(payment.amount)} goggle rental for ${from?.title ?? `${whose} lab`}`
    return payment.kind === 'dues'
        ? `${whose} ${money(payment.amount)} ${payment.schoolYear} VIP dues`
        : `${money(payment.amount)} for ${from?.title ?? `${whose} lab`}`
}

// a goggle rental's deadline, big — the day before its lab
const goggleCallout = (p) => {
    const at = goggleDueAt(p.lab)
    return at ? { label: 'Goggle rental due', text: dueText(at) } : undefined
}

// where they'd go to send it again
function pageFor(payment) {
    const at = itemOf(payment)
    return at ? `${APP_URL}${ITEMS[at[0]].page(at[1])}` : `${APP_URL}/vip`
}

const REASON = 'You’re getting this because you sent a payment to Elemental Beauty.'

const titleOf = (p) => (p.lab ?? p.event)?.title
const noun = (p) => (p.eventId != null ? 'event' : 'lab')
// the reminder every lab or event payment email ends on, for someone whose
// own row for it is `link` (their confirmation deadline, or late 48 hours)
const dueLine = (p, link) => {
    const from = p.lab ?? p.event
    const when = dueWhen(from, link)
    return when ? [`Payment for ${from.title} is due ${when}. Anyone signed up who hasn’t paid by then is moved to the waitlist.`] : []
}

// a goggle rental's own copy: nothing about their spot
const GOGGLES = {
    approved: (p) => ({
        subject: `Goggle rental approved: ${titleOf(p)}`,
        heading: 'Your goggle rental was approved',
        lines: [
            `We got ${whatFor(p)} by ${p.methodTitle} (transaction #${p.reference}). Thank you!`,
            'Your goggles will be ready for you at the lab.'
        ],
        button: { label: 'See the lab', url: pageFor(p) }
    }),
    rejected: (p) => ({
        subject: `Goggle rental sent back: ${titleOf(p)}`,
        heading: 'Please fix your goggle rental and send it again',
        lines: [
            `Your ${whatFor(p)} by ${p.methodTitle} (transaction #${p.reference}) wasn’t registered or accepted.`,
            `Why: ${p.rejectionReason}`,
            'Fix it and send it again from the lab’s page before the rental closes, 24 hours before the lab starts.'
        ],
        button: { label: 'Fix it', url: pageFor(p) }
    }),
    declined: (p) => ({
        subject: `Goggle rental rejected: ${titleOf(p)}`,
        heading: 'Your goggle rental was rejected',
        lines: [
            `Your ${whatFor(p)} by ${p.methodTitle} (transaction #${p.reference}) wasn’t accepted.`,
            ...(p.rejectionReason ? [`Why: ${p.rejectionReason}`] : []),
            'Goggles are required at the lab, so bring your own, or rent a pair again from its page before the rental closes.'
        ],
        button: { label: 'See the lab', url: pageFor(p) }
    }),
    reversed: (p) => ({
        subject: `Please disregard: goggle rental approval for ${titleOf(p)}`,
        heading: 'Please disregard your goggle rental approval',
        lines: [
            `We approved ${whatFor(p)} by mistake, so we’ve taken it back.`,
            'If you did pay, send it again from the lab’s page with the transaction id.'
        ],
        button: { label: 'Send it again', url: pageFor(p) }
    })
}

const PAYER = {
    approved: (p) => ({
        subject: p.kind === 'dues' ? 'You’re a VIP!' : `Payment approved: ${titleOf(p)}`,
        heading: p.kind === 'dues' ? 'Your VIP dues were approved' : 'Your payment was approved',
        lines: [
            `We got ${whatFor(p)} by ${p.methodTitle} (transaction #${p.reference}). Thank you!`,
            ...(p.kind === 'dues' ? [`You’re a VIP for ${p.schoolYear}: every lab and members-only event is covered.`] : []),
            ...(titleOf(p)
                ? [p.confirmed
                    ? `Your spot in ${titleOf(p)} is confirmed with it. Just show your QR code at the door.`
                    : `It’s for ${titleOf(p)}. See its page for your spot.`]
                : [])
        ],
        button: { label: 'See it', url: pageFor(p) }
    }),
    rejected: (p) => ({
        subject: `Payment sent back: ${p.kind === 'dues' ? 'VIP dues' : titleOf(p)}`,
        heading: 'Please fix your payment and send it again',
        lines: [
            `Your payment of ${whatFor(p)} by ${p.methodTitle} (transaction #${p.reference}) wasn’t registered or accepted.`,
            `Why: ${p.rejectionReason}`,
            titleOf(p)
                ? `Fix it and send it again from the same page within 48 hours, by ${dueText(reviseBy(p.reviewedAt))}, or you’ll be moved to the waitlist for ${titleOf(p)}.`
                : 'You can fix it and send it again from the same page.'
        ],
        button: { label: 'Fix it', url: pageFor(p) }
    }),
    declined: (p) => ({
        subject: `Payment rejected: ${p.kind === 'dues' ? 'VIP dues' : titleOf(p)}`,
        heading: 'Your payment was rejected',
        lines: [
            `Your payment of ${whatFor(p)} by ${p.methodTitle} (transaction #${p.reference}) wasn’t accepted.`,
            ...(p.rejectionReason ? [`Why: ${p.rejectionReason}`] : []),
            ...(p.moved
                ? [`You’ve been moved to the waitlist for ${titleOf(p)}. If a spot opens up you’ll be offered it, and you can pay then to take it.`]
                : [])
        ],
        button: { label: `See the ${noun(p)}`, url: pageFor(p) }
    }),
    reversed: (p) => ({
        subject: `Please disregard: payment approval for ${p.kind === 'dues' ? 'VIP dues' : titleOf(p)}`,
        heading: 'Please disregard your payment approval',
        lines: [
            `We approved ${whatFor(p)} by mistake, so we’ve taken it back and you’re marked unpaid again.`,
            'If you did pay, send it again from the page below with the transaction id.'
        ],
        button: { label: 'Send it again', url: pageFor(p) }
    }),
    pending: (p) => ({
        subject: 'Please disregard: VIP membership approval',
        heading: 'Please disregard your VIP approval',
        lines: [
            `We approved ${whatFor(p)} by mistake. Your payment is still pending, and we’ll email you again once it’s been looked at.`
        ],
        button: { label: 'See your payment', url: pageFor(p) }
    })
}

// To the member who sent `payment` (read with PAYMENT_INCLUDE): approved
// (with `confirmed` — their spot with it), sent back (rejected, with its
// reason and the 48 hours to fix it), rejected (declined, with `moved`),
// reversed, or back to pending. One sent from a lab's or event's page carries
// its due date, big, and a line under it — sent back, the new due date (48
// hours on) is the big one, and the old one's the line.
export async function notifyPayer(payment, status = payment.status) {
    const to = payment.member?.user?.email
    if (payment.kind === 'goggles') {
        const copy = GOGGLES[status]?.(payment)
        if (!copy || !to) return
        const { subject, ...body } = copy
        await sendEmail({ to, subject, ...actionEmail({ ...body, callout: goggleCallout(payment), reason: REASON }) })
        return
    }
    const copy = PAYER[status]?.(payment)
    if (!copy || !to) return
    const { subject, ...body } = copy
    const from = payment.lab ?? payment.event
    const at = itemOf(payment)
    // an approval taken back after the due date: their 48 hours start now
    // (this email's the notice)
    if (at && status === 'reversed') await owingLate(...at, payment.memberId, { remind: false })
    const link = at ? await dueLinkOf(prisma, payment.memberId, ...at) : null
    const was = paymentDueAt(from, link)
    const due = !from ? {}
        : status === 'rejected'
            ? {
                callout: { label: 'New payment due', text: dueText(reviseBy(payment.reviewedAt)) },
                after: was ? [`It was due ${dueText(was)}. Since it was sent back, the new due date above takes its place.`] : []
            }
            : { callout: dueCallout(from, link), after: dueLine(payment, link) }
    await sendEmail({
        to,
        subject,
        ...actionEmail({
            ...body,
            ...due,
            reason: REASON
        })
    })
}

// To someone whose entry for `title` was taken back on the check-in page when
// they hadn't sent anything in themselves — it was taken at the door.
export async function notifyDoorUndone({ memberId, kindName, id, title }) {
    const who = await prisma.user.findUnique({ where: { userId: memberId }, select: { email: true } })
    if (!who) return
    const parent = await prisma[ITEMS[kindName].model].findUnique({ where: { [ITEMS[kindName].key]: id } })
    // taken back after the due date: their 48 hours start now (this email's
    // the notice)
    await owingLate(kindName, id, memberId, { remind: false })
    const link = await dueLinkOf(prisma, memberId, kindName, id)
    await sendEmail({
        to: who.email,
        subject: `Please disregard: payment approval for ${title}`,
        ...actionEmail({
            heading: 'Please disregard your payment approval',
            callout: dueCallout(parent, link),
            lines: [
                `Your entry for ${title} was marked paid by mistake, so we’ve taken it back and you’re marked unpaid again.`,
                `You can pay from the page below. It’s due ${dueWhen(parent, link) ?? 'before it starts'}, or you’ll be moved to the waitlist.`
            ],
            button: { label: 'Pay for it', url: `${APP_URL}${ITEMS[kindName].page(id)}` },
            reason: 'You’re getting this because you’re signed up for it on Elemental Beauty.'
        })
    })
}

// To the treasurer (or the admins), when a member sends a payment in.
export async function notifyReviewers(payment) {
    const at = itemOf(payment)
    const url = at ? `${APP_URL}${ITEMS[at[0]].page(at[1])}` : `${APP_URL}/analytics`
    const name = fullName(payment.member.user)
    for (const to of await treasurers()) {
        await sendEmail({
            to,
            subject: `Payment to review: ${name}, ${whatFor(payment, 'their')}`,
            ...actionEmail({
                heading: 'A payment to review',
                ...(payment.kind === 'goggles'
                    ? { callout: goggleCallout(payment) }
                    : (payment.lab ?? payment.event)
                        ? { callout: dueCallout(payment.lab ?? payment.event, await dueLinkOf(prisma, payment.memberId, ...itemOf(payment))) }
                        : {}),
                lines: [
                    `${name} says they paid ${whatFor(payment, 'their')} by ${payment.methodTitle}.`,
                    `Transaction id: ${payment.reference}`
                ],
                button: { label: 'Review it', url },
                reason: 'You’re getting this because you keep the club’s books on Elemental Beauty.'
            })
        })
    }
}

// A data URL -> an email attachment
function attachment(dataUrl, name) {
    const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl ?? '')
    if (!match) return null
    const ext = match[1].split('/')[1]?.replace('jpeg', 'jpg') ?? 'png'
    return { filename: `${name.replace(/[^\w -]+/g, '').trim() || 'qr'}.${ext}`, content: Buffer.from(match[2], 'base64'), contentType: match[1] }
}

// The check-in page's "email unpaid", and the daily reminders: a reminder to
// each of `people` ({ email, firstName, confirmBy, payBy, offerBy }) signed up
// for `item` ({ kind, id, title, date, startTime, price, duesAmount,
// schoolYear }) and owing for it — pay by the due date (a week before, 11:59
// PM, their confirmation deadline if that's sooner, or the 48 hours they were
// given owing late) or they're moved to the waitlist — with every accepted
// payment's QR code attached. `offered` is for people holding an offer of a
// spot instead: it's theirs once they pay, by when the offer lapses
// (`offerBy`) or else before it starts. Returns how many went out (or were
// printed, with no mail service).
export async function remindUnpaid(item, people, { offered = false } = {}) {
    const methods = await prisma.paymentMethod.findMany({ orderBy: { methodId: 'asc' } })
    const attachments = methods.map((method) => attachment(method.image, method.title)).filter(Boolean)
    const ways = methods.map((method) => `• ${method.title}${method.description ? `: ${method.description}` : ''}`)
    const url = `${APP_URL}${ITEMS[item.kind].page(item.id)}`
    const amounts = [
        item.price > 0 && `${money(item.price)} for ${item.title}`,
        item.duesAmount > 0 && `your ${money(item.duesAmount)} ${item.schoolYear} VIP dues, which cover every lab and members-only event this year`
    ].filter(Boolean)

    let sent = 0
    for (const person of people) {
        if (!person.email) continue
        if (offered) {
            await sendEmail({ to: person.email, attachments, ...offerReminder(item, person, { amounts, ways, url }) })
            sent++
            continue
        }
        const due = paymentDueAt(item, person)
        const when = dueWhen(item, person)
        await sendEmail({
            to: person.email,
            subject: `Reminder: pay for ${item.title} by ${due ? dueText(due) : 'the day'}`,
            attachments,
            ...actionEmail({
                heading: `Pay for ${item.title} before you come`,
                callout: dueCallout(item, person),
                lines: [
                    `Hi${person.firstName ? ` ${person.firstName}` : ''}, you’re signed up for ${item.title} on ${dayText(item.date)}, but we haven’t got a payment from you yet. Your spot can only be confirmed once you pay.`,
                    `Please pay ${amounts.join(', or ')}${when ? ` ${when}` : ''}. If you don’t, you’ll be moved to the waitlist.`,
                    'Payments aren’t refunded if you can’t make it, because we buy your materials ahead of time.',
                    ...(ways.length
                        ? ['You can pay with any of these. Their QR codes are attached:', ...ways]
                        : []),
                    'Then tell us on the page below: pick how you paid and type the transaction id your app gave you.'
                ],
                button: { label: 'Send your payment', url },
                reason: 'You’re getting this because you’re signed up for it on Elemental Beauty.'
            })
        })
        sent++
    }
    return sent
}

// remindUnpaid's email for someone holding an offer they'd pay for
function offerReminder(item, person, { amounts, ways, url }) {
    const by = person.offerBy ?? startsAt(item)
    return {
        subject: `A spot in ${item.title} is waiting: pay to take it`,
        ...actionEmail({
            heading: `Your spot in ${item.title} is waiting`,
            callout: { label: person.offerBy ? 'Pay to accept by' : 'Pay before it starts', text: dueText(by) },
            lines: [
                `Hi${person.firstName ? ` ${person.firstName}` : ''}, a spot opened up for you in ${item.title} on ${dayText(item.date)}, and it’s being held for you.`,
                `It can only be accepted once you pay. Pay ${amounts.join(', or ')} on its page and the spot is yours.`,
                person.offerBy
                    ? `Please pay by ${dueText(by)}. After that the spot may go to the next person on the waitlist, and you’ll move to the back of it.`
                    : 'Please pay before it starts, or the spot may go to someone else.',
                'Payments aren’t refunded if you can’t make it, because we buy your materials ahead of time.',
                ...(ways.length
                    ? ['You can pay with any of these. Their QR codes are attached:', ...ways]
                    : []),
                'Then tell us on the page below: pick how you paid and type the transaction id your app gave you.'
            ],
            button: { label: 'Pay to accept my spot', url },
            reason: 'You’re getting this because you were offered a spot off its waitlist on Elemental Beauty.'
        })
    }
}
