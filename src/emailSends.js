import prisma from './prismaClient.js'

// The emails officers send from a button — "email all" (a lab's or event's,
// or the dashboard's club-wide one), "email unpaid" and "confirmation" — each
// noted as it goes (EmailSend in schema.prisma), so the popup that sends one
// can say when it last went out, and a confirmation the deadline it set.

const KEYS = { lab: 'labId', event: 'eventId' }

// Note one send. `kindName` / `id` are the lab or event it was for — none for
// the club-wide "email all". `deadline` is a confirmation's; `sent` how many
// it reached; `by` who sent it.
export async function recordSend({ kind, kindName = null, id = null, deadline = null, sent = 0, by = null }) {
    await prisma.emailSend.create({
        data: { kind, ...(kindName ? { [KEYS[kindName]]: id } : {}), deadline, sent, sentById: by }
    })
}

// The newest of one kind for a lab or event (or the club-wide ones, with no
// `kindName`): { sentAt, deadline, sent } or null
export async function lastSend(kind, kindName = null, id = null) {
    const where = kindName
        ? { kind, [KEYS[kindName]]: id }
        : { kind, labId: null, eventId: null }
    return prisma.emailSend.findFirst({
        where,
        orderBy: { sentAt: 'desc' },
        select: { sentAt: true, deadline: true, sent: true }
    })
}

// All three for a lab's or event's check-in page:
// { email_all, unpaid_reminder, confirmation }, each lastSend's
export async function lastSends(kindName, id) {
    const [emailAll, unpaid, confirmation] = await Promise.all([
        lastSend('email_all', kindName, id),
        lastSend('unpaid_reminder', kindName, id),
        lastSend('confirmation', kindName, id)
    ])
    return { email_all: emailAll, unpaid_reminder: unpaid, confirmation }
}
