import nodemailer from 'nodemailer'

// Email delivery, through the first of these that's configured:
//
//   Gmail     GMAIL_USER + GMAIL_APP_PASSWORD — sends as that Gmail account
//             (e.g. elementalbeauty26@gmail.com) through Google's own mail
//             server. Works for any recipient with no domain to own. The
//             password is an app password from the account's security
//             settings, not its real one. Gmail caps it at about 500
//             recipients a day.
//   Resend    RESEND_API_KEY — sends from EMAIL_FROM, which has to be on a
//             domain verified in the Resend account
//   neither   prints the email to the console (dev fallback) so flows stay
//             testable without an account
//
// Returns true only if a real email went out.
//
// Other env vars:
//   EMAIL_FROM  — the display name and address, e.g.
//                 "Elemental Beauty <elementalbeauty26@gmail.com>". With
//                 Gmail the address part is always the account's own —
//                 Gmail rewrites anything else — so only the name matters.
//   EMAIL_REPLY_TO — where replies go (e.g. the club's real inbox), so the
//                 sending account's own inbox stays quiet. Optional.
//   APP_URL     — public site URL, used to build clickable links

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
            }
        })
    }
    return gmail
}

// the name from EMAIL_FROM, on the Gmail account's own address
function gmailFrom() {
    const name = /^\s*"?([^"<]+?)"?\s*</.exec(process.env.EMAIL_FROM ?? '')?.[1] ?? 'Elemental Beauty'
    return `"${name}" <${process.env.GMAIL_USER}>`
}

// `html` is optional — the formatted version (see emailTemplate.js); `text`
// is always sent too, for mail apps that don't show HTML. `bcc` is optional,
// for a message to a list (see emailAll.js). `attachments` is optional too —
// [{ filename, content: Buffer }], e.g. a lab's prelab PDF.
export async function sendEmail({ to, bcc, subject, text, html, attachments }) {
    const replyTo = process.env.EMAIL_REPLY_TO || undefined

    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
        try {
            await gmailTransport().sendMail({ from: gmailFrom(), to, bcc, replyTo, subject, text, html, attachments })
            return true
        } catch (err) {
            console.error(`Email send failed (Gmail): ${err.message}`)
            return false
        }
    }

    if (!process.env.RESEND_API_KEY) {
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
