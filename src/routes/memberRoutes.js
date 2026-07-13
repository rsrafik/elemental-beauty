import express from 'express'
import jwt from 'jsonwebtoken'
import QRCode from 'qrcode'
import prisma from '../prismaClient.js'
import requireRole from '../middleware/requireRole.js'

const router = express.Router()

router.get('/', async (req, res) => {
    // roster: findMany with select — include user.username, role, points;
    // exclude anything private. Never include user.passwordHash.
})

router.get('/me', async (req, res) => {
    // findUnique({ where: { userId: req.userId }, include: { user: { select: {...} } } })
})

router.get('/me/qr', async (req, res) => {
    const qrToken = jwt.sign({ id: req.userId }, process.env.QR_SECRET, { noTimestamp: true })
    const png = await QRCode.toBuffer(qrToken)
    res.type('png').send(png)
})

router.put('/me', async (req, res) => {
    const { instagram, profilePicture } = req.body   // destructuring IS the whitelist —
    // role and points physically can't sneak in because you never read them
    // you write: prisma.member.update({ where: { userId: req.userId }, data: { instagram, profilePicture } })
})

router.put('/:id/role', requireRole('admin'), async (req, res) => {
    const { role } = req.body
    // you write: validate role is one of the four values → update member → return it.
    // Optional guard: prevent admins demoting themselves (req.userId === parseInt(req.params.id))
})

router.delete('/me', async (req, res) => {
    // deleting the USER cascades to member, member_lab, member_event;
    // reimbursements survive with memberId → null (your SetNull decision)
    // you write: prisma.user.delete({ where: { userId: req.userId } })
})

export default router