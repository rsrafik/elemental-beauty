// J-board's treasury team: a j-board member with 'treasury' among their
// jboard_teams. The rest of j-board doesn't get the club's books at all; the
// treasury team reads every one of them the way the treasurer does — the
// ledger, the whole receipts queue, dues, the targets — and keeps two things:
//
//   grants        the grant tracker — adding, editing, deleting
//   sponsorships  income filed under 'sponsors' (the check on the row itself
//                 is in transactionRoutes.js, since only the row knows)
//
// They don't add events either (eventRoutes.js).
//
// Anything else they'd change on a finance route is refused in booksAccess
// (requireRole.js), before the router sees it. Past that, requireRole lets
// them through a 'treasurer' gate like the treasurer.
//
// The page side of this is onTreasuryTeam in frontend/lib/roles.js.

const READS = new Set(['GET', 'HEAD', 'OPTIONS'])

const ALLOWED = [
    /^\/api\/grants(\/\d+)?$/,
    /^\/api\/transactions(\/\d+)?$/,
]

export const TREASURY_REFUSAL = 'J-board’s treasury team can view the books but only change grants and sponsorships'
export const SPONSORS_ONLY = 'J-board’s treasury team can only change sponsorship income'

export function onTreasuryTeam(req) {
    return req.role === 'jboard' && (req.jboardTeams ?? []).includes('treasury')
}

export function treasuryMayDo(method, url) {
    if (READS.has(method)) { return true }
    const path = url.split('?')[0]
    return ALLOWED.some((pattern) => pattern.test(path))
}

// A ledger row the treasury team may change: sponsorship income, and not an
// awarded grant's row (that one is the grant's, kept by its triggers).
export function isSponsorship(row) {
    return row.type === 'income' && row.category === 'sponsors' && row.grantId == null
}
