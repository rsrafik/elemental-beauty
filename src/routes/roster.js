import prisma from '../prismaClient.js'
import requireRole from '../middleware/requireRole.js'
import { expireOffers, lockParent, offerNext, sendConfirmations, sendOffer } from '../offers.js'
import { emailAll, readMessage } from '../emailAll.js'
import { log } from '../activity.js'
import { csvCell } from '../csv.js'
import { DUES_ANSWERS, asksDues, duesAnswerProblem, duesOwed, duesUnpaid, settleDues } from '../dues.js'

// The officer check-in page's roster, shared by labs and events: the same
// three columns (not checked in / checked in / waitlist) and the same buttons
// on each row, over member_lab or member_event.
//
//   GET  /:id/roster     everyone with a row, name, handle and email included
//   POST /:id/roster     { action, memberId | username }
//
//     checkin   rsvped, offered (or absent) -> attended, points awarded (the
//               green tick). At a lab or a members-only event, someone who
//               owes dues comes back DUES_UNPAID, the same as the QR scan, and
//               is answered with `dues` ('paid' | 'fee' | 'waive') — see
//               src/dues.js
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
//   GET  /:id/attendance  the same roster as a CSV download, for the reports
//                         the university asks for
//   POST /:id/email-all  { subject, message } — the page's "email all": sent by
//                        the server to everyone signed up (see emailAll.js)
//   PUT  /:id/checkin-open  { open } — the page's "start check-in": opens the
//                        door before the start time, so the people signed up
//                        get their QR code on its page early (members' pages
//                        read `checkinOpen`). { open: false } closes it again;
//                        from the start time it's open whatever this says
//   POST /:id/confirm-all  { deadline } — the page's "confirmation": everyone
//                        signed up who hasn't confirmed yet is emailed a link
//                        to confirm by then, with a lab's prelab attached
//                        (see src/offers.js)
//
// The QR scan is still POST /:id/checkin on each router — this is everything
// an officer does by hand.
//
// A j-board member signed up for a lab (any row on it — signed up, waitlisted,
// offered, checked in) is one of its attendees, not one of its staff: none of
// this is theirs for that lab, so they can't check themselves in or see who
// else came. Their own page for it is the member's (see requireNotAttendee).

// seats spoken for — an open offer holds one
const TAKEN = { attendanceStatus: { in: ['rsvped', 'attended', 'offered'] } }

// who "email all" reaches: everyone with a confirmed spot — both columns but
// the waitlist, and not an offer that hasn't been accepted yet
const SIGNED_UP = ['rsvped', 'attended', 'absent']

