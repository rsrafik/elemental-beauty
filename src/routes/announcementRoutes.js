import express from 'express'
import prisma from '../prismaClient.js'
import requireRole from '../middleware/requireRole.js'

const router = express.Router()
// mounted behind authMiddleware + requireRole('member') in server.js —
// reading them is every member's business, writing them is officers'

// What the author's name comes back as. The dashboard prints who said it, and
// an account deleted since leaves the announcement standing with nobody on it.
const WITH_AUTHOR = {
    author: { select: { username: true, firstName: true, lastName: true } }
}

// Newest first — the member dashboard shows the top one and nothing else, so
// the order is the whole answer to "which announcement is the announcement".
// ?limit=1 is what that banner asks for.
router.get('/', async (req, res) => {
    const limit = req.query.limit === undefined ? undefined : parseInt(req.query.limit)
    if (limit !== undefined && (isNaN(limit) || limit < 1)) {
        return res.status(400).json({ message: 'limit must be a positive integer' })
    }

    try {
        const announcements = await prisma.announcement.findMany({
            include: WITH_AUTHOR,
            orderBy: { createdAt: 'desc' },
            ...(limit ? { take: limit } : {})
        })
        res.json(announcements)
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// The POST button on the officer dashboard. The author is taken from the token
// and never from the body — otherwise anyone could sign an announcement with
// somebody else's name.
router.post('/', requireRole('officer'), async (req, res) => {
    const body = typeof req.body.body === 'string' ? req.body.body.trim() : ''
    if (!body) { return res.status(400).json({ message: 'body is required' }) }

    try {
        const announcement = await prisma.announcement.create({
            data: { body, authorId: req.userId },
            include: WITH_AUTHOR
        })
        res.status(201).json(announcement)
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

router.put('/:id', requireRole('officer'), async (req, res) => {
    const announcementId = parseInt(req.params.id)
    if (isNaN(announcementId)) { return res.status(400).json({ message: 'Invalid announcement id' }) }

    const body = typeof req.body.body === 'string' ? req.body.body.trim() : ''
    if (!body) { return res.status(400).json({ message: 'body is required' }) }

    try {
        const announcement = await prisma.announcement.update({
            where: { announcementId },
            data: { body },
            include: WITH_AUTHOR
        })
        res.json(announcement)
    } catch (err) {
        if (err.code === 'P2025') { return res.status(404).json({ message: 'Announcement not found' }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

router.delete('/:id', requireRole('officer'), async (req, res) => {
    const announcementId = parseInt(req.params.id)
    if (isNaN(announcementId)) { return res.status(400).json({ message: 'Invalid announcement id' }) }

    try {
        await prisma.announcement.delete({ where: { announcementId } })
        res.json({ message: 'Announcement deleted' })
    } catch (err) {
        if (err.code === 'P2025') { return res.status(404).json({ message: 'Announcement not found' }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

export default router
