import express from 'express'
import prisma from '../prismaClient.js'
import requireRole from '../middleware/requireRole.js'
import { schoolYearOf } from '../dues.js'
import { clubToday, dateColumn } from '../clubTime.js'

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

// What's in a school year, as the reasons it can't be taken off the picker —
// [] when there's nothing, which is the only time it can be. "Anything" is
// meant literally: money in or out, a grant due or awarded in it, a dues
// payment, a receipt dated in it, or a figure set on it — and never the year
// we're in.
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
async function contentsOf(schoolYear, target) {
    const start = Number(schoolYear.slice(0, 4))
    const range = { gte: dateColumn(`${start}-08-01`), lte: dateColumn(`${start + 1}-07-31`) }
    const [entries, grants, dues, receipts] = await Promise.all([
        prisma.transaction.count({ where: { date: range } }),
        prisma.grant.count({
            where: {
                OR: [
                    { status: 'awarded', dateGranted: range },
                    { status: 'awarded', dateGranted: null, deadline: range },
                    { status: { not: 'awarded' }, deadline: range }
                ]
            }
        }),
        prisma.duesPayment.count({ where: { schoolYear } }),
        prisma.reimbursement.count({ where: { date: range } })
    ])
    const figures = target && [target.incomeGoal, target.expenseBudget, target.duesAmount, target.nonmemberPrice]
        .some((value) => Number(value) > 0)

    const reasons = []
    if (schoolYear === schoolYearOf(clubToday())) { reasons.push('it’s this year') }
    if (entries) { reasons.push(plural(entries, 'ledger entry', 'ledger entries')) }
    if (grants) { reasons.push(plural(grants, 'grant')) }
    if (dues) { reasons.push(plural(dues, 'dues payment')) }
    if (receipts) { reasons.push(plural(receipts, 'receipt')) }
    if (figures) { reasons.push('its goal, budget or dues are set') }
    return reasons
}

// Each row carries `contents`: why it can't be deleted, [] when it can.
router.get('/', async (req, res) => {
    try {
        const targets = await prisma.yearTarget.findMany({ orderBy: { schoolYear: 'desc' } })
        const withContents = await Promise.all(targets.map(async (target) => ({
            ...target,
            contents: await contentsOf(target.schoolYear, target)
        })))
        res.json(withContents)
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

    const { incomeGoal, expenseBudget, duesAmount, nonmemberPrice } = req.body ?? {}
    if ([incomeGoal, expenseBudget, duesAmount, nonmemberPrice].every((value) => value === undefined)) {
        return res.status(400).json({ message: 'incomeGoal, expenseBudget, duesAmount or nonmemberPrice is required' })
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

    // what a member owes that year — the dues card's default amount
    if (duesAmount !== undefined) {
        const { amount, error } = parseAmount(duesAmount, 'duesAmount')
        if (error) { return res.status(400).json({ message: error }) }
        update.duesAmount = amount
    }

    // what someone who hasn't paid that year's dues is charged for a lab or
    // a members-only event (see src/dues.js)
    if (nonmemberPrice !== undefined) {
        const { amount, error } = parseAmount(nonmemberPrice, 'nonmemberPrice')
        if (error) { return res.status(400).json({ message: error }) }
        update.nonmemberPrice = amount
    }

    try {
        const target = await prisma.yearTarget.upsert({
            where: { schoolYear },
            update,
            create: {
                schoolYear,
                incomeGoal: update.incomeGoal ?? 0,
                expenseBudget: update.expenseBudget ?? 0,
                duesAmount: update.duesAmount ?? 0,
                nonmemberPrice: update.nonmemberPrice ?? 0
            }
        })
        res.json(target)
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Take a year off the analytics year picker — only an empty one (see
// contentsOf). One with anything in it is refused, with what's in it.
router.delete('/:schoolYear', requireRole('treasurer'), async (req, res) => {
    const { schoolYear } = req.params
    if (!SCHOOL_YEAR.test(schoolYear)) {
        return res.status(400).json({ message: 'schoolYear must look like 2025–26' })
    }

    try {
        const target = await prisma.yearTarget.findUnique({ where: { schoolYear } })
        if (!target) { return res.status(404).json({ message: 'No targets set for that year' }) }
        const contents = await contentsOf(schoolYear, target)
        if (contents.length) {
            return res.status(409).json({ message: `${schoolYear} isn’t empty: ${contents.join(', ')}`, contents })
        }
        await prisma.yearTarget.delete({ where: { schoolYear } })
        res.json({ message: 'Targets cleared' })
    } catch (err) {
        if (err.code === 'P2025') { return res.status(404).json({ message: 'No targets set for that year' }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

export default router
