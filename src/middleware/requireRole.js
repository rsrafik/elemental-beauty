import { TREASURY_REFUSAL, onTreasuryTeam, treasuryMayDo } from './treasury.js'

// j-board sits just above officer: everything an officer can do, but not the
// treasurer's books. A VIP is a member who's paid this year's dues — the same
// rank, so the same everything (see syncVipRoles in dues.js). The advisor ranks with admin — they can open everything
// an admin can — but every change they'd make is refused before it gets this
// far (authMiddleware, see advisor.js).
const RANK = {
    member: 1,
    vip: 1,
    officer: 2,
    jboard: 3,
    treasurer: 4,
    admin: 5,
    advisor: 5
}

// J-board's treasury team passes a 'treasurer' gate too: those gates are only
// on the books, and booksAccess has already narrowed what they can change
// there to grants and sponsorships (see treasury.js).
function requireRole(minRole) {
    return (req, res, next) => {
        if (!req.role) {
            return res.status(403).json({ message: 'Membership required' })
        }
        if (RANK[req.role] < RANK[minRole] && !(minRole === 'treasurer' && onTreasuryTeam(req))) {
            return res.status(403).json({ message: 'Insufficient permissions' })
        }
        next()
    }
}

// Where rank isn't enough: a role that outranks the floor but is turned away
// anyway (j-board and points, see memberRoutes.js).
export function denyRole(role) {
    return (req, res, next) => {
        if (req.role === role) {
            return res.status(403).json({ message: 'Insufficient permissions' })
        }
        next()
    }
}

// The same for the club's books (/analytics — transactions, grants, receipts,
// targets, dues): j-board outranks an officer but doesn't get them, and nor
// does the advisor, who reads everything else. The exception is j-board's
// treasury team, who read all of it and change only grants and sponsorships
// (see treasury.js).
export function booksAccess(req, res, next) {
    if (req.role === 'advisor') {
        return res.status(403).json({ message: 'Insufficient permissions' })
    }
    if (req.role !== 'jboard') { return next() }
    if (!onTreasuryTeam(req)) {
        return res.status(403).json({ message: 'Insufficient permissions' })
    }
    if (!treasuryMayDo(req.method, req.originalUrl)) {
        return res.status(403).json({ message: TREASURY_REFUSAL })
    }
    next()
}

export default requireRole
