import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../prismaClient.js'
import authMiddleware from '../middleware/authMiddleware.js'

const router = express.Router()

// Shared helper: called by BOTH verify-email and waiver — whichever
// flips second creates the members row. Safe to call repeatedly.
async function promoteIfEligible(userId) {
    const user = await prisma.user.findUnique({ where: { userId } })
    if (user.emailVerified && user.waiverSigned) {
        await prisma.member.upsert({          // upsert = no crash if row exists
            where: { userId },
            update: {},
            create: { userId }                // role defaults to 'member'
        })
        return true
    }
    return false
}

router.post('/register', async (req, res) => {
    const { username, email, password } = req.body

    if (!username || !email || !password) {
        return res.status(400).json({ message: 'username, email, and password are required' })
    }

    try {
        const passwordHash = await bcrypt.hash(password, 8)
        const user = await prisma.user.create({
            data: { username, email, passwordHash }
        })
        const token = jwt.sign({ id: user.userId }, process.env.JWT_SECRET, { expiresIn: '24h' })
        res.status(201).json({ token })
    } catch (err) {
        if (err.code === 'P2002') {           // Prisma unique violation
            return res.status(409).json({ message: 'Username or email already taken' })
        }
        console.error(err.message)
        res.sendStatus(500)
    }
})

router.post('/login', async (req, res) => {
    const { username, password } = req.body

    if (!username || !password) {
        return res.status(400).json({ message: 'username and password are required' })
    }

    try {
        const user = await prisma.user.findUnique({ where: { username } })

        // Same response whether the username or the password is wrong
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' })
        }

        const passwordIsValid = await bcrypt.compare(password, user.passwordHash)
        if (!passwordIsValid) {
            return res.status(401).json({ message: 'Invalid credentials' })
        }

        const token = jwt.sign({ id: user.userId }, process.env.JWT_SECRET, { expiresIn: '24h' })
        res.json({ token })
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Logged-in but NOT necessarily a member
router.post('/verify-email', authMiddleware, async (req, res) => {
    try {
        await prisma.user.update({
            where: { userId: req.userId },
            data: { emailVerified: true }
        })

        const promoted = await promoteIfEligible(req.userId)
        res.json({
            message: promoted
                ? 'Email verified~ Welcome, you are now a member!'
                : 'Email verified. Sign the waiver to become a member.'
        })
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

router.post('/waiver', authMiddleware, async (req, res) => {
    try {
        await prisma.user.update({
            where: { userId: req.userId },
            data: { waiverSigned: true }
        })

        const promoted = await promoteIfEligible(req.userId)
        res.json({
            message: promoted
                ? 'Waiver signed ~ welcome, you are now a member!'
                : 'Waiver signed. Verify your email to become a member.'
        })
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

export default router
