import express from 'express'
import jwt from 'jsonwebtoken'
import QRCode from 'qrcode'
import prisma from '../prismaClient.js'
import requireRole, { denyRole } from '../middleware/requireRole.js'
import { POINTS, MANUAL_ACTIONS, eventPoints } from '../points.js'
import { fromEmail, takenMessage } from '../accountEmail.js'
import { sendVerificationEmail } from '../verification.js'
import { STAFF, wantsEmail } from '../emailPrefs.js'
import { emailAll, readMessage } from '../emailAll.js'
import { hashPassword, passwordProblem } from '../passwords.js'
import { log } from '../activity.js'

const router = express.Router()

const ROLES = ['member', 'officer', 'jboard', 'treasurer', 'admin']

// Anyone on staff can only be handled by an admin; officers and treasurers are
// left with plain members. The roster puts this gate on the row's checkbox so
// an untouchable row can't even be picked up — this is the same rule on the
// server, which is the one that actually matters.
//
// It covers creating as well as deleting, and for the same reason: an officer
// who could add an admin could add themselves a second account and log into it.
//
// An account with no member row yet ('user' — signed up, still short of the
// email link or the waiver) is on the same footing as a plain member.
function canManage(actorRole, targetRole) {
    return actorRole === 'admin' || targetRole === 'member' || targetRole === 'user'
}

