const RANK = {
    member: 1,
    officer: 2,
    treasurer: 3,
    admin: 4
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

export default requireRole