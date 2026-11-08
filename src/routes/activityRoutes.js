import express from 'express'
import prisma from '../prismaClient.js'
import { ACTIONS } from '../activity.js'
import { onTreasuryTeam } from '../middleware/treasury.js'

const router = express.Router()

// Dues are the treasurer's books, which j-board doesn't get (see booksAccess in
// server.js) — so their lines are left out of the log j-board reads. The
// treasury team reads the dues, so they get the lines too.
const BOOKS = ['dues_paid', 'dues_cleared', 'dues_waived', 'fee_paid', 'dues_reset']

// The popup's search box. Every word has to match somewhere on the line, so
// "instagram repost" finds the reposts and "maya lab" Maya's lab lines. A word
// matches
//   a person         who did it or who it was about
//   a title          the lab or event it happened at
//   a reason         what points were given for (instagram_repost,
//                    instagram_follow, discord_join, manual) or why a payment
//                    was sent back
//   what happened    the action (checked_in, dues_paid, role_changed, …)
//   lab / event      every line at a lab, or every line at an event
// Spaces and hyphens in a word stand for the underscores in the stored names,
// so "check-in" or "discord join" still find them.
function searchWhere(q) {
    return q.toLowerCase().split(/\s+/).filter(Boolean).map((word) => {
        const stored = word.replace(/-/g, '_')
        const kind = word.replace(/s$/, '')
        return {
            OR: [
                { actorName: { contains: word, mode: 'insensitive' } },
                { targetName: { contains: word, mode: 'insensitive' } },
                { details: { path: ['title'], string_contains: word, mode: 'insensitive' } },
                { details: { path: ['reason'], string_contains: stored, mode: 'insensitive' } },
                { action: { contains: stored, mode: 'insensitive' } },
                ...(['lab', 'event'].includes(kind) ? [{ details: { path: ['kind'], equals: kind } }] : [])
            ]
        }
    })
}

// The activity log, newest first — /students' "activity" popup.
//
//   ?limit=50       how many (at most 200)
//   ?before=<id>    the page after the last one you have
//   ?action=...     only one kind of line
//   ?targetId=<id>  only lines about one person
//   ?q=...          search (see searchWhere)
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
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : ''
    if (q) { where.AND = searchWhere(q) }
    if (req.role === 'jboard' && !onTreasuryTeam(req)) {
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
