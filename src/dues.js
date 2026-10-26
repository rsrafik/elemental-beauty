import { log, fullName } from './activity.js'
import { clubToday, dateColumn } from './clubTime.js'

// Dues, shared by the treasurer's dues card (routes/duesRoutes.js), the lab
// and event lists (which show what someone unpaid will be charged), and the
// door, where an officer scanning someone into a lab or a members-only event
// can take their dues — or the non-member price — on the spot. See
// DuesPayment and YearTarget in schema.prisma. The year sets the dues; each
// lab and event sets its own non-member price (nonmemberPrice on both).

// Only members and j-board pay dues. Officers, the treasurer, admins and the
// advisor don't: they're left off the treasurer's dues card and never asked at
// the door.
export const DUES_EXEMPT = ['officer', 'treasurer', 'admin', 'advisor']

// '2026-07-28' -> '2025–26'. August starts a new one — the same rule as
// schoolYear() in frontend/lib/finances.js.
export function schoolYearOf(day) {
    const [year, month] = day.split('-').map(Number)
    const start = month >= 8 ? year : year - 1
    return `${start}–${String(start + 1).slice(2)}`
}

// Mark someone's dues paid for a year, inside `tx`. 0 is a waived year:
// recorded, but no money moved, so no ledger row. Anything more writes an
// income row under 'dues', dated the day it was paid, which decides the month
// it lands in on the balance line.
//
// `user` is the member's { firstName, lastName, username }, for the ledger
// row's name; `source` is the row's whole title when the caller has a better
// one (ledgerSource — a payment a member sent in, or one taken at the door).
// Throws P2002 if they're already marked paid for that year.
export async function recordDues(tx, { memberId, user, schoolYear, amount, day, actorId, source }) {
    const ledger = amount > 0
        ? await tx.transaction.create({
            data: {
                type: 'income',
                source: source ?? `Dues ${schoolYear} — ${fullName(user)}`,
                amount,
                category: 'dues',
                ...(day ? { date: day } : {})
            }
        })
        : null
    const created = await tx.duesPayment.create({
        data: {
            memberId,
            schoolYear,
            amount,
            transactionId: ledger?.transactionId ?? null,
            ...(day ? { paidOn: day } : {})
        }
    })
    await log({ actorId, action: 'dues_paid', targetId: memberId, details: { schoolYear, amount } }, tx)
    await syncVipRoles(tx)
    return created
}

// VIP is the role of a member who has paid this school year's dues, and the
// dues are what decide it: anyone 'member' with a payment for the year (paid,
// or waived on the dues card) becomes 'vip', and any 'vip' without one goes
// back to 'member'. Run inside every change that adds or removes a payment —
// paying (recordDues), taking one back, clearing the year, deleting its ledger
// row — and hourly (server.js), which is what turns last year's VIPs back into
// members when August starts a new year. Only plain members are touched:
// j-board who've paid stay j-board, and staff never pay.
//
// Everything is in one place on purpose, so no path can leave someone VIP
// without a payment behind it, or paid and still a plain member.
export async function syncVipRoles(db, day) {
    const schoolYear = schoolYearOf(day ?? clubToday())
    const promoted = await db.member.updateMany({
        where: { role: 'member', dues: { some: { schoolYear } } },
        data: { role: 'vip' }
    })
    const lapsed = await db.member.updateMany({
        where: { role: 'vip', dues: { none: { schoolYear } } },
        data: { role: 'member' }
    })
    return { promoted: promoted.count, lapsed: lapsed.count }
}

// Picking VIP for someone on /students is the dues card's "mark paid": this
// year's dues, at the year's amount, into the ledger dated today. Nothing to
// do when they've already paid (or been waived) this year. Inside the role
// change's `tx`, after their member row exists. Throws with code
// 'NO_DUES_AMOUNT' when the year has no amount set — there's nothing to mark
// them paid with, the same reason the dues card greys its button out.
export async function payForVip(tx, { memberId, actorId }) {
    const schoolYear = schoolYearOf(clubToday())
    const paid = await tx.duesPayment.findUnique({ where: { memberId_schoolYear: { memberId, schoolYear } } })
    if (paid) return null
    const target = await tx.yearTarget.findUnique({ where: { schoolYear }, select: { duesAmount: true } })
    const amount = Number(target?.duesAmount ?? 0)
    if (amount <= 0) {
        throw Object.assign(new Error(`Set the ${schoolYear} dues amount on analytics first, because making someone VIP marks their dues paid`), { code: 'NO_DUES_AMOUNT' })
    }
    const user = await tx.user.findUnique({ where: { userId: memberId }, select: { firstName: true, lastName: true, username: true } })
    return recordDues(tx, { memberId, user, schoolYear, amount, day: dateColumn(clubToday()), actorId })
}

