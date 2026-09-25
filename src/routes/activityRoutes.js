import express from 'express'
import prisma from '../prismaClient.js'
import { ACTIONS } from '../activity.js'

const router = express.Router()

// Dues are the treasurer's books, which j-board doesn't get (see denyRole in
// server.js) — so their lines are left out of the log j-board reads.
const BOOKS = ['dues_paid', 'dues_cleared']

// The activity log, newest first — /students' "activity" popup.
//
//   ?limit=50       how many (at most 200)
//   ?before=<id>    the page after the last one you have
//   ?action=...     only one kind of line
//   ?targetId=<id>  only lines about one person
router.get('/', async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200)
    const before = req.query.before === undefined ? undefined : parseInt(req.query.before)
    if (before !== undefined && isNaN(before)) { return res.status(400).json({ message: 'before must be an id' }) }
    const { action } = req.query
    if (action !== undefined && !ACTIONS.includes(action)) {
        return res.status(400).json({ message: `action must be one of: ${ACTIONS.join(', ')}` })
    }
    const targetId = req.query.targetId === undefined ? undefined : parseInt(req.query.targetId)
    if (targetId !== undefined && isNaN(targetId)) { return res.status(400).json({ message: 'targetId must be an id' }) }

    const where = {}
    if (before !== undefined) { where.activityId = { lt: before } }
    if (targetId !== undefined) { where.targetId = targetId }
    if (action !== undefined) { where.action = action }
    if (req.role === 'jboard') {
        where.action = action !== undefined && BOOKS.includes(action) ? '__none__' : (action ?? { notIn: BOOKS })
    }

    try {
        const rows = await prisma.activityLog.findMany({
            where,
            orderBy: { activityId: 'desc' },
            take: limit + 1
        })
        res.json({
            entries: rows.slice(0, limit),
            // whether there's another page to ask for with ?before=
            more: rows.length > limit
        })
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

export default router
