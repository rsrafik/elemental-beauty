import { log, fullName } from './activity.js'
import { clubToday } from './clubTime.js'

// Dues, shared by the treasurer's dues card (routes/duesRoutes.js) and the
// door, where an officer scanning someone into a lab can take their dues on
// the spot (labRoutes.js, POST /:labId/checkin). See DuesPayment in
// schema.prisma.

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

// Checking someone into a lab asks after their dues first — the QR scan
// (labRoutes.js) and the check-in page's green tick (roster.js) alike.
//
// What they owe for the year a lab on `day` ('YYYY-MM-DD', or null for today)
// falls in: { schoolYear, amount, user }, or null when they've paid (or
// waived) — or when nobody owes anything, because the year's dues amount
// isn't set yet (0).
export async function duesOwed(db, memberId, day) {
    const schoolYear = schoolYearOf(day ?? clubToday())
    const [target, paid, user] = await Promise.all([
        db.yearTarget.findUnique({ where: { schoolYear }, select: { duesAmount: true } }),
        db.duesPayment.findUnique({ where: { memberId_schoolYear: { memberId, schoolYear } }, select: { duesId: true } }),
        db.user.findUnique({ where: { userId: memberId }, select: { firstName: true, lastName: true, username: true } })
    ])
    const amount = Number(target?.duesAmount ?? 0)
    return !paid && amount > 0 ? { schoolYear, amount, user } : null
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
        amount: owed.amount
    })
}

// The officer's answer, inside the check-in's transaction:
//
//   'paid'   they've paid at the door — marked paid for the year (the dues
//            card's amount, into the ledger like any other)
//   'waive'  let in this once without paying — logged, and asked again at
//            their next lab
export async function settleDues(tx, { owed, dues, memberId, actorId, lab }) {
    if (dues === 'paid') {
        await recordDues(tx, { memberId, user: owed.user, schoolYear: owed.schoolYear, amount: owed.amount, actorId })
    } else {
        await log({
            actorId, action: 'dues_waived', targetId: memberId,
            details: { schoolYear: owed.schoolYear, kind: 'lab', id: lab.id, title: lab.title }
        }, tx)
    }
}

// `dues` as a request sent it — absent, or one of the two answers
export const DUES_ANSWERS = ['paid', 'waive']
