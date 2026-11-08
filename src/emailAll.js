import { sendEmail, mailService } from './email.js'
import { actionEmail } from './emailTemplate.js'

// "Email all": an officer's message, sent by the server from the club's own
// address (see email.js) in the club's layout, with replies going to
// EMAIL_REPLY_TO. Everyone's in BCC, so nobody sees anyone else's address; the
// message is addressed to the club's inbox itself, which keeps a copy.
//
// Each mail service caps how many people one message can go to, so a long
// list goes out in batches: Gmail takes about 100, Resend 50 counting the
// club's own address in To. Resend also turns away more than a couple of
// requests a second, so its batches are spaced out. Returns how many were
// sent to, or throws if a batch failed.
//
// `prefer: 'gmail'` sends through Gmail when it's set (the officer
// dashboard's "Email all"); otherwise it goes the way every email does
// (see email.js).

export function batchSize(service) {
    return service === 'resend' ? 49 : 90
}

const RESEND_GAP_MS = 600
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// a blank line starts a new paragraph; single line breaks are kept inside one
function paragraphs(message) {
    return String(message)
        .split(/\n\s*\n/)
        .map((block) => block.trim())
        .filter(Boolean)
}

export async function emailAll({ recipients, subject, message, reason, prefer }) {
    const list = [...new Set(recipients.filter(Boolean))]
    if (list.length === 0) { return 0 }

    const to = process.env.EMAIL_REPLY_TO || process.env.GMAIL_USER ||
        /<([^>]+)>/.exec(process.env.EMAIL_FROM ?? '')?.[1] || 'onboarding@resend.dev'
    const body = actionEmail({ heading: subject, lines: paragraphs(message), reason })

    const service = mailService(prefer)
    const size = batchSize(service)
    for (let i = 0; i < list.length; i += size) {
        if (i > 0 && service === 'resend') { await wait(RESEND_GAP_MS) }
        const ok = await sendEmail({ to, bcc: list.slice(i, i + size), subject, ...body, prefer })
        // no mail service configured: printed to the console, which is fine
        // for trying it out locally
        if (!ok && service) {
            throw new Error(i === 0
                ? 'The email didn’t go out. Check the server log'
                : `Only the first ${i} went out. Check the server log`)
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
