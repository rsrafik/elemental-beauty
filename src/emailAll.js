import { sendEmail } from './email.js'
import { actionEmail } from './emailTemplate.js'

// "Email all": an officer's message, sent by the server from the club's own
// address (see email.js) in the club's layout, with replies going to
// EMAIL_REPLY_TO. Everyone's in BCC, so nobody sees anyone else's address; the
// message is addressed to the club's inbox itself, which keeps a copy.
//
// Gmail takes at most about 100 recipients a message, so a long list goes out
// in batches. Returns how many were sent to, or throws if a batch failed.

const BATCH = 90

// a blank line starts a new paragraph; single line breaks are kept inside one
function paragraphs(message) {
    return String(message)
        .split(/\n\s*\n/)
        .map((block) => block.trim())
        .filter(Boolean)
}

export async function emailAll({ recipients, subject, message, reason }) {
    const list = [...new Set(recipients.filter(Boolean))]
    if (list.length === 0) { return 0 }

    const to = process.env.EMAIL_REPLY_TO || process.env.GMAIL_USER ||
        /<([^>]+)>/.exec(process.env.EMAIL_FROM ?? '')?.[1] || 'onboarding@resend.dev'
    const body = actionEmail({ heading: subject, lines: paragraphs(message), reason })

    for (let i = 0; i < list.length; i += BATCH) {
        const ok = await sendEmail({ to, bcc: list.slice(i, i + BATCH), subject, ...body })
        // no mail service configured: printed to the console, which is fine
        // for trying it out locally
        const configured = (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) || process.env.RESEND_API_KEY
        if (!ok && configured) {
            throw new Error(i === 0
                ? 'The email didn’t go out — check the server log'
                : `Only the first ${i} went out — check the server log`)
        }
    }
    return list.length
}

// Validates what the page sent. Returns { subject, message } or { error }.
export function readMessage(body) {
    const subject = String(body?.subject ?? '').trim()
    const message = String(body?.message ?? '').trim()
    if (!subject) { return { error: 'Give the email a subject' } }
    if (!message) { return { error: 'Write a message' } }
    if (subject.length > 200) { return { error: 'Keep the subject under 200 characters' } }
    if (message.length > 10000) { return { error: 'That message is too long' } }
    return { subject, message }
}
