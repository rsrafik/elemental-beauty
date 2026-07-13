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
    }
}

router.post('/register', async (req, res) => {
    const { username, email, password } = req.body
    try {
        const passwordHash = await bcrypt.hash(password, 8)   // async, not hashSync
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
    // you write: findUnique by username → 404 if missing →
    // bcrypt.compare (async) → 401 if wrong → sign { id } → res.json({ token })
    // wrap in try/catch like register
})

// Logged-in but NOT necessarily a member — hence authMiddleware per-route, no requireRole
router.post('/verify-email', authMiddleware, async (req, res) => {
    // you write: update users set emailVerified = true where userId = req.userId
    // then: await promoteIfEligible(req.userId) → res.json({ message: ... })
    // (real email verification would check a code — fine to fake it for now)
})

router.post('/waiver', authMiddleware, async (req, res) => {
    // identical shape: flip waiverSigned → promoteIfEligible → respond
})

export default router