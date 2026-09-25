import prisma from '../prismaClient.js'
import requireRole from '../middleware/requireRole.js'
import { wantsEmail } from '../emailPrefs.js'
import { expireOffers, offerNext, sendConfirmations, sendOffer } from '../offers.js'
import { emailAll, readMessage } from '../emailAll.js'

// The officer check-in page's roster, shared by labs and events: the same
// three columns (not checked in / checked in / waitlist) and the same buttons
// on each row, over member_lab or member_event.
//
//   GET  /:id/roster     everyone with a row, name, handle and email included
//   POST /:id/roster     { action, memberId | username }
//
//     checkin   rsvped, offered (or absent) -> attended, points awarded (the
//               green tick)
//     uncheck   attended -> rsvped, points taken back (the x on checked in)
//     admit     waitlisted -> offered, seat or no seat — an officer at the
//               door can overrule the cap (the yellow button). The spot's
//               theirs once they accept; see src/offers.js
//     offer     emails an offered member their "accept" link (the blue
//               envelope)
//     remove    drops an rsvp, an offer or a waitlist place (the x on the
//               other two); a freed seat is offered to the front of the
//               waitlist, the same as when a member un-RSVPs themselves
//     add       puts someone on the waitlist by username (manual add)
//
//   POST /:id/email-all  { subject, message } — the page's "email all": sent by
//                        the server to everyone signed up (see emailAll.js)
//   POST /:id/confirm-all  { deadline } — the page's "confirmation": everyone
//                        signed up who hasn't confirmed yet is emailed a link
//                        to confirm by then, with a lab's prelab attached
//                        (see src/offers.js)
//
// The QR scan is still POST /:id/checkin on each router — this is everything
// an officer does by hand.

// seats spoken for — an open offer holds one
const TAKEN = { attendanceStatus: { in: ['rsvped', 'attended', 'offered'] } }

// who "email all" reaches: everyone with a confirmed spot — both columns but
// the waitlist, and not an offer that hasn't been accepted yet
const SIGNED_UP = ['rsvped', 'attended', 'absent']

const USER_SELECT = {
    member: {
        select: {
            role: true,
            user: { select: { username: true, firstName: true, lastName: true, email: true, emailEvents: true } }
        }
    }
}

