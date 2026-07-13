import express from 'express'
import jwt from 'jsonwebtoken'
import QRCode from 'qrcode'
import prisma from '../prismaClient.js'
import requireRole from '../middleware/requireRole.js'

const router = express.Router()

const ROLES = ['member', 'officer', 'treasurer', 'admin']

// Roster — whitelisted fields only; email and passwordHash never leave the server
router.get('/', async (req, res) => {
    try {
        const members = await prisma.member.findMany({
            select: {
                userId: true,
                role: true,
                instagram: true,
                profilePicture: true,
                points: true,
                dateJoined: true,
                user: { select: { username: true } }
            },
            orderBy: { dateJoined: 'asc' }
        })
        res.json(members)
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
                    select: { username: true, email: true, emailVerified: true, waiverSigned: true, createdAt: true }
                }
            }
        })
        if (!me) { return res.status(404).json({ message: 'Member profile not found' }) }

        res.json(me)
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
router.put('/me', async (req, res) => {
    const { instagram, profilePicture } = req.body

    const data = {}
    if (instagram !== undefined) { data.instagram = instagram }
    if (profilePicture !== undefined) { data.profilePicture = profilePicture }

    try {
        const me = await prisma.member.update({
            where: { userId: req.userId },
            data
        })
        res.json(me)
    } catch (err) {
        if (err.code === 'P2025') { return res.status(404).json({ message: 'Member profile not found' }) }
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

// Deleting the USER cascades to member, member_lab, member_event;
// reimbursement rows survive with memberId set to null.
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

export default router
