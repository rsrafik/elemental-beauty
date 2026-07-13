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

// Request a password reset. The reset token is signed with JWT_SECRET plus the
// user's CURRENT password hash — so it dies the moment the password changes
// (single-use) with no extra database table needed. When an email service is
// added, the token gets emailed as a link; until then, dev mode returns it in
// the response so the flow is testable.
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body
    if (!email) { return res.status(400).json({ message: 'email is required' }) }

    try {
        const user = await prisma.user.findUnique({ where: { email } })

        // Identical response whether or not the email exists — no enumeration
        const response = { message: 'If that email is registered, a reset link has been sent' }

        if (user) {
            const resetToken = jwt.sign(
                { id: user.userId, purpose: 'password-reset' },
                process.env.JWT_SECRET + user.passwordHash,
                { expiresIn: '15m' }
            )
            // TODO: email this as a link once an email service exists
            console.log(`Password reset token for ${email}: ${resetToken}`)
            if (process.env.NODE_ENV !== 'production') {
                response.resetToken = resetToken   // dev convenience ONLY
            }
        }

        res.json(response)
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

router.post('/reset-password', async (req, res) => {
    const { resetToken, newPassword } = req.body
    if (!resetToken || !newPassword) {
        return res.status(400).json({ message: 'resetToken and newPassword are required' })
    }

    try {
        // decode (unverified) just to learn WHO this claims to be...
        const unverified = jwt.decode(resetToken)
        if (!unverified?.id || unverified.purpose !== 'password-reset') {
            return res.status(400).json({ message: 'Invalid or expired reset token' })
        }

        const user = await prisma.user.findUnique({ where: { userId: unverified.id } })
        if (!user) { return res.status(400).json({ message: 'Invalid or expired reset token' }) }

        // ...then verify for real against that user's per-token secret
        try {
            jwt.verify(resetToken, process.env.JWT_SECRET + user.passwordHash)
        } catch {
            return res.status(400).json({ message: 'Invalid or expired reset token' })
        }

        const passwordHash = await bcrypt.hash(newPassword, 8)
        await prisma.user.update({
            where: { userId: user.userId },
            data: { passwordHash }
        })

        res.json({ message: 'Password reset — you can now log in with your new password' })
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

export default router