const USER_SELECT = {
    member: {
        select: {
            role: true,
            user: { select: { username: true, firstName: true, lastName: true, email: true } }
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
// Refuses a j-board member who's signed up for the lab at `req.params[param]`
// — see the note above. Labs only: j-board's event sign-ups don't stop them
// running an event's door.
export function requireNotAttendee(param = 'id') {
    return async (req, res, next) => {
        if (req.role !== 'jboard') { return next() }
        const labId = parseInt(req.params[param])
        if (isNaN(labId)) { return next() }
        try {
            const row = await prisma.memberLab.findUnique({
                where: { memberId_labId: { memberId: req.userId, labId } },
                select: { attendanceStatus: true }
            })
            if (row) { return res.status(403).json({ message: 'You’re signed up for this lab, so its attendance isn’t yours to run' }) }
            next()
        } catch (err) {
            next(err)
        }
    }
}

export function mountRoster(router, kind) {
    const { kindName, parentName, linkName, key, compound, points, label } = kind
    const parent = prisma[parentName]
    const link = prisma[linkName]
    const where = (parentId, memberId) => ({ [compound]: { memberId, [key]: parentId } })
    // a lab's attendees don't run its roster (requireNotAttendee)
    const staffOnly = kindName === 'lab' ? [requireRole('officer'), requireNotAttendee()] : [requireRole('officer')]

    router.get('/:id/roster', ...staffOnly, async (req, res) => {
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
                // route
                email: member.user.email
            })))
        } catch (err) {
            console.error(err.message)
            res.sendStatus(500)
        }
    })

    // Everyone with a row, as a spreadsheet: one line each, names first.
    // Unlike the roster above, every address is included — this is the
    // officers' own record of who came, not a mailing list.
    router.get('/:id/attendance', ...staffOnly, async (req, res) => {
        const parentId = parseInt(req.params.id)
        if (isNaN(parentId)) { return res.status(400).json({ message: `Invalid ${label.toLowerCase()} id` }) }

        try {
            // an event's points hang off its type; a lab has none
            const row = await parent.findUnique({
                where: { [key]: parentId },
                select: { title: true, date: true, ...(key === 'eventId' ? { type: true } : {}) }
            })
            if (!row) { return res.status(404).json({ message: `${label} not found` }) }
            const rows = await link.findMany({
                where: { [key]: parentId },
                select: {
                    attendanceStatus: true, confirmedAt: true,
                    ...(key === 'labId' ? { quizPassed: true } : {}),
                    member: { select: { user: { select: { firstName: true, lastName: true, username: true, email: true } } } }
                }
            })
            const STATUS = { attended: 'checked in', rsvped: 'signed up', absent: 'no-show', waitlisted: 'waitlist', offered: 'offered a spot' }
            const ORDER = ['attended', 'rsvped', 'offered', 'absent', 'waitlisted']
            rows.sort((a, b) =>
                ORDER.indexOf(a.attendanceStatus) - ORDER.indexOf(b.attendanceStatus) ||
                a.member.user.lastName.localeCompare(b.member.user.lastName) ||
                a.member.user.firstName.localeCompare(b.member.user.firstName))

            const header = ['first_name', 'last_name', 'username', 'email', 'status', 'confirmed', 'points',
                ...(key === 'labId' ? ['quiz_passed'] : [])]
            const lines = rows.map((r) => {
                const u = r.member.user
                return [
                    u.firstName, u.lastName, u.username, u.email,
                    STATUS[r.attendanceStatus] ?? r.attendanceStatus,
                    r.confirmedAt ? r.confirmedAt.toISOString() : '',
                    r.attendanceStatus === 'attended' ? points(row) : 0,
                    ...(key === 'labId' ? [r.quizPassed == null ? '' : r.quizPassed ? 'yes' : 'no'] : [])
                ].map(csvCell).join(',')
            })

            const day = row.date ? row.date.toISOString().slice(0, 10) : 'undated'
            const file = `${day} ${row.title}`.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || kindName
            res.type('text/csv')
            res.set('Content-Disposition', `attachment; filename="${file}-attendance.csv"`)
            res.send([header.join(','), ...lines].join('\n'))
        } catch (err) {
            console.error(err.message)
            res.sendStatus(500)
        }
    })

    router.post('/:id/email-all', ...staffOnly, async (req, res) => {
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
            // everyone signed up — lab and event mail isn't optional (see
            // src/emailPrefs.js)
            const recipients = rows.map(({ member }) => member.user.email)
            if (recipients.length === 0) {
                return res.status(400).json({ message: 'Nobody is signed up yet' })
            }
            const sent = await emailAll({
                recipients,
                subject,
                message,
                reason: `You’re getting this because you signed up for ${row.title}.`
            })
            res.json({ message: `Sent to ${sent} ${sent === 1 ? 'person' : 'people'}`, sent })
        } catch (err) {
            console.error(err.message)
            res.status(502).json({ message: err.message })
        }
    })

    router.put('/:id/checkin-open', ...staffOnly, async (req, res) => {
        const parentId = parseInt(req.params.id)
        if (isNaN(parentId)) { return res.status(400).json({ message: `Invalid ${label.toLowerCase()} id` }) }
        if (typeof req.body?.open !== 'boolean') { return res.status(400).json({ message: 'open must be true or false' }) }
        try {
            const row = await parent.update({
                where: { [key]: parentId },
                data: { checkinOpen: req.body.open },
                select: { checkinOpen: true }
            })
            res.json(row)
        } catch (err) {
            if (err.code === 'P2025') { return res.status(404).json({ message: `${label} not found` }) }
            console.error(err.message)
            res.sendStatus(500)
        }
    })

    router.post('/:id/confirm-all', ...staffOnly, async (req, res) => {
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

    router.post('/:id/roster', ...staffOnly, async (req, res) => {
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
                const { dues } = req.body
                if (dues !== undefined && !DUES_ANSWERS.includes(dues)) {
                    return res.status(400).json({ message: `dues must be one of: ${DUES_ANSWERS.join(', ')}` })
                }
                // labs and members-only events ask; one open to all doesn't
                const owed = asksDues(kindName, row)
                    ? await duesOwed(prisma, memberId, row.date?.toISOString().slice(0, 10))
                    : null
                if (owed && !dues) { return duesUnpaid(res, memberId, owed) }
                const problem = owed && duesAnswerProblem(owed, dues)
                if (problem) { return res.status(400).json({ message: problem }) }
                await prisma.$transaction(async (tx) => {
                    if (owed) {
                        await settleDues(tx, { owed, dues, memberId, actorId: req.userId, item: { kind: kindName, id: parentId, title: row.title } })
                    }
                    await tx[linkName].update({ where: where(parentId, memberId), data: { attendanceStatus: 'attended', offerSentAt: null } })
                    await tx.member.update({ where: { userId: memberId }, data: { points: { increment: worth } } })
                    await log({
                        actorId: req.userId, action: 'checked_in', targetId: memberId, points: worth,
                        details: { kind: kindName, id: parentId, title: row.title, by: 'hand' }
                    }, tx)
                })
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
                    const after = Math.max(0, member.points - worth)
                    await tx.member.update({
                        where: { userId: memberId },
                        data: { points: after }
                    })
                    await log({
                        actorId: req.userId, action: 'checkin_undone', targetId: memberId, points: after - member.points,
                        details: { kind: kindName, id: parentId, title: row.title }
                    }, tx)
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
                    await lockParent(tx, kindName, parentId)
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
            // the treasurer marked them paid while the dues popup was up
            if (err.code === 'P2002' && action === 'checkin') { return res.status(409).json({ message: 'Their dues were just marked paid — check them in again' }) }
            console.error(err.message)
            res.sendStatus(500)
        }
    })
}
