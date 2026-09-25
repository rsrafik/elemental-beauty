import { promises as dns } from 'dns'

// Which mail service an address lives on, so "email all" can open the one the
// sender actually uses. The domain's MX records say who receives its mail —
// purdue.edu's point at Microsoft (outlook.com), gmail.com's at Google — which
// is right for school and company domains too, where the name alone says
// nothing.
//
//   'gmail'            Google (Gmail, or Google Workspace on its own domain)
//   'outlook'          Microsoft 365 — a school or work account
//   'outlook-personal' outlook.com / hotmail / live — the consumer Outlook
//   'yahoo'            Yahoo Mail
//   'other'            anything else, or no answer: the page falls back to a
//                      mailto: link and the computer's own mail app
//
// Answers are kept per domain for a day; a club's worth of officers all share
// two or three domains.

const PERSONAL_OUTLOOK = ['outlook.com', 'hotmail.com', 'live.com', 'msn.com']
const DAY = 24 * 60 * 60 * 1000
const cache = new Map()

function fromMx(hosts) {
    if (hosts.some((h) => /(^|\.)google(mail)?\.com$/.test(h))) { return 'gmail' }
    if (hosts.some((h) => /(^|\.)outlook\.com$/.test(h))) { return 'outlook' }
    if (hosts.some((h) => /(^|\.)yahoodns\.net$/.test(h))) { return 'yahoo' }
    return 'other'
}

export async function mailProvider(email) {
    const domain = String(email ?? '').trim().toLowerCase().split('@')[1]
    if (!domain) { return 'other' }
    if (PERSONAL_OUTLOOK.includes(domain)) { return 'outlook-personal' }

    const hit = cache.get(domain)
    if (hit && Date.now() - hit.at < DAY) { return hit.provider }

    let provider = 'other'
    try {
        const records = await dns.resolveMx(domain)
        provider = fromMx(records.map((r) => r.exchange.toLowerCase()))
    } catch {
        // no records, or no network — the mail app is the safe fallback
    }
    cache.set(domain, { provider, at: Date.now() })
    return provider
}
