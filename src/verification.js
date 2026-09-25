import jwt from 'jsonwebtoken'
import { sendEmail } from './email.js'
import { actionEmail } from './emailTemplate.js'

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
        subject: 'Confirm your Elemental Beauty email',
        ...actionEmail({
            heading: user.firstName ? `Welcome, ${user.firstName}!` : 'Welcome to Elemental Beauty!',
            lines: ['Confirm this is your email address and you’re one step closer to being an Elementist.'],
            button: { label: 'Confirm my email', url: link },
            after: [
                'The link works for 24 hours. Once your email is confirmed and you’ve signed the waiver on the site, you’re a member.'
            ],
            reason: `You’re getting this because an Elemental Beauty account was made with ${user.email}. If that wasn’t you, you can ignore this email.`
        })
    })
    return verificationToken
}
