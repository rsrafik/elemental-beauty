import jwt from 'jsonwebtoken'
import { sendEmail } from './email.js'

// Where emailed links point. Set for real on the production host; in local
// development it falls back to the Next dev server, so the link printed to
// the console (see email.js) can be clicked straight through.
export const APP_URL = process.env.APP_URL ||
    (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '')

// Email a verification token (24h expiry). The token itself is the proof —
// only someone with access to the inbox can produce it.
export async function sendVerificationEmail(user) {
    const verificationToken = jwt.sign(
        { id: user.userId, purpose: 'verify-email' },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
    )
    const link = `${APP_URL}/verify?token=${verificationToken}`
    await sendEmail({
        to: user.email,
        subject: 'Verify your Elemental Beauty email',
        text: `Welcome to Elemental Beauty!\n\nConfirm your email by opening this link (it expires in 24 hours):\n${link}\n\nOnce it's confirmed and you've signed the waiver on the site, you're a member.`
    })
    return verificationToken
}
