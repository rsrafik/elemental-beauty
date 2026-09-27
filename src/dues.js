import { log, fullName } from './activity.js'
import { clubToday, dateColumn } from './clubTime.js'

// Dues, shared by the treasurer's dues card (routes/duesRoutes.js), the lab
// and event lists (which show what someone unpaid will be charged), and the
// door, where an officer scanning someone into a lab or a members-only event
// can take their dues — or the non-member price — on the spot. See
// DuesPayment and YearTarget in schema.prisma.

// Only members and j-board pay dues. Officers, the treasurer and admins don't:
// they're left off the treasurer's dues card and never asked at the door.
export const DUES_EXEMPT = ['officer', 'treasurer', 'admin']

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
// row's name. Throws P2002 if they're already marked paid for that year.
export async function recordDues(tx, { memberId, user, schoolYear, amount, day, actorId }) {
    const ledger = amount > 0
        ? await tx.transaction.create({
            data: {
                type: 'income',
                source: `Dues ${schoolYear} — ${fullName(user)}`,
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
    return created
}

// Checking someone into a lab or a members-only event asks after their dues
// first — the QR scan (labRoutes.js, eventRoutes.js) and the check-in page's
// green tick (roster.js) alike. An event open to everyone doesn't ask.
export function asksDues(kindName, row) {
    return kindName === 'lab' || row.track === 'members'
}

// What `memberId` owes, for as many days as the caller likes — the lab and
// event lists ask about every card at once. Returns a function of a day
// ('YYYY-MM-DD', or null for today) that gives { schoolYear, amount, price } —
// the year's dues and the non-member price for one lab or event — or null when
// they've paid (or waived) that year, when their role is exempt (DUES_EXEMPT),
// or when nobody owes anything because neither figure is set yet (both 0).
export async function duesLookup(db, memberId) {
    const [member, targets, paid] = await Promise.all([
        db.member.findUnique({ where: { userId: memberId }, select: { role: true } }),
        db.yearTarget.findMany({ select: { schoolYear: true, duesAmount: true, nonmemberPrice: true } }),
        db.duesPayment.findMany({ where: { memberId }, select: { schoolYear: true } })
    ])
    if (!member || DUES_EXEMPT.includes(member.role)) return () => null
    const years = new Map(targets.map((target) => [target.schoolYear, target]))
    const settled = new Set(paid.map((payment) => payment.schoolYear))
    return (day) => {
        const schoolYear = schoolYearOf(day ?? clubToday())
        if (settled.has(schoolYear)) return null
        const target = years.get(schoolYear)
        const amount = Number(target?.duesAmount ?? 0)
        const price = Number(target?.nonmemberPrice ?? 0)
        return amount > 0 || price > 0 ? { schoolYear, amount, price } : null
    }
}

// The same for one day, with the member's name for the ledger row and the
// popup: { schoolYear, amount, price, user }, or null.
export async function duesOwed(db, memberId, day) {
    const owed = (await duesLookup(db, memberId))(day)
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
    if (dues === 'fee' && owed.price <= 0) return `No non-member price is set for ${owed.schoolYear}`
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
export async function settleDues(tx, { owed, dues, memberId, actorId, item }) {
    if (dues === 'paid') {
        await recordDues(tx, { memberId, user: owed.user, schoolYear: owed.schoolYear, amount: owed.amount, actorId })
        return
    }
    const details = { schoolYear: owed.schoolYear, kind: item.kind, id: item.id, title: item.title }
    if (dues === 'fee') {
        await tx.transaction.create({
            data: {
                type: 'income',
                source: `${item.title} — ${fullName(owed.user)} (non-member)`,
                amount: owed.price,
                category: 'fees',
                date: dateColumn(clubToday())
            }
        })
        await log({ actorId, action: 'fee_paid', targetId: memberId, details: { ...details, amount: owed.price } }, tx)
        return
    }
    await log({ actorId, action: 'dues_waived', targetId: memberId, details }, tx)
}
