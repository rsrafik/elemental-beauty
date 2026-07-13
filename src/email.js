// Email delivery. Sends through Resend when RESEND_API_KEY is set; otherwise
// prints the email to the console (dev fallback) so flows stay testable
// without an account. Returns true only if a real email went out.
//
// Production env vars:
//   RESEND_API_KEY  — required in production (server.js enforces this)
//   EMAIL_FROM      — e.g. "Elemental Beauty <hello@yourdomain.com>"
//   APP_URL         — public site URL, used to build clickable links
export async function sendEmail({ to, subject, text }) {
    if (!process.env.RESEND_API_KEY) {
        console.log(`[email fallback] To: ${to} | Subject: ${subject}\n${text}\n`)
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
                subject,
                text
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
