// Sponsors: one row each (the Sponsor model in prisma/schema.prisma), from the
// first "sponsor a batch" request to the pill on the landing page.
//
//   the request   companyName, contactName, contactInfo (an email or a phone
//                 number), offers (products / money / other, any of them),
//                 offerOther (what "other" is), details, status, source
//   the pill      landingTitle, website, image, onLanding, landingOrder
//
// The landing editor (src/routes/landingRoutes.js) keeps the pills. A pill is
// on the page while its row is onLanding and active — so a sponsor moved to
// archive drops off the page without anyone touching the pill.

export const STATUSES = ['pending', 'contacting', 'active', 'archive']
export const SOURCES = ['form', 'manual']
export const OFFERS = ['products', 'money', 'other']

export function onLandingPage(row) {
    return Boolean(row?.onLanding) && row?.status === 'active'
}

// What the public page is given for a pill: never who to contact, or what
// they offered.
export function publicPill(row) {
    return {
        sponsorId: row.sponsorId,
        title: row.landingTitle || null,
        website: row.website || null,
        imageUrl: row.imageUrl ?? null
    }
}

// Who a sponsor is, for a list: the company, or failing that the pill's title
export function sponsorName(row) {
    return row.companyName || row.landingTitle || null
}

// A website as typed — 'acme.com', 'https://acme.com/about' — made into a
// link that opens: https:// put in front when it has no scheme, and anything
// that isn't http(s) or doesn't look like an address refused. '' and null are
// "no website" (null); undefined is an error-free "nothing".
export function readWebsite(value) {
    if (value == null) { return { website: null } }
    if (typeof value !== 'string') { return { error: 'The website has to be an address' } }
    const typed = value.trim()
    if (!typed) { return { website: null } }
    const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(typed) ? typed : `https://${typed}`
    let url
    try {
        url = new URL(withScheme)
    } catch {
        return { error: 'That website isn’t an address' }
    }
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.')) {
        return { error: 'That website isn’t an address' }
    }
    if (url.href.length > 500) { return { error: 'That website is too long' } }
    return { website: url.href }
}
