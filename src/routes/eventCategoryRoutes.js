import express from 'express'
import prisma from '../prismaClient.js'
import requireRole from '../middleware/requireRole.js'

const router = express.Router()
// mounted behind authMiddleware + requireRole('member') in server.js

// The calendar's tag list — GBM, Workshop, Social and the rest. Every member's
// calendar draws the legend off it; only officers edit it.
//
// 'Lab' is deliberately not one of these and can't be added as one: labs carry
// sign-ups, a quiz and check-in, so they're their own table and the calendar
// draws them from there. A tag by that name would produce two kinds of "Lab"
// on one grid with different behaviour behind them.
const RESERVED = ['lab']

router.get('/', async (req, res) => {
    try {
        const categories = await prisma.eventCategory.findMany({ orderBy: { categoryId: 'asc' } })
        res.json(categories)
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

router.post('/', requireRole('officer'), async (req, res) => {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : ''
    if (!name) { return res.status(400).json({ message: 'name is required' }) }
    if (RESERVED.includes(name.toLowerCase())) {
        return res.status(400).json({ message: 'Labs are scheduled from /labs, not as a calendar tag' })
    }

    try {
        const category = await prisma.eventCategory.create({ data: { name } })
        res.status(201).json(category)
    } catch (err) {
        if (err.code === 'P2002') { return res.status(409).json({ message: 'That tag already exists' }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

router.put('/:id', requireRole('officer'), async (req, res) => {
    const categoryId = parseInt(req.params.id)
    if (isNaN(categoryId)) { return res.status(400).json({ message: 'Invalid category id' }) }

    const name = typeof req.body.name === 'string' ? req.body.name.trim() : ''
    if (!name) { return res.status(400).json({ message: 'name is required' }) }
    if (RESERVED.includes(name.toLowerCase())) {
        return res.status(400).json({ message: 'Labs are scheduled from /labs, not as a calendar tag' })
    }

    try {
        const category = await prisma.eventCategory.update({
            where: { categoryId },
            data: { name }
        })
        res.json(category)
    } catch (err) {
        if (err.code === 'P2025') { return res.status(404).json({ message: 'Tag not found' }) }
        if (err.code === 'P2002') { return res.status(409).json({ message: 'That tag already exists' }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Taking a tag off the legend leaves the events that used it standing — the
// column is ON DELETE SET NULL, so they just stop being filed under anything
// rather than disappearing along with the label. The count comes back so the
// page can say how many it just untagged.
router.delete('/:id', requireRole('officer'), async (req, res) => {
    const categoryId = parseInt(req.params.id)
    if (isNaN(categoryId)) { return res.status(400).json({ message: 'Invalid category id' }) }

    try {
        const untagged = await prisma.event.count({ where: { categoryId } })
        await prisma.eventCategory.delete({ where: { categoryId } })
        res.json({ message: 'Tag removed', untagged })
    } catch (err) {
        if (err.code === 'P2025') { return res.status(404).json({ message: 'Tag not found' }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

export default router
