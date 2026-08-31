import express from 'express'
import prisma from '../prismaClient.js'
import requireRole from '../middleware/requireRole.js'

const router = express.Router()
// mounted behind authMiddleware + requireRole('officer') in server.js —
// every officer reads the targets off the summary cards, only the treasurer
// sets them

// '2025–26'. The dash is an en dash (U+2013), not a hyphen — it's what the
// school year is written with everywhere on the analytics pages, and a hyphen
// here would quietly create a second row for the same year.
const SCHOOL_YEAR = /^\d{4}–\d{2}$/

function parseAmount(value, field) {
    const amount = parseFloat(value)
    if (isNaN(amount) || amount < 0) {
        return { error: `${field} must be a number of zero or more` }
    }
    return { amount }
}

router.get('/', async (req, res) => {
    try {
        const targets = await prisma.yearTarget.findMany({ orderBy: { schoolYear: 'desc' } })
        res.json(targets)
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

router.get('/:schoolYear', async (req, res) => {
    const { schoolYear } = req.params
    if (!SCHOOL_YEAR.test(schoolYear)) {
        return res.status(400).json({ message: 'schoolYear must look like 2025–26' })
    }

    try {
        const target = await prisma.yearTarget.findUnique({ where: { schoolYear } })
        if (!target) { return res.status(404).json({ message: 'No targets set for that year' }) }
        res.json(target)
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Upsert rather than create-then-update: the summary cards edit a figure in
// place and don't know or care whether the year has a row yet. Either target
// can be sent on its own — editing the income goal must not blank the budget —
// so a year being written for the first time falls back to zero for whichever
// half wasn't sent.
router.put('/:schoolYear', requireRole('treasurer'), async (req, res) => {
    const { schoolYear } = req.params
    if (!SCHOOL_YEAR.test(schoolYear)) {
        return res.status(400).json({ message: 'schoolYear must look like 2025–26' })
    }

    const { incomeGoal, expenseBudget } = req.body
    if (incomeGoal === undefined && expenseBudget === undefined) {
        return res.status(400).json({ message: 'incomeGoal or expenseBudget is required' })
    }

    const update = {}
    if (incomeGoal !== undefined) {
        const { amount, error } = parseAmount(incomeGoal, 'incomeGoal')
        if (error) { return res.status(400).json({ message: error }) }
        update.incomeGoal = amount
    }
    if (expenseBudget !== undefined) {
        const { amount, error } = parseAmount(expenseBudget, 'expenseBudget')
        if (error) { return res.status(400).json({ message: error }) }
        update.expenseBudget = amount
    }

    try {
        const target = await prisma.yearTarget.upsert({
            where: { schoolYear },
            update,
            create: {
                schoolYear,
                incomeGoal: update.incomeGoal ?? 0,
                expenseBudget: update.expenseBudget ?? 0
            }
        })
        res.json(target)
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

router.delete('/:schoolYear', requireRole('treasurer'), async (req, res) => {
    const { schoolYear } = req.params

    try {
        await prisma.yearTarget.delete({ where: { schoolYear } })
        res.json({ message: 'Targets cleared' })
    } catch (err) {
        if (err.code === 'P2025') { return res.status(404).json({ message: 'No targets set for that year' }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

export default router
