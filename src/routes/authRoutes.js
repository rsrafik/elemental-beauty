import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../prismaClient.js'
import authMiddleware from '../middleware/authMiddleware.js'
import { sendEmail } from '../email.js'
import { fromEmail, takenMessage } from '../accountEmail.js'

const router = express.Router()

// Tokens are only ever exposed in API responses in development — fail-closed:
// if NODE_ENV is missing or anything else, nothing leaks.
const IS_DEV = process.env.NODE_ENV === 'development'

// Signing up gets you an ACCOUNT, not a membership: a fresh row in `users` and
// nothing in `members`, which is the role the frontend calls 'user'. The member
// row — and with it a rank, points and a place on the board — arrives when the
// waiver is signed, or when an officer adds you from /students.
//
// Email verification is switched off for now, so the waiver is the only gate.
// The verify-email endpoints below are left intact and still work; put
// `user.emailVerified &&` back in front of the waiver check to turn it back on.
async function promoteIfEligible(userId) {
    const user = await prisma.user.findUnique({ where: { userId } })
    if (user.waiverSigned) {
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

// The sign-up form asks for an email, a password, the person's name and an
// instagram handle it marks optional. The username isn't asked for: it's the
// part of the email before the @ (see accountEmail.js), and any domain will do.
//
// What comes out is an account with NO member row — role 'user'. That's the
// onboarding dashboard, and the labs / events / calendar menu isn't offered
// until the waiver promotes them.
router.post('/register', async (req, res) => {
    const { password, firstName, lastName, instagram } = req.body

    if (!req.body.email || !password) {
        return res.status(400).json({ message: 'email and password are required' })
    }
    if (String(password).length < 8) {
        return res.status(400).json({ message: 'password must be at least 8 characters' })
    }

    const { email, username: handle, error } = fromEmail(req.body.email)
    if (error) { return res.status(400).json({ message: error }) }

    try {
        // checked first: the same address is the more useful thing to be told
        // about than the username it shares with itself
        if (await prisma.user.findUnique({ where: { email }, select: { userId: true } })) {
            return res.status(409).json({ message: 'An account with that email already exists' })
        }
        const passwordHash = await bcrypt.hash(password, 8)
        const user = await prisma.user.create({
            data: {
                username: handle,
                email,
                passwordHash,
                firstName: firstName?.trim() || '',
                lastName: lastName?.trim() || '',
                instagram: instagram?.trim() || null,
                // Verification is switched off for now (see promoteIfEligible),
                // so nothing would ever flip this and /account would show every
                // account as unverified forever. Drop this line and put the
                // sendVerificationEmail call back to turn it on again.
                emailVerified: true
            }
        })

        const token = jwt.sign({ id: user.userId }, process.env.JWT_SECRET, { expiresIn: '24h' })
        res.status(201).json({ token, message: 'Account created' })
    } catch (err) {
        if (err.code === 'P2002') {           // Prisma unique violation
            return res.status(409).json({ message: takenMessage(err, handle) })
        }
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Who the token belongs to, and what they're allowed to see. Every page asks
// this on load — it's what replaces the hardcoded role the frontend used to
// build itself against.
//
// Behind authMiddleware alone rather than requireRole, deliberately: somebody
// with an account and no membership has to be able to ask who they are, and
// `role: null` is the honest answer for them rather than a 403.
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { userId: req.userId },
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
                createdAt: true,
                member: { select: { role: true, points: true, dateJoined: true } }
            }
        })
        if (!user) { return res.status(404).json({ message: 'Account not found' }) }

        const { member, ...account } = user
        res.json({
            ...account,
            // 'user' rather than null: the frontend ranks roles, and an account
            // with no membership is the bottom of that ladder, not the absence
            // of an answer.
            role: member?.role ?? 'user',
            points: member?.points ?? 0,
            dateJoined: member?.dateJoined ?? null
        })
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Signs in with the username, or with the whole email address — whichever
// someone types, since the username is only the address's first half.
router.post('/login', async (req, res) => {
    const { password } = req.body
    const login = String(req.body.username ?? '').trim().toLowerCase()

    if (!login || !password) {
        return res.status(400).json({ message: 'username and password are required' })
    }

    try {
        const user = await prisma.user.findUnique({
            where: login.includes('@') ? { email: login } : { username: login }
        })

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
    const email = String(req.body.email ?? '').trim().toLowerCase()
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