// Roster — whitelisted fields only; passwordHash never leaves the server, and
// the email only goes to officers (the /students table lists people by it). The name, the handle and the picture live on the user row, so they
// come through the relation: /students draws every one of them, and so does
// the leaderboard on /account.
router.get('/', async (req, res) => {
    try {
        const members = await prisma.member.findMany({
            select: {
                userId: true,
                role: true,
                points: true,
                dateJoined: true,
                user: {
                    select: {
                        username: true,
                        firstName: true,
                        lastName: true,
                        instagram: true,
                        profilePicture: true,
                        createdAt: true,
                        email: true,
                        emailClub: true
                    }
                }
            },
            orderBy: { dateJoined: 'asc' }
        })
        // Staff get each address and whether the dashboard's "Email All" may
        // include it (their choice, or their role's default); nobody else
        // sees either.
        const staff = STAFF.includes(req.role)
        res.json(members.map(({ user, ...row }) => {
            const { email, emailClub, ...rest } = user
            return {
                ...row,
                user: staff
                    ? { ...rest, email, emailClub: wantsEmail(emailClub, row.role) }
                    : rest
            }
        }))
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Officer+: accounts with no membership yet — signed up, but the email link or
// the waiver is still outstanding (see promoteIfEligible in authRoutes). Kept
// apart from GET / on purpose: that one is the roster check-in reads and the
// leaderboard ranks, and neither should see someone who isn't a member.
//
// Shaped like a GET / row so /students can lay them in the same table: role
// 'user', and no points or join date because there's no member row to hold them.
router.get('/accounts', requireRole('officer'), async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            where: { member: null },
            select: {
                userId: true,
                username: true,
                firstName: true,
                lastName: true,
                instagram: true,
                profilePicture: true,
                createdAt: true,
                email: true,
                emailVerified: true,
                waiverSigned: true
            },
            orderBy: { createdAt: 'asc' }
        })
        res.json(users.map(({ userId, ...user }) => ({
            userId,
            role: 'user',
            points: null,
            dateJoined: null,
            user
        })))
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// "rsvp'd" on /account: signed up and not happened yet — a seat, a place on
// the waitlist, or a spot offered off it. (Once the day passes an rsvp turns
// into attended or absent, so nothing here is in the past.)
const HOLDING = ['rsvped', 'waitlisted', 'offered']

router.get('/me', async (req, res) => {
    try {
        const me = await prisma.member.findUnique({
            where: { userId: req.userId },
            include: {
                user: {
                    select: {
                        username: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        instagram: true,
                        profilePicture: true,
                        emailVerified: true,
                        waiverSigned: true,
                        createdAt: true
                    }
                }
            }
        })
        if (!me) { return res.status(404).json({ message: 'Member profile not found' }) }

        // The four counts on /account's counter, taken off the junction tables
        // rather than stored — a number kept alongside them is a number that can
        // drift out of step with the rows it claims to count.
        const [pastLabs, rsvpLabs, pastEvents, rsvpEvents] = await Promise.all([
            prisma.memberLab.count({ where: { memberId: req.userId, attendanceStatus: 'attended' } }),
            prisma.memberLab.count({ where: { memberId: req.userId, attendanceStatus: { in: HOLDING } } }),
            prisma.memberEvent.count({ where: { memberId: req.userId, attendanceStatus: 'attended' } }),
            prisma.memberEvent.count({ where: { memberId: req.userId, attendanceStatus: { in: HOLDING } } })
        ])

        res.json({ ...me, stats: { pastLabs, rsvpLabs, pastEvents, rsvpEvents } })
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// The officer dashboard's "Email All": a message the server sends to everyone
// who wants club-wide email — members unless they've turned it off, staff only
// if they've turned it on (see emailPrefs.js / emailAll.js).
router.post('/email-all', requireRole('officer'), async (req, res) => {
    const { subject, message, error } = readMessage(req.body)
    if (error) { return res.status(400).json({ message: error }) }

    try {
        const everyone = await prisma.member.findMany({
            select: { role: true, user: { select: { email: true, emailClub: true } } }
        })
        const recipients = everyone
            .filter((row) => wantsEmail(row.user.emailClub, row.role))
            .map((row) => row.user.email)
        if (recipients.length === 0) {
            return res.status(400).json({ message: 'Nobody wants club-wide emails right now' })
        }
        const sent = await emailAll({
            recipients,
            subject,
            message,
            reason: 'You’re getting this because you’re a member of Elemental Beauty. You can turn these emails off on your account page.'
        })
        res.json({ message: `Sent to ${sent} ${sent === 1 ? 'person' : 'people'}`, sent })
    } catch (err) {
        console.error(err.message)
        res.status(502).json({ message: err.message })
    }
})

// QR is generated on the fly, never stored. noTimestamp makes the token a pure
// function of userId + QR_SECRET, so the image is identical every time.
router.get('/me/qr', async (req, res) => {
    try {
        const qrToken = jwt.sign({ id: req.userId }, process.env.QR_SECRET, { noTimestamp: true })
        const png = await QRCode.toBuffer(qrToken)
        res.type('png').send(png)
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// The history behind /account's five numbers — each tile opens a popup of
// what it counts:
//
//   labs / events   every sign-up, with its status: the "done" tiles show the
//                   attended ones, the "rsvp'd" tiles the ones still ahead
//   awards          points an officer gave by hand, off the activity log
//   earlier         points that neither of those explains — the ones from
//                   before the log was kept (or seeded) — so the breakdown
//                   always adds up to the number on the tile
//
// Attendance points are worked out from what each check-in is worth rather
// than stored per row, the same way the counts are: a check-in undone simply
// drops out.
router.get('/me/history', async (req, res) => {
    try {
        const me = await prisma.member.findUnique({ where: { userId: req.userId }, select: { points: true } })
        if (!me) { return res.status(404).json({ message: 'Member profile not found' }) }

        const [labRows, eventRows, awardRows] = await Promise.all([
            prisma.memberLab.findMany({
                where: { memberId: req.userId },
                select: {
                    attendanceStatus: true,
                    quizPassed: true,
                    lab: { select: { labId: true, title: true, date: true, startTime: true, location: true } }
                }
            }),
            prisma.memberEvent.findMany({
                where: { memberId: req.userId },
                select: {
                    attendanceStatus: true,
                    event: { select: { eventId: true, title: true, date: true, startTime: true, location: true, type: true } }
                }
            }),
            prisma.activityLog.findMany({
                where: { targetId: req.userId, action: 'points_awarded' },
                orderBy: { createdAt: 'desc' },
                select: { activityId: true, points: true, details: true, createdAt: true, actorName: true }
            })
        ])

        const labs = labRows.map(({ lab, attendanceStatus, quizPassed }) => ({
            ...lab,
            status: attendanceStatus,
            quizPassed,
            points: attendanceStatus === 'attended' ? POINTS.lab : 0
        }))
        const events = eventRows.map(({ event, attendanceStatus }) => ({
            ...event,
            status: attendanceStatus,
            points: attendanceStatus === 'attended' ? eventPoints(event.type) : 0
        }))
        const awards = awardRows.map((row) => ({
            id: row.activityId,
            reason: row.details?.reason ?? null,
            points: row.points ?? 0,
            at: row.createdAt,
            by: row.actorName
        }))
        // newest first, with anything undated (a draft) at the end
        const byDate = (a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0)
        labs.sort(byDate)
        events.sort(byDate)

        const explained = [...labs, ...events, ...awards].reduce((sum, row) => sum + row.points, 0)
        res.json({ points: me.points, labs, events, awards, earlier: me.points - explained })
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Self-edit: destructuring is the whitelist — role and points physically
// can't sneak in because we never read them from the body.
//
// Everything editable on /account is on the user row, and deliberately so: the
// form is offered to somebody with an account and no membership too, so it can't
// depend on a member row existing. The email is what's edited, and the username
// is its first half (see accountEmail.js), so the two always move together; a
// new address has to be verified again.
router.put('/me', async (req, res) => {
    const { firstName, lastName, instagram, profilePicture, emailClub } = req.body

    const data = {}
    if (firstName !== undefined) {
        if (!String(firstName).trim()) { return res.status(400).json({ message: 'firstName cannot be empty' }) }
        data.firstName = String(firstName).trim()
    }
    if (lastName !== undefined) {
        if (!String(lastName).trim()) { return res.status(400).json({ message: 'lastName cannot be empty' }) }
        data.lastName = String(lastName).trim()
    }
    if (req.body.email !== undefined) {
        const { email, username, error } = fromEmail(req.body.email)
        if (error) { return res.status(400).json({ message: error }) }
        data.email = email
        data.username = username
    }
    if (instagram !== undefined) { data.instagram = instagram }
    // the club-wide email opt-out (see schema.prisma)
    if (emailClub !== undefined) { data.emailClub = emailClub === true }
    if (profilePicture !== undefined) { data.profilePicture = profilePicture }

    try {
        const existing = await prisma.user.findUnique({ where: { userId: req.userId } })
        if (!existing) { return res.status(404).json({ message: 'Account not found' }) }
        // a new address is an unproven one, whatever the old one's state was
        if (data.email && data.email !== existing.email) { data.emailVerified = false }

        const me = await prisma.user.update({
            where: { userId: req.userId },
            data,
            select: {
                userId: true,
                username: true,
                email: true,
                firstName: true,
                lastName: true,
                instagram: true,
                profilePicture: true,
                emailVerified: true,
                waiverSigned: true,
                emailClub: true,
                createdAt: true
            }
        })
        // a new address gets its own confirmation link (it doesn't undo a
        // membership — that's already been earned)
        if (data.emailVerified === false) {
            await sendVerificationEmail(me).catch((err) =>
                console.error(`Verification email failed: ${err.message}`))
        }
        res.json(me)
    } catch (err) {
        if (err.code === 'P2002') { return res.status(409).json({ message: takenMessage(err, data.username) }) }
        if (err.code === 'P2025') { return res.status(404).json({ message: 'Account not found' }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Officer+: award points for social-media actions. The action name picks the
// value server-side — clients never send a point amount, so the values in
// points.js are the only amounts that can ever be granted. Attendance points
// are NOT awardable here; they happen automatically at check-in/admission.
// J-board can't touch anyone's points — this or PUT below.
router.post('/:id/points', requireRole('officer'), denyRole('jboard'), async (req, res) => {
    const targetId = parseInt(req.params.id)
    if (isNaN(targetId)) { return res.status(400).json({ message: 'Invalid member id' }) }

    const { action } = req.body
    if (!MANUAL_ACTIONS.includes(action)) {
        return res.status(400).json({ message: `action must be one of: ${MANUAL_ACTIONS.join(', ')}` })
    }

    try {
        // the award and its line in the log land together or not at all —
        // the log is what a member's points history reads it back from
        const updated = await prisma.$transaction(async (tx) => {
            const member = await tx.member.update({
                where: { userId: targetId },
                data: { points: { increment: POINTS[action] } }
            })
            await log({
                actorId: req.userId,
                action: 'points_awarded',
                targetId,
                points: POINTS[action],
                details: { reason: action }
            }, tx)
            return member
        })
        res.json({ message: `+${POINTS[action]} points for ${action}`, points: updated.points })
    } catch (err) {
        if (err.code === 'P2025') { return res.status(404).json({ message: 'Member not found' }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Officer+ (not j-board): set someone's points to a number typed by hand, for
// whatever the three awards above don't cover — or to correct a mistake. It's
// logged as an award of the difference (reason 'manual', with the before and
// after), which is what keeps a member's points history adding up: the
// history reads awards back as the change they made.
router.put('/:id/points', requireRole('officer'), denyRole('jboard'), async (req, res) => {
    const targetId = parseInt(req.params.id)
    if (isNaN(targetId)) { return res.status(400).json({ message: 'Invalid member id' }) }

    const { points } = req.body
    if (!Number.isInteger(points) || points < 0) {
        return res.status(400).json({ message: 'points must be a whole number, 0 or more' })
    }

    try {
        const updated = await prisma.$transaction(async (tx) => {
            const before = await tx.member.findUnique({ where: { userId: targetId }, select: { points: true } })
            if (!before) { return null }
            const member = await tx.member.update({ where: { userId: targetId }, data: { points } })
            // nothing changed, nothing to log
            if (points !== before.points) {
                await log({
                    actorId: req.userId,
                    action: 'points_awarded',
                    targetId,
                    points: points - before.points,
                    details: { reason: 'manual', from: before.points, to: points }
                }, tx)
            }
            return member
        })
        if (!updated) { return res.status(404).json({ message: 'Member not found' }) }
        res.json({ message: `Points set to ${updated.points}`, points: updated.points })
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Admin only: add a student from the roster. This is the one place an account
// is created WITH a membership already on it — signing yourself up gets you an
// account and nothing else, and the waiver is what promotes it. An admin
// adding somebody has already done that vouching in person.
//
// The password is a starter one they change from /account, which is why the
// dialog asks for it in plain sight rather than mailing an invitation.
router.post('/', requireRole('admin'), async (req, res) => {
    const { firstName, lastName, password, role = 'member', instagram } = req.body

    if (!firstName?.trim() || !lastName?.trim() || !req.body.email || !password) {
        return res.status(400).json({ message: 'firstName, lastName, email, and password are required' })
    }
    const weak = passwordProblem(password)
    if (weak) { return res.status(400).json({ message: weak }) }
    if (!ROLES.includes(role)) {
        return res.status(400).json({ message: `role must be one of: ${ROLES.join(', ')}` })
    }
    // the username is the email's first half, same as signing up
    const { email, username: handle, error } = fromEmail(req.body.email)
    if (error) { return res.status(400).json({ message: error }) }

    try {
        const passwordHash = await hashPassword(password)

        // One transaction: an account with no membership behind it would show
        // up as a half-added student that the roster can't see.
        const created = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    username: handle,
                    email,
                    passwordHash,
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                    instagram: instagram?.trim() || null,
                    emailVerified: true,     // see the note in authRoutes register
                    waiverSigned: true       // vouched for in person by the officer adding them
                }
            })
            const member = await tx.member.create({
                data: { userId: user.userId, role }
            })
            await log({ actorId: req.userId, action: 'member_added', targetId: user.userId, details: { role } }, tx)
            return { user, member }
        })

        res.status(201).json({
            userId: created.user.userId,
            username: created.user.username,
            email: created.user.email,
            firstName: created.user.firstName,
            lastName: created.user.lastName,
            instagram: created.user.instagram,
            profilePicture: created.user.profilePicture,
            role: created.member.role,
            points: created.member.points,
            dateJoined: created.member.dateJoined
        })
    } catch (err) {
        if (err.code === 'P2002') {
            return res.status(409).json({ message: takenMessage(err, handle) })
        }
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Officer+: remove a student. Deleting the USER is what's wanted, not just the
// membership — the roster's confirmation says their points, lab sign-ups and
// event history go with them, and that's the cascade on `users`. Reimbursement
// rows survive with member_id set to null, so the ledger stays intact.
router.delete('/:id', requireRole('officer'), async (req, res) => {
    const targetId = parseInt(req.params.id)
    if (isNaN(targetId)) { return res.status(400).json({ message: 'Invalid member id' }) }
    if (targetId === req.userId) {
        return res.status(400).json({ message: 'Use DELETE /members/me to delete your own account' })
    }

    try {
        // an account that never became a member has no member row, and is
        // removed the same way — as role 'user', with nothing to its name
        const member = await prisma.member.findUnique({ where: { userId: targetId } })
        const account = member ? null : await prisma.user.findUnique({ where: { userId: targetId }, select: { userId: true } })
        if (!member && !account) { return res.status(404).json({ message: 'Member not found' }) }
        const target = member ?? { role: 'user', points: 0 }
        if (!canManage(req.role, target.role)) {
            return res.status(403).json({ message: `Only an admin can remove ${target.role}s` })
        }

        await prisma.$transaction(async (tx) => {
            // written first, while there's still a name to look up
            await log({
                actorId: req.userId,
                action: 'member_removed',
                targetId,
                details: { role: target.role, points: target.points }
            }, tx)
            await tx.user.delete({ where: { userId: targetId } })
        })
        res.json({ message: 'Student removed' })
    } catch (err) {
        if (err.code === 'P2025') { return res.status(404).json({ message: 'Member not found' }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

router.put('/:id/role', requireRole('admin'), async (req, res) => {
    const targetId = parseInt(req.params.id)
    if (isNaN(targetId)) { return res.status(400).json({ message: 'Invalid member id' }) }

    const { role } = req.body
    if (!ROLES.includes(role)) {
        return res.status(400).json({ message: `role must be one of: ${ROLES.join(', ')}` })
    }
    if (targetId === req.userId) {
        return res.status(400).json({ message: 'You cannot change your own role' })
    }

    try {
        const updated = await prisma.$transaction(async (tx) => {
            const before = await tx.member.findUnique({ where: { userId: targetId }, select: { role: true } })

            // No member row: an account that signed up and stopped short of the
            // email link or the waiver ('user' on /students). Giving it a role
            // makes it a member there and then — the admin is vouching for them
            // in person, the same footing as adding a student, so both gates
            // are marked passed the way that route marks them.
            if (!before) {
                const user = await tx.user.findUnique({ where: { userId: targetId }, select: { userId: true } })
                if (!user) { throw Object.assign(new Error('Member not found'), { code: 'P2025' }) }
                await tx.user.update({
                    where: { userId: targetId },
                    data: { emailVerified: true, waiverSigned: true }
                })
                const member = await tx.member.create({ data: { userId: targetId, role } })
                await log({ actorId: req.userId, action: 'role_changed', targetId, details: { from: 'user', to: role } }, tx)
                return member
            }

            const member = await tx.member.update({
                where: { userId: targetId },
                data: { role }
            })
            if (before.role !== role) {
                await log({ actorId: req.userId, action: 'role_changed', targetId, details: { from: before.role, to: role } }, tx)
            }
            return member
        })
        res.json(updated)
    } catch (err) {
        if (err.code === 'P2025') { return res.status(404).json({ message: 'Member not found' }) }
        // two admins promoting the same account at once: the second finds the
        // member row already made
        if (err.code === 'P2002') { return res.status(409).json({ message: 'They were just made a member — reload to see it' }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

export default router
