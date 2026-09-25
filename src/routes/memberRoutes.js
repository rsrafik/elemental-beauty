import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import QRCode from 'qrcode'
import prisma from '../prismaClient.js'
import requireRole from '../middleware/requireRole.js'
import { POINTS, MANUAL_ACTIONS } from '../points.js'
import { fromEmail, takenMessage } from '../accountEmail.js'
import { sendVerificationEmail } from '../verification.js'
import { mailProvider } from '../mailProvider.js'
import { STAFF, wantsEmail } from '../emailPrefs.js'

const router = express.Router()

const ROLES = ['member', 'officer', 'jboard', 'treasurer', 'admin']

// Anyone on staff can only be handled by an admin; officers and treasurers are
// left with plain members. The roster puts this gate on the row's checkbox so
// an untouchable row can't even be picked up — this is the same rule on the
// server, which is the one that actually matters.
//
// It covers creating as well as deleting, and for the same reason: an officer
// who could add an admin could add themselves a second account and log into it.
function canManage(actorRole, targetRole) {
    return actorRole === 'admin' || targetRole === 'member'
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
            prisma.memberLab.count({ where: { memberId: req.userId, attendanceStatus: { in: ['rsvped', 'waitlisted'] } } }),
            prisma.memberEvent.count({ where: { memberId: req.userId, attendanceStatus: 'attended' } }),
            prisma.memberEvent.count({ where: { memberId: req.userId, attendanceStatus: { in: ['rsvped', 'waitlisted'] } } })
        ])

        res.json({ ...me, stats: { pastLabs, rsvpLabs, pastEvents, rsvpEvents } })
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Which mail service the signed-in person's address is on (see
// mailProvider.js) — "email all" opens that one. Asked once when a page with
// the button loads, so the click itself can open the tab without waiting.
router.get('/me/mail', async (req, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { userId: req.userId }, select: { email: true } })
        if (!user) { return res.status(404).json({ message: 'Account not found' }) }
        res.json({ email: user.email, provider: await mailProvider(user.email) })
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
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

// Self-edit: destructuring is the whitelist — role and points physically
// can't sneak in because we never read them from the body.
//
// Everything editable on /account is on the user row, and deliberately so: the
// form is offered to somebody with an account and no membership too, so it can't
// depend on a member row existing. The email is what's edited, and the username
// is its first half (see accountEmail.js), so the two always move together; a
// new address has to be verified again.
router.put('/me', async (req, res) => {
    const { firstName, lastName, instagram, profilePicture, emailClub, emailEvents } = req.body

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
    // the two email opt-outs (see schema.prisma)
    if (emailClub !== undefined) { data.emailClub = emailClub === true }
    if (emailEvents !== undefined) { data.emailEvents = emailEvents === true }
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
                emailEvents: true,
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

// Deleting the USER cascades to member, member_lab, member_event;
// reimbursement rows survive with memberId set to null.
//
// Above the '/:id' routes below, and it has to stay there: Express matches in
// order, so a '/:id' handler declared first would swallow '/me' and try to read
// it as a number.
router.delete('/me', async (req, res) => {
    try {
        await prisma.user.delete({ where: { userId: req.userId } })
        res.json({ message: 'Account deleted' })
    } catch (err) {
        if (err.code === 'P2025') { return res.status(404).json({ message: 'Account not found' }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Officer+: award points for social-media actions. The action name picks the
// value server-side — clients never send a point amount, so the values in
// points.js are the only amounts that can ever be granted. Attendance points
// are NOT awardable here; they happen automatically at check-in/admission.
router.post('/:id/points', requireRole('officer'), async (req, res) => {
    const targetId = parseInt(req.params.id)
    if (isNaN(targetId)) { return res.status(400).json({ message: 'Invalid member id' }) }

    const { action } = req.body
    if (!MANUAL_ACTIONS.includes(action)) {
        return res.status(400).json({ message: `action must be one of: ${MANUAL_ACTIONS.join(', ')}` })
    }

    try {
        const updated = await prisma.member.update({
            where: { userId: targetId },
            data: { points: { increment: POINTS[action] } }
        })
        res.json({ message: `+${POINTS[action]} points for ${action}`, points: updated.points })
    } catch (err) {
        if (err.code === 'P2025') { return res.status(404).json({ message: 'Member not found' }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Officer+: add a student from the roster. This is the one place an account is
// created WITH a membership already on it — signing yourself up gets you an
// account and nothing else, and the waiver is what promotes it. An officer
// adding somebody has already done that vouching in person.
//
// The password is a starter one they change from /account, which is why the
// dialog asks for it in plain sight rather than mailing an invitation.
router.post('/', requireRole('officer'), async (req, res) => {
    const { firstName, lastName, password, role = 'member', instagram } = req.body

    if (!firstName?.trim() || !lastName?.trim() || !req.body.email || !password) {
        return res.status(400).json({ message: 'firstName, lastName, email, and password are required' })
    }
    if (!ROLES.includes(role)) {
        return res.status(400).json({ message: `role must be one of: ${ROLES.join(', ')}` })
    }
    if (!canManage(req.role, role)) {
        return res.status(403).json({ message: `Only an admin can add ${role}s` })
    }

    // the username is the email's first half, same as signing up
    const { email, username: handle, error } = fromEmail(req.body.email)
    if (error) { return res.status(400).json({ message: error }) }

    try {
        const passwordHash = await bcrypt.hash(password, 8)

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
        const target = await prisma.member.findUnique({ where: { userId: targetId } })
        if (!target) { return res.status(404).json({ message: 'Member not found' }) }
        if (!canManage(req.role, target.role)) {
            return res.status(403).json({ message: `Only an admin can remove ${target.role}s` })
        }

        await prisma.user.delete({ where: { userId: targetId } })
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
        const updated = await prisma.member.update({
            where: { userId: targetId },
            data: { role }
        })
        res.json(updated)
    } catch (err) {
        if (err.code === 'P2025') { return res.status(404).json({ message: 'Member not found' }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

export default router
