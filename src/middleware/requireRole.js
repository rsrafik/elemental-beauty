// j-board sits just above officer: everything an officer can do, but not the
// treasurer's books
const RANK = {
    member: 1,
    officer: 2,
    jboard: 3,
    treasurer: 4,
    admin: 5
}

function requireRole(minRole) {
    return (req, res, next) => {
        if (!req.role) {
            return res.status(403).json({ message: 'Membership required' })
        }
        if (RANK[req.role] < RANK[minRole]) {
            return res.status(403).json({ message: 'Insufficient permissions' })
        }
        next()
    }
}

// The one place rank isn't enough: j-board outranks an officer but doesn't get
// the club's books (/analytics — transactions, grants, receipts, targets).
export function denyRole(role) {
    return (req, res, next) => {
        if (req.role === role) {
            return res.status(403).json({ message: 'Insufficient permissions' })
        }
        next()
    }
}

export default requireRole