// Checking someone into a lab or a members-only event asks after their dues
// first — the QR scan (labRoutes.js, eventRoutes.js) and the check-in page's
// green tick (roster.js) alike. An event open to everyone doesn't ask.
export function asksDues(kindName, row) {
    return kindName === 'lab' || row.track === 'members'
}

// A lab's or event's non-member price as a request sent it: a number, or the
// string a form's box hands back, of zero or more with at most two places
// after the point. Blank or null is 0 — nothing extra to pay. Returns
// { price } (absent when the body didn't carry one) or { error }.
const PRICE = /^\d{1,8}(\.\d{1,2})?$/

export function readPrice(value) {
    if (value === undefined) return {}
    if (value === null || value === '') return { price: 0 }
    if (!PRICE.test(String(value).trim())) {
        return { error: 'nonmemberPrice must be an amount of zero or more, like 5 or 5.50' }
    }
    return { price: Number(value) }
}

// What `memberId` owes, for as many days as the caller likes — the lab and
// event lists ask about every card at once. Returns a function of a day
// ('YYYY-MM-DD', or null for today) and the lab's or event's own non-member
// price that gives { schoolYear, amount, price } — the year's dues and that
// price — or null when they've paid (or waived) that year, when their role is
// exempt (DUES_EXEMPT), or when nobody owes anything because neither figure is
// set (both 0).
export async function duesLookup(db, memberId) {
    const [member, targets, paid] = await Promise.all([
        db.member.findUnique({ where: { userId: memberId }, select: { role: true } }),
        db.yearTarget.findMany({ select: { schoolYear: true, duesAmount: true } }),
        db.duesPayment.findMany({ where: { memberId }, select: { schoolYear: true } })
    ])
    if (!member || DUES_EXEMPT.includes(member.role)) return () => null
    const years = new Map(targets.map((target) => [target.schoolYear, target]))
    const settled = new Set(paid.map((payment) => payment.schoolYear))
    return (day, nonmemberPrice = 0) => {
        const schoolYear = schoolYearOf(day ?? clubToday())
        if (settled.has(schoolYear)) return null
        const amount = Number(years.get(schoolYear)?.duesAmount ?? 0)
        const price = Number(nonmemberPrice ?? 0)
        return amount > 0 || price > 0 ? { schoolYear, amount, price } : null
    }
}

// Where everyone stands on this school year's dues, for the students tab's
// paid / unpaid filter: 'paid', 'unpaid', or null for a role that never pays
// (DUES_EXEMPT). The same rule duesLookup and the door use — a DuesPayment
// row for the year settles it, waived included — so the filter and the door
// can't disagree. Returns a function of a member's { userId, role }.
export async function duesStandings(db, day) {
    const schoolYear = schoolYearOf(day ?? clubToday())
    const paid = await db.duesPayment.findMany({ where: { schoolYear }, select: { memberId: true } })
    const settled = new Set(paid.map((payment) => payment.memberId))
    return ({ userId, role }) => {
        if (DUES_EXEMPT.includes(role)) return null
        return settled.has(userId) ? 'paid' : 'unpaid'
    }
}

// The same for one lab or event — its day and its price — with the member's
// name for the ledger row and the popup: { schoolYear, amount, price, user },
// or null.
export async function duesOwed(db, memberId, day, nonmemberPrice) {
    const owed = (await duesLookup(db, memberId))(day, nonmemberPrice)
    if (!owed) return null
    const user = await db.user.findUnique({ where: { userId: memberId }, select: { firstName: true, lastName: true, username: true } })
    return { ...owed, user }
}

