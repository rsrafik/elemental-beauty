import prisma from '../prismaClient.js'
import requireRole from '../middleware/requireRole.js'
import { wantsEmail } from '../emailPrefs.js'

// The officer check-in page's roster, shared by labs and events: the same
// three columns (not checked in / checked in / waitlist) and the same buttons
// on each row, over member_lab or member_event.
//
//   GET  /:id/roster   everyone with a row, name, handle and email included
//   POST /:id/roster   { action, memberId | username }
//
//     checkin   rsvped (or absent) -> attended, points awarded (the green tick)
//     uncheck   attended -> rsvped, points taken back (the x on checked in)
//     admit     waitlisted -> rsvped, seat or no seat — an officer at the
//               door can overrule the cap (the yellow button)
//     remove    drops an rsvp or a waitlist place (the x on the other two);
//               a freed seat goes to the front of the waitlist, the same as
//               when a member un-RSVPs themselves
//     add       puts someone on the waitlist by username (manual add)
//
// The QR scan is still POST /:id/checkin on each router — this is everything
// an officer does by hand.

const TAKEN = { attendanceStatus: { in: ['rsvped', 'attended'] } }

const USER_SELECT = {
    member: {
        select: {
            role: true,
            user: { select: { username: true, firstName: true, lastName: true, email: true, emailEvents: true } }
        }
    }
}

// `kind` describes one of the two junctions:
//   parentName  prisma model of the lab/event itself ('lab' / 'event')
//   linkName    prisma model of the junction ('memberLab' / 'memberEvent')
//   key       the parent's id column ('labId' / 'eventId')
//   compound  the junction's composite key name
//   points    parent row -> points one attendance is worth
//   label     'Lab' / 'Event', for messages
export function mountRoster(router, kind) {
    const { parentName, linkName, key, compound, points, label } = kind
    const parent = prisma[parentName]
    const link = prisma[linkName]
    const where = (parentId, memberId) => ({ [compound]: { memberId, [key]: parentId } })

    router.get('/:id/roster', requireRole('officer'), async (req, res) => {
        const parentId = parseInt(req.params.id)
        if (isNaN(parentId)) { return res.status(400).json({ message: `Invalid ${label.toLowerCase()} id` }) }

        try {
            const rows = await link.findMany({
                where: { [key]: parentId },
                select: { memberId: true, attendanceStatus: true, waitlistedAt: true, ...USER_SELECT }
            })
            res.json(rows.map(({ member, ...row }) => ({
                memberId: row.memberId,
                status: row.attendanceStatus,
                waitlistedAt: row.waitlistedAt,
                username: member.user.username,
                firstName: member.user.firstName,
                lastName: member.user.lastName,
                // for the page's "email all" — officers only, like the route —
                // left off for anyone who doesn't want lab & event emails
                // (their choice, or their role's default: see emailPrefs.js)
                email: wantsEmail(member.user.emailEvents, member.role) ? member.user.email : null
            })))
        } catch (err) {
            console.error(err.message)
            res.sendStatus(500)
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
                // which an officer can still correct
                if (status !== 'rsvped' && status !== 'absent') {
                    return res.status(409).json({ message: 'Only a signed-up member can be checked in' })
                }
                await prisma.$transaction([
                    link.update({ where: where(parentId, memberId), data: { attendanceStatus: 'attended' } }),
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
                    data: { attendanceStatus: 'rsvped', waitlistedAt: null }
                })
                return res.json({ message: 'Moved off the waitlist' })
            }

            if (action === 'remove') {
                if (status === 'attended') { return res.status(409).json({ message: 'Undo the check-in first' }) }
                const promoted = await prisma.$transaction(async (tx) => {
                    const junction = tx[linkName]
                    await junction.delete({ where: where(parentId, memberId) })
                    if (status !== 'rsvped' || row.capacity == null) { return null }

                    const taken = await junction.count({ where: { [key]: parentId, ...TAKEN } })
                    if (taken >= row.capacity) { return null }
                    const next = await junction.findFirst({
                        where: { [key]: parentId, attendanceStatus: 'waitlisted' },
                        orderBy: { waitlistedAt: 'asc' }
                    })
                    if (!next) { return null }
                    await junction.update({
                        where: where(parentId, next.memberId),
                        data: { attendanceStatus: 'rsvped', waitlistedAt: null }
                    })
                    return next.memberId
                })
                return res.json({ message: 'Removed', promotedFromWaitlist: promoted })
            }

            res.status(400).json({ message: 'action must be one of: checkin, uncheck, admit, remove, add' })
        } catch (err) {
            console.error(err.message)
            res.sendStatus(500)
        }
    })
}
