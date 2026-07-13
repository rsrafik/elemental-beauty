import jwt from 'jsonwebtoken'
import prisma from '../prismaClient.js'

async function authMiddleware(req, res, next) {
    const header = req.headers['authorization']
    if (!header) { return res.status(401).json({ message: 'No token provided' }) }

    // Accept "Bearer <token>" (the standard) or a bare token
    const token = header.startsWith('Bearer ') ? header.slice(7) : header

    let decoded
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET)
    } catch {
        return res.status(401).json({ message: 'Invalid token' })
    }

    try {
        // Role is looked up fresh on every request — promotions apply instantly,
        // and users with no members row get role = null (blocked by requireRole)
        const member = await prisma.member.findUnique({
            where: { userId: decoded.id }
        })

        req.userId = decoded.id
        req.role = member?.role ?? null
        next()
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
}

export default authMiddleware
