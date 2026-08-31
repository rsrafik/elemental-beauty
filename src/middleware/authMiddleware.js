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
        // The account is looked up, not just the membership, and the difference
        // matters: a token can outlive the row it names — the account was
        // deleted, or the database was reseeded underneath it. Reading only the
        // members table can't tell that apart from "signed in, hasn't joined
        // yet", so a token for a user who no longer exists used to sail through
        // here and get refused further down as 403 'Membership required'. A 403
        // says "you're signed in but not allowed", so the client kept the dead
        // token and every page stayed broken until storage was cleared by hand.
        //
        // 401 is the honest answer, and it's the one the client acts on: it
        // clears the token and sends them to /login.
        //
        // Role is looked up fresh on every request — promotions apply instantly,
        // and a user with no members row gets role = null (blocked by requireRole)
        const user = await prisma.user.findUnique({
            where: { userId: decoded.id },
            select: { userId: true, member: { select: { role: true } } }
        })
        if (!user) { return res.status(401).json({ message: 'Invalid token' }) }

        req.userId = user.userId
        req.role = user.member?.role ?? null
        next()
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
}

export default authMiddleware
