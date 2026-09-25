import prisma from './prismaClient.js'
import { sendEmail } from './email.js'
import { actionEmail } from './emailTemplate.js'
import { APP_URL } from './verification.js'

// The two emails around a receipt:
//
//   notifyTreasurer   a receipt came in (or came back after a denial) — to
//                     the treasurer, or to the admins if there isn't one
//   notifyRequester   the treasurer approved, denied or paid it — to the
//                     officer who handed it in
//
// Neither is an "email all", so neither follows the /account switches: they're
// about the person's own money. Both are fired after the change has been saved
// and never hold up the reply — a mail hiccup is logged, not thrown.

const money = (amount) => Number(amount).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
const PAGE = () => `${APP_URL}/analytics`

async function treasurers() {
    const rows = await prisma.member.findMany({
        where: { role: 'treasurer' },
        select: { user: { select: { email: true } } }
    })
    if (rows.length > 0) { return rows.map((r) => r.user.email) }
    const admins = await prisma.member.findMany({ where: { role: 'admin' }, select: { user: { select: { email: true } } } })
    return admins.map((r) => r.user.email)
}

// `resent` = an officer fixing a denied request and sending it back
export async function notifyTreasurer(request, { resent = false } = {}) {
    const who = await prisma.user.findUnique({
        where: { userId: request.memberId },
        select: { firstName: true, lastName: true, username: true, email: true }
    })
    const name = [who?.firstName, who?.lastName].filter(Boolean).join(' ') || `@${who?.username ?? 'someone'}`
    for (const to of await treasurers()) {
        if (to === who?.email) { continue }   // a treasurer's own receipt
        await sendEmail({
            to,
            subject: `${resent ? 'Receipt resent' : 'New receipt'}: ${request.title} (${money(request.amountRequested)})`,
            ...actionEmail({
                heading: resent ? 'A receipt came back' : 'A new receipt to review',
                lines: [
                    `${name} ${resent ? 'fixed and resent' : 'handed in'} “${request.title}” for ${money(request.amountRequested)}, filed under ${request.category}.`,
                    ...(request.explanation ? [`What it was for: ${request.explanation}`] : []),
                    ...(resent && request.previousDenial ? [`It was denied before because: ${request.previousDenial}`] : [])
                ],
                button: { label: 'Review it', url: PAGE() },
                reason: 'You’re getting this because you’re the club’s treasurer on Elemental Beauty.'
            })
        })
    }
}

const STATUS = {
    approved: {
        subject: (r) => `Approved: ${r.title}`,
        heading: 'Your receipt was approved',
        lines: (r) => [`The treasurer approved “${r.title}” for ${money(r.amountRequested)}. You’ll be paid back soon — you’ll get another email when it’s done.`]
    },
    reimbursed: {
        subject: (r) => `Paid back: ${r.title}`,
        heading: 'You’ve been paid back',
        lines: (r) => [`The treasurer marked “${r.title}” as reimbursed — ${money(r.amountRequested)} is on its way back to you.`]
    },
    denied: {
        subject: (r) => `Denied: ${r.title}`,
        heading: 'Your receipt was denied',
        lines: (r) => [
            `The treasurer denied “${r.title}” for ${money(r.amountRequested)}.`,
            `Why: ${r.denialExplanation}`,
            'You can fix it and send it back from the analytics page.'
        ]
    }
}

export async function notifyRequester(request) {
    const copy = STATUS[request.status]
    if (!copy || request.memberId == null) { return }
    const who = await prisma.user.findUnique({ where: { userId: request.memberId }, select: { email: true, firstName: true } })
    if (!who) { return }
    await sendEmail({
        to: who.email,
        subject: copy.subject(request),
        ...actionEmail({
            heading: copy.heading,
            lines: copy.lines(request),
            button: { label: 'See your receipts', url: PAGE() },
            reason: `You’re getting this because you handed in a receipt on Elemental Beauty.`
        })
    })
}

export function quietly(promise) {
    promise.catch((err) => console.error(`Reimbursement email failed: ${err.message}`))
}
