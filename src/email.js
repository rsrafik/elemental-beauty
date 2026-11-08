import nodemailer from 'nodemailer'
import MailComposer from 'nodemailer/lib/mail-composer'

// Email delivery, through one of these:
//
//   Resend    RESEND_API_KEY — sends from EMAIL_FROM, which has to be on a
//             domain verified in the Resend account. Used for everything
//             when it's set, except a send that asks for Gmail.
//   Gmail     sends as GMAIL_USER (e.g. elementalbeauty26@gmail.com). Works
//             for any recipient with no domain to own; Gmail caps it at
//             about 500 recipients a day. The officer dashboard's "Email
//             all" goes through it when it's set (see emailAll.js), so one
//             big message doesn't use up Resend's daily allowance;
//             everything else only uses it when Resend isn't set. Two ways
//             in, the first that's set:
//               Gmail API  GMAIL_CLIENT_ID + GMAIL_CLIENT_SECRET +
//                          GMAIL_REFRESH_TOKEN — over HTTPS, so it works on
//                          hosts that block mail ports (Render's free plan
//                          does). `npm run gmail-token` gets the token.
//               SMTP       GMAIL_APP_PASSWORD — an app password from the
//                          account's security settings, not its real one.
//                          Needs the host to allow outgoing mail ports.
//   neither   prints the email to the console (dev fallback) so flows stay
//             testable without an account
//
// Returns true only if a real email went out.
//
// Other env vars:
//   EMAIL_FROM  — the display name and address, e.g.
//                 "Elemental Beauty <hello@elementalbeauty.org>". With
//                 Gmail the address part is always the account's own —
//                 Gmail rewrites anything else — so only the name matters.
//   EMAIL_REPLY_TO — where replies go (e.g. the club's real inbox), so the
//                 sending account's own inbox stays quiet. Optional.
//   APP_URL     — public site URL, used to build clickable links

const gmailApiSet = () => Boolean(process.env.GMAIL_USER && process.env.GMAIL_CLIENT_ID &&
    process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN)
const gmailSmtpSet = () => Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
export const gmailSet = () => gmailApiSet() || gmailSmtpSet()
const resendSet = () => Boolean(process.env.RESEND_API_KEY)

// which service a send goes through: 'gmail', 'resend', or null (console).
// `prefer: 'gmail'` picks Gmail first; otherwise Resend comes first.
export function mailService(prefer) {
    const order = prefer === 'gmail' ? [['gmail', gmailSet], ['resend', resendSet]] : [['resend', resendSet], ['gmail', gmailSet]]
    return order.find(([, isSet]) => isSet())?.[0] ?? null
}

let gmail = null
function gmailTransport() {
    if (!gmail) {
        gmail = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_USER,
                // Google shows app passwords in groups of four with spaces;
                // either way works
                pass: process.env.GMAIL_APP_PASSWORD.replace(/\s+/g, '')
            },
            // give up quickly when Gmail can't be reached (e.g. a host that
            // blocks outgoing mail ports, like Render's free plan) instead of
            // the 2-minute default, which outlasts the request and leaves the
            // page waiting forever
            connectionTimeout: 15 * 1000,
            greetingTimeout: 15 * 1000,
            socketTimeout: 60 * 1000
        })
    }
    return gmail
}

// the name from EMAIL_FROM, on the Gmail account's own address
function gmailFrom() {
    const name = /^\s*"?([^"<]+?)"?\s*</.exec(process.env.EMAIL_FROM ?? '')?.[1] ?? 'Elemental Beauty'
    return `"${name}" <${process.env.GMAIL_USER}>`
}

// ---- Gmail API -------------------------------------------------------------
// The refresh token (a long-lived "this site may send as the club" from the
// account's owner) buys an access token good for about an hour, kept here
// until it's nearly up.
let gmailAccess = null

async function gmailAccessToken() {
    if (gmailAccess && gmailAccess.expires > Date.now() + 60 * 1000) { return gmailAccess.token }
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: process.env.GMAIL_CLIENT_ID,
            client_secret: process.env.GMAIL_CLIENT_SECRET,
            refresh_token: process.env.GMAIL_REFRESH_TOKEN,
            grant_type: 'refresh_token'
        }),
        signal: AbortSignal.timeout(15 * 1000)
    })
    if (!res.ok) {
        // invalid_grant: the token was revoked, or the app is still in
        // "Testing" on Google's side, where tokens die after a week. Run
        // `npm run gmail-token` again.
        throw new Error(`couldn't get a Gmail access token (${res.status}): ${await res.text()}`)
    }
    const { access_token: token, expires_in: seconds } = await res.json()
    gmailAccess = { token, expires: Date.now() + seconds * 1000 }
    return token
}

// the whole message, Bcc line kept: Gmail sends to everyone on it and takes
// it out of the copies people get
async function sendViaGmailApi(mail) {
    const node = new MailComposer(mail).compile()
    node.keepBcc = true
    const raw = await node.build()
    const res = await fetch('https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=media', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${await gmailAccessToken()}`,
            'Content-Type': 'message/rfc822'
        },
        body: raw,
        signal: AbortSignal.timeout(60 * 1000)
    })
    if (!res.ok) { throw new Error(`${res.status}: ${await res.text()}`) }
}

// `html` is optional — the formatted version (see emailTemplate.js); `text`
// is always sent too, for mail apps that don't show HTML. `bcc` is optional,
// for a message to a list (see emailAll.js). `attachments` is optional too —
// [{ filename, content: Buffer }], e.g. a lab's prelab PDF. `prefer` is
// optional: 'gmail' to send through Gmail when it's set (see mailService).
export async function sendEmail({ to, bcc, subject, text, html, attachments, prefer }) {
    const replyTo = process.env.EMAIL_REPLY_TO || undefined
    const service = mailService(prefer)

    if (service === 'gmail') {
        const mail = { from: gmailFrom(), to, bcc, replyTo, subject, text, html, attachments }
        try {
            if (gmailApiSet()) {
                await sendViaGmailApi(mail)
            } else {
                await gmailTransport().sendMail(mail)
            }
            return true
        } catch (err) {
            console.error(`Email send failed (Gmail): ${err.message}`)
            return false
        }
    }

    if (service !== 'resend') {
        const files = attachments?.length ? ` | Attached: ${attachments.map((a) => a.filename).join(', ')}` : ''
        console.log(`[email fallback] To: ${to}${bcc?.length ? ` + ${bcc.length} bcc` : ''} | Subject: ${subject}${files}\n${text}\n`)
        return false
    }

    try {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: process.env.EMAIL_FROM || 'Elemental Beauty <onboarding@resend.dev>',
                to: [to],
                ...(bcc?.length ? { bcc } : {}),
                ...(replyTo ? { reply_to: replyTo } : {}),
                subject,
                text,
                ...(html ? { html } : {}),
                ...(attachments?.length
                    ? { attachments: attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content).toString('base64') })) }
                    : {})
            })
        })
        if (!res.ok) {
            console.error(`Email send failed (${res.status}): ${await res.text()}`)
            return false
        }
        return true
    } catch (err) {
        console.error(`Email send failed: ${err.message}`)
        return false
    }
}