// The reply when they owe: nothing's changed, and the officer is asked what
// to do (the check-in page's dues popup). Their answer is the same request
// again with `dues` set.
export function duesUnpaid(res, memberId, owed) {
    return res.status(202).json({
        code: 'DUES_UNPAID',
        message: `Dues for ${owed.schoolYear} haven't been paid`,
        memberId,
        name: fullName(owed.user),
        schoolYear: owed.schoolYear,
        amount: owed.amount,
        price: owed.price
    })
}

// `dues` as a request sent it — absent, or one of these
export const DUES_ANSWERS = ['paid', 'fee', 'waive']

// Why an answer can't be taken for what they owe, or null. Asked before the
// check-in's transaction, so a refusal changes nothing.
export function duesAnswerProblem(owed, dues) {
    if (dues === 'paid' && owed.amount <= 0) return `No dues amount is set for ${owed.schoolYear}`
    if (dues === 'fee' && owed.price <= 0) return 'No non-member price is set on this one'
    return null
}

// The officer's answer, inside the check-in's transaction. `item` is what
// they're being checked into: { kind: 'lab' | 'event', id, title }.
//
//   'paid'   they've paid their dues at the door — marked paid for the year
//            (the dues card's amount, into the ledger like any other)
//   'fee'    they've paid the non-member price for this one — an income row
//            under 'fees', and asked again next time
//   'waive'  let in this once without paying — logged, and asked again next
//            time
//
// `paidBy` is how the money came, when anyone said — { method, reference }:
// the platform and the transaction id — for the ledger row's title
// (ledgerSource).
//
// Returns what to keep on their row for this one — { doorPayment,
// doorTransactionId }: 'fee' and the income row it wrote, or 'waive', so
// checking them in later doesn't ask again and undoing it knows what to take
// back out — or null for 'paid', which the year's DuesPayment already answers
// for every lab.
export async function settleDues(tx, { owed, dues, memberId, actorId, item, paidBy = {} }) {
    const name = fullName(owed.user)
    if (dues === 'paid') {
        await recordDues(tx, {
            memberId, user: owed.user, schoolYear: owed.schoolYear, amount: owed.amount, actorId,
            source: ledgerSource({ name, what: `VIP dues ${owed.schoolYear} (${item.title})`, ...paidBy })
        })
        return null
    }
    const details = { schoolYear: owed.schoolYear, kind: item.kind, id: item.id, title: item.title }
    if (dues === 'fee') {
        const ledger = await tx.transaction.create({
            data: {
                type: 'income',
                source: ledgerSource({ name, what: item.title, ...paidBy }),
                amount: owed.price,
                category: 'fees',
                date: dateColumn(clubToday())
            }
        })
        await log({ actorId, action: 'fee_paid', targetId: memberId, details: { ...details, amount: owed.price } }, tx)
        return { doorPayment: 'fee', doorTransactionId: ledger.transactionId }
    }
    await log({ actorId, action: 'dues_waived', targetId: memberId, details }, tx)
    return { doorPayment: 'waive', doorTransactionId: null }
}

// `paidBy` off a request's body — { method, reference }, both optional: the
// platform ('Venmo') and the transaction id the officer typed into the dues
// popup.
export function readPaidBy(body = {}) {
    const text = (value, max) => typeof value === 'string' ? value.trim().replace(/^#/, '').slice(0, max) || null : null
    return { method: text(body.method, 60), reference: text(body.reference, 80) }
}

// A ledger row's title for money a member paid: who, for what (the lab or
// event, or 'VIP dues 2026–27'), the transaction id their app gave them and
// the platform — 'Mina Reyes — Body Butter — #4F2K9 — Venmo'. The last two
// only when someone said.
export function ledgerSource({ name, what, reference, method }) {
    return [name, what, reference && `#${reference}`, method].filter(Boolean).join(' — ')
}

// What checking `link` (their member_lab / member_event row) into a lab or
// event dated `day` asks for — duesOwed, unless they've already paid the entry
// or been waived for this one (its doorPayment, set ahead of time from the
// check-in page's $, or at an earlier check-in that was undone).
export async function doorOwed(db, link, day, nonmemberPrice) {
    if (link.doorPayment) return null
    return duesOwed(db, link.memberId, day, nonmemberPrice)
}