// `kind` describes one of the two junctions:
//   kindName    'lab' / 'event' — the key into src/offers.js
//   parentName  prisma model of the lab/event itself ('lab' / 'event')
//   linkName    prisma model of the junction ('memberLab' / 'memberEvent')
//   key       the parent's id column ('labId' / 'eventId')
//   compound  the junction's composite key name
//   points    parent row -> points one attendance is worth
//   label     'Lab' / 'Event', for messages
export function mountRoster(router, kind) {
    const { kindName, parentName, linkName, key, compound, points, label } = kind
    const parent = prisma[parentName]
    const link = prisma[linkName]
    const where = (parentId, memberId) => ({ [compound]: { memberId, [key]: parentId } })

    router.get('/:id/roster', requireRole('officer'), async (req, res) => {
        const parentId = parseInt(req.params.id)
        if (isNaN(parentId)) { return res.status(400).json({ message: `Invalid ${label.toLowerCase()} id` }) }

        try {
            // an offer that's run out moves on before anyone sees it
            await expireOffers()
            const rows = await link.findMany({
                where: { [key]: parentId },
                select: {
                    memberId: true, attendanceStatus: true, waitlistedAt: true,
                    offerSentAt: true, confirmSentAt: true, confirmBy: true, confirmedAt: true, ...USER_SELECT
                }
            })
            res.json(rows.map(({ member, ...row }) => ({
                memberId: row.memberId,
                status: row.attendanceStatus,
                waitlistedAt: row.waitlistedAt,
                offerSentAt: row.offerSentAt,
                confirmSentAt: row.confirmSentAt,
                confirmBy: row.confirmBy,
                // past the deadline without confirming, but kept on because
                // nobody's waiting for the spot (see src/offers.js)
                confirmMissed: row.attendanceStatus === 'rsvped' && !row.confirmedAt &&
                    Boolean(row.confirmBy) && row.confirmBy.getTime() <= Date.now(),
                confirmedAt: row.confirmedAt,
                username: member.user.username,
                firstName: member.user.firstName,
                lastName: member.user.lastName,
                // for the page's "copy addresses" — officers only, like the
                // route — left off for anyone who doesn't want lab & event
                // emails (their choice, or their role's default: emailPrefs.js)
                email: wantsEmail(member.user.emailEvents, member.role) ? member.user.email : null
            })))
        } catch (err) {
            console.error(err.message)
            res.sendStatus(500)
        }
    })

    router.post('/:id/email-all', requireRole('officer'), async (req, res) => {
        const parentId = parseInt(req.params.id)
        if (isNaN(parentId)) { return res.status(400).json({ message: `Invalid ${label.toLowerCase()} id` }) }
        const { subject, message, error } = readMessage(req.body)
        if (error) { return res.status(400).json({ message: error }) }

        try {
            const row = await parent.findUnique({ where: { [key]: parentId }, select: { title: true } })
            if (!row) { return res.status(404).json({ message: `${label} not found` }) }
            const rows = await link.findMany({
                where: { [key]: parentId, attendanceStatus: { in: SIGNED_UP } },
                select: USER_SELECT
            })
            const recipients = rows
                .filter(({ member }) => wantsEmail(member.user.emailEvents, member.role))
                .map(({ member }) => member.user.email)
            if (recipients.length === 0) {
                return res.status(400).json({ message: 'Nobody signed up wants these emails' })
            }
            const sent = await emailAll({
                recipients,
                subject,
                message,
                reason: `You’re getting this because you signed up for ${row.title}. You can turn these emails off on your account page.`
            })
            res.json({ message: `Sent to ${sent} ${sent === 1 ? 'person' : 'people'}`, sent })
        } catch (err) {
            console.error(err.message)
            res.status(502).json({ message: err.message })
        }
    })

    router.post('/:id/confirm-all', requireRole('officer'), async (req, res) => {
        const parentId = parseInt(req.params.id)
        if (isNaN(parentId)) { return res.status(400).json({ message: `Invalid ${label.toLowerCase()} id` }) }
        try {
            const { sent, attached } = await sendConfirmations(kindName, parentId, new Date(req.body?.deadline))
            res.json({
                message: `Asked ${sent} ${sent === 1 ? 'person' : 'people'} to confirm${attached ? `, with ${attached} attached` : ''}`,
                sent,
                attached
            })
        } catch (err) {
            if (err.status) { return res.status(err.status).json({ message: err.message }) }
            console.error(err.message)
            res.status(502).json({ message: 'The confirmations didn’t all go out — check the server log' })
        }
    })

    router.post('/:id/roster', requireRole('officer'), async (req, res) => {
        const parentId = parseInt(req.params.id)
        if (isNaN(parentId)) { return res.status(400).json({ message: `Invalid ${label.toLowerCase()} id` }) }

        const { action } = req.body
        try {
            const row = await parent.findUnique({ where: { [key]: parentId } })
            if (!row) { return res.status(404).json({ message: `${label} not found` }) }

            if (action === 'add') {
                // a username ('@' in front or not), or a whole email address
                const username = String(req.body.username ?? '').trim().toLowerCase().replace(/^@/, '')
                if (!username) { return res.status(400).json({ message: 'username is required' }) }
                const user = await prisma.user.findUnique({
                    where: username.includes('@') ? { email: username } : { username },
                    select: { userId: true, member: { select: { userId: true } } }
                })
                if (!user?.member) { return res.status(404).json({ message: `No member called @${username}` }) }
                const existing = await link.findUnique({ where: where(parentId, user.userId) })
                if (existing) { return res.status(409).json({ message: `@${username} is already on the list` }) }
                await link.create({
                    data: {
                        memberId: user.userId,
                        [key]: parentId,
                        attendanceStatus: 'waitlisted',
                        waitlistedAt: new Date()
                    }
                })
                // someone waiting is what makes missed confirmation deadlines
                // count — see enforceConfirmations in src/offers.js
                await expireOffers()
                return res.status(201).json({ message: 'Added to the waitlist' })
            }

            const memberId = Number(req.body.memberId)
            if (!Number.isInteger(memberId)) { return res.status(400).json({ message: 'memberId is required' }) }
            const existing = await link.findUnique({ where: where(parentId, memberId) })
            if (!existing) { return res.status(404).json({ message: 'That member is not on the list' }) }
            const status = existing.attendanceStatus
            const worth = points(row)

            if (action === 'checkin') {
                // absent = a no-show the nightly sweep marked after the day,
                // which an officer can still correct; an offer that turns up
                // at the door has plainly accepted it
                if (!['rsvped', 'absent', 'offered'].includes(status)) {
                    return res.status(409).json({ message: 'Only a signed-up member can be checked in' })
                }
                await prisma.$transaction([
                    link.update({ where: where(parentId, memberId), data: { attendanceStatus: 'attended', offerSentAt: null } }),
                    prisma.member.update({ where: { userId: memberId }, data: { points: { increment: worth } } })
                ])
                return res.json({ message: `Checked in (+${worth} points)` })
            }

            if (action === 'uncheck') {
                if (status !== 'attended') { return res.status(409).json({ message: 'That member is not checked in' }) }
                await prisma.$transaction(async (tx) => {
                    // a lab's quiz result goes with the check-in it hung off
                    const reset = key === 'labId' ? { quizPassed: null } : {}
                    await tx[linkName].update({
                        where: where(parentId, memberId),
                        data: { attendanceStatus: 'rsvped', ...reset }
                    })
                    // never below zero — they may have spent the points already
                    const member = await tx.member.findUnique({ where: { userId: memberId }, select: { points: true } })
                    await tx.member.update({
                        where: { userId: memberId },
                        data: { points: Math.max(0, member.points - worth) }
                    })
                })
                return res.json({ message: 'Check-in undone' })
            }

            if (action === 'admit') {
                if (status !== 'waitlisted') { return res.status(409).json({ message: 'That member is not on the waitlist' }) }
                await link.update({
                    where: where(parentId, memberId),
                    data: { attendanceStatus: 'offered', waitlistedAt: null, offerSentAt: null }
                })
                return res.json({ message: 'Moved off the waitlist — send them their offer' })
            }

            if (action === 'offer') {
                const { sentAt, delivered } = await sendOffer(kindName, parentId, memberId)
                return res.json({ message: delivered ? 'Offer emailed' : 'Offer written to the server log (no mail service set up)', sentAt })
            }

            if (action === 'remove') {
                if (status === 'attended') { return res.status(409).json({ message: 'Undo the check-in first' }) }
                const promoted = await prisma.$transaction(async (tx) => {
                    const junction = tx[linkName]
                    await junction.delete({ where: where(parentId, memberId) })
                    // only a held seat frees one up — a waitlist place doesn't —
                    // and with no cap there was never a queue for seats
                    if (status !== 'rsvped' && status !== 'offered') { return null }
                    if (row.capacity == null) { return null }
                    const taken = await junction.count({ where: { [key]: parentId, ...TAKEN } })
                    if (taken >= row.capacity) { return null }
                    return offerNext(tx, kindName, parentId)
                })
                return res.json({ message: 'Removed', offeredTo: promoted })
            }

            res.status(400).json({ message: 'action must be one of: checkin, uncheck, admit, offer, remove, add' })
        } catch (err) {
            if (err.status) { return res.status(err.status).json({ message: err.message }) }
            console.error(err.message)
            res.sendStatus(500)
        }
    })
}
