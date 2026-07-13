import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../prismaClient.js'
import authMiddleware from '../middleware/authMiddleware.js'
import { sendEmail } from '../email.js'

const router = express.Router()

// Tokens are only ever exposed in API responses in development — fail-closed:
// if NODE_ENV is missing or anything else, nothing leaks.
const IS_DEV = process.env.NODE_ENV === 'development'

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

// Email a verification token (24h expiry). The token itself is the proof —
// only someone with access to the inbox can produce it.
async function sendVerificationEmail(user) {
    const verificationToken = jwt.sign(
        { id: user.userId, purpose: 'verify-email' },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
    )
    const link = process.env.APP_URL
        ? `${process.env.APP_URL}/verify?token=${verificationToken}`
        : null
    await sendEmail({
        to: user.email,
        subject: 'Verify your Elemental Beauty email',
        text: link
            ? `Welcome to Elemental Beauty!\n\nVerify your email by opening this link (expires in 24 hours):\n${link}`
            : `Welcome to Elemental Beauty!\n\nYour verification code (expires in 24 hours):\n\n${verificationToken}`
    })
    return verificationToken
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

        const verificationToken = await sendVerificationEmail(user)

        const token = jwt.sign({ id: user.userId }, process.env.JWT_SECRET, { expiresIn: '24h' })
        const response = { token, message: 'Check your email for a verification link' }
        if (IS_DEV) { response.verificationToken = verificationToken }   // dev only
        res.status(201).json(response)
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

// Verify email with the emailed token. No login required — possessing the
// token proves inbox access, which is the entire point of verification.
router.post('/verify-email', async (req, res) => {
    const { verificationToken } = req.body
    if (!verificationToken) { return res.status(400).json({ message: 'verificationToken is required' }) }

    let decoded
    try {
        decoded = jwt.verify(verificationToken, process.env.JWT_SECRET)
    } catch {
        return res.status(400).json({ message: 'Invalid or expired verification token' })
    }
    if (decoded.purpose !== 'verify-email') {
        return res.status(400).json({ message: 'Invalid or expired verification token' })
    }

    try {
        await prisma.user.update({
            where: { userId: decoded.id },
            data: { emailVerified: true }
        })

        const promoted = await promoteIfEligible(decoded.id)
        res.json({
            message: promoted
                ? 'Email verified~ Welcome, you are now a member!'
                : 'Email verified. Sign the waiver to become a member.'
        })
    } catch (err) {
        if (err.code === 'P2025') { return res.status(400).json({ message: 'Invalid or expired verification token' }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Logged-in users whose verification email expired or got lost
router.post('/resend-verification', authMiddleware, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { userId: req.userId } })
        if (user.emailVerified) { return res.json({ message: 'Email is already verified' }) }

        const verificationToken = await sendVerificationEmail(user)

        const response = { message: 'Verification email sent' }
        if (IS_DEV) { response.verificationToken = verificationToken }   // dev only
        res.json(response)
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
// (single-use) with no extra database table needed.
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
            const link = process.env.APP_URL
                ? `${process.env.APP_URL}/reset-password?token=${resetToken}`
                : null
            await sendEmail({
                to: user.email,
                subject: 'Reset your Elemental Beauty password',
                text: link
                    ? `Someone requested a password reset for your account.\n\nReset it here (expires in 15 minutes):\n${link}\n\nIf this wasn't you, ignore this email.`
                    : `Someone requested a password reset for your account.\n\nYour reset code (expires in 15 minutes):\n\n${resetToken}\n\nIf this wasn't you, ignore this email.`
            })
            if (IS_DEV) { response.resetToken = resetToken }   // dev only
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
