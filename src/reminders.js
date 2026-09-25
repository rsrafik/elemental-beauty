import prisma from './prismaClient.js'
import { sendEmail } from './email.js'
import { actionEmail } from './emailTemplate.js'
import { APP_URL } from './verification.js'
import { KINDS, startsAt } from './offers.js'
import { clubFormat } from './clubTime.js'
import { wantsEmail } from './emailPrefs.js'

// The day-before reminder: once a lab or event is less than 24 hours off,
// everyone with a confirmed spot is emailed where and when. Runs hourly (see
// server.js), so each goes out within the hour it comes due; `reminderSentAt`
// on the lab or event makes it once, and moving the date or time clears it so
// a rescheduled one is reminded about again.
//
// It's a lab and event email like an officer's "email all", so it follows the
// same switch on /account (users.emailEvents — see emailPrefs.js).
//
// Something created or published with less than a day to go is reminded about
// on the next sweep; one that has already started never is.

const DAY_MS = 24 * 60 * 60 * 1000

// 'Thursday, October 1 at 5:30 PM'
function whenText(start, hasTime) {
    return clubFormat(start, hasTime
        ? { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }
        : { weekday: 'long', month: 'long', day: 'numeric' })
}

export async function sendReminders(now = new Date()) {
    let sent = 0
    // anything dated from yesterday to two days out can be within the next
    // 24 hours in some timezone; startsAt below makes the real call
    const from = new Date(now.getTime() - DAY_MS)
    const to = new Date(now.getTime() + 2 * DAY_MS)

    for (const kindName of Object.keys(KINDS)) {
        const kind = KINDS[kindName]
        const rows = await prisma[kind.parent].findMany({
            where: {
                reminderSentAt: null,
                date: { gte: from, lte: to },
                ...(kindName === 'lab' ? { published: true } : {})
            },
            select: { [kind.key]: true, title: true, date: true, startTime: true, location: true }
        })

        for (const row of rows) {
            const start = startsAt(row)
            const until = start.getTime() - now.getTime()
            if (until <= 0 || until > DAY_MS) { continue }
            const parentId = row[kind.key]

            // claimed before sending, so two servers (or a slow sweep
            // overlapping the next) can't both send it
            const claimed = await prisma[kind.parent].updateMany({
                where: { [kind.key]: parentId, reminderSentAt: null },
                data: { reminderSentAt: now }
            })
            if (claimed.count === 0) { continue }

            const people = await prisma[kind.link].findMany({
                where: { [kind.key]: parentId, attendanceStatus: 'rsvped' },
                select: { member: { select: { role: true, user: { select: { email: true, firstName: true, emailEvents: true } } } } }
            })
            const when = whenText(start, Boolean(row.startTime))
            for (const { member } of people) {
                if (!wantsEmail(member.user.emailEvents, member.role)) { continue }
                await sendEmail({
                    to: member.user.email,
                    subject: `Tomorrow: ${row.title}`,
                    ...actionEmail({
                        heading: member.user.firstName ? `See you soon, ${member.user.firstName}!` : 'See you soon!',
                        lines: [
                            `Just a reminder — you’re signed up for ${row.title} on ${when}${row.location ? ` in ${row.location}` : ''}.`,
                            kindName === 'lab'
                                ? 'Bring your Elementist pass: an officer scans its QR code to check you in, and checking in is what opens the lab’s quiz.'
                                : 'Bring your Elementist pass — an officer scans its QR code to check you in.'
                        ],
                        button: { label: `View the ${kind.noun}`, url: `${APP_URL}${kind.page(parentId)}` },
                        after: ['Can’t make it any more? Cancel your RSVP on the site so your spot can go to someone on the waitlist.'],
                        reason: `You’re getting this because you signed up for ${row.title}. You can turn lab and event emails off on your account page.`
                    })
                })
                sent++
            }
        }
    }
    if (sent > 0) { console.log(`Reminder sweep: ${sent} reminder(s) sent`) }
    return sent
}
