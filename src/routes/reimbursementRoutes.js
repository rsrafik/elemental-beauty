import express from 'express'
import prisma from '../prismaClient.js'
import requireRole from '../middleware/requireRole.js'
import { notifyRequester, notifyTreasurer, quietly } from '../reimbursementEmails.js'

const router = express.Router()

const STATUSES = ['pending', 'approved', 'reimbursed', 'denied']

// Only the categories the expense summary actually has a slice for — a receipt
// is spending, so the income half of the enum is never a valid answer here.
const EXPENSE_CATEGORIES = ['lab', 'events', 'guests', 'marketing']

// Officer+: submit a request. Status is NOT read from the body — the DB
// defaults it to pending, and only the treasurer route below changes it.
//
// `title` is what the row is called everywhere it's listed; `explanation` is
// what it was bought for, and the form leaves it optional. `date` is the day of
// the purchase, not today: settling the request writes the expense against that
// day, so the spending lands in the month the club incurred it.
router.post('/', async (req, res) => {
    const { title, explanation, amountRequested, category, receipt, date } = req.body

    if (!title || amountRequested === undefined || !category) {
        return res.status(400).json({ message: 'title, amountRequested, and category are required' })
    }
    const amount = parseFloat(amountRequested)
    if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ message: 'amountRequested must be a positive number' })
    }
    if (!EXPENSE_CATEGORIES.includes(category)) {
        return res.status(400).json({ message: `category must be one of: ${EXPENSE_CATEGORIES.join(', ')}` })
    }
    let purchased
    if (date !== undefined && date !== null) {
        purchased = new Date(date)
        if (isNaN(purchased.getTime())) {
            return res.status(400).json({ message: 'date must be a valid date (YYYY-MM-DD)' })
        }
    }

    try {
        const reimbursement = await prisma.reimbursement.create({
            data: {
                memberId: req.userId,      // identity from the token, never the body
                title,
                explanation: explanation ?? '',
                amountRequested: amount,
                category,
                receipt,
                ...(purchased ? { date: purchased } : {})
            }
        })
        res.status(201).json(reimbursement)
        quietly(notifyTreasurer(reimbursement))
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Officer+: own history
router.get('/mine', async (req, res) => {
    try {
        const mine = await prisma.reimbursement.findMany({
            where: { memberId: req.userId },
            orderBy: { date: 'desc' }
        })
        res.json(mine)
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Officer+: fix a request that came back and send it again. Only your own, and
// only one that was denied — anything else is either still being looked at or
// already settled. The objection it's answering is kept as previousDenial, so
// the treasurer can see this is a second attempt and at what.
router.put('/:id', async (req, res) => {
    const reimbursementId = parseInt(req.params.id)
    if (isNaN(reimbursementId)) { return res.status(400).json({ message: 'Invalid reimbursement id' }) }

    const data = {}
    if (req.body.title !== undefined) {
        if (!req.body.title) { return res.status(400).json({ message: 'title cannot be empty' }) }
        data.title = req.body.title
    }
    if (req.body.explanation !== undefined) { data.explanation = req.body.explanation }
    if (req.body.receipt !== undefined) { data.receipt = req.body.receipt }
    if (req.body.category !== undefined) {
        if (!EXPENSE_CATEGORIES.includes(req.body.category)) {
            return res.status(400).json({ message: `category must be one of: ${EXPENSE_CATEGORIES.join(', ')}` })
        }
        data.category = req.body.category
    }
    if (req.body.amountRequested !== undefined) {
        const amount = parseFloat(req.body.amountRequested)
        if (isNaN(amount) || amount <= 0) {
            return res.status(400).json({ message: 'amountRequested must be a positive number' })
        }
        data.amountRequested = amount
    }
    if (req.body.date !== undefined) {
        const purchased = new Date(req.body.date)
        if (isNaN(purchased.getTime())) {
            return res.status(400).json({ message: 'date must be a valid date (YYYY-MM-DD)' })
        }
        data.date = purchased
    }

    try {
        const existing = await prisma.reimbursement.findUnique({ where: { reimbursementId } })
        if (!existing) { return res.status(404).json({ message: 'Reimbursement not found' }) }
        if (existing.memberId !== req.userId) {
            return res.status(403).json({ message: 'That is not your request' })
        }
        if (existing.status !== 'denied') {
            return res.status(409).json({ message: `Only a denied request can be resent — this one is ${existing.status}` })
        }

        const updated = await prisma.reimbursement.update({
            where: { reimbursementId },
            data: {
                ...data,
                status: 'pending',
                previousDenial: existing.denialExplanation ?? existing.previousDenial,
                denialExplanation: null
            }
        })
        res.json(updated)
        quietly(notifyTreasurer(updated, { resent: true }))
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Officer+: take your own request back. A receipt that was never settled isn't
// a record of anything — nobody was paid and nothing was refused — so it comes
// off the books entirely rather than being marked withdrawn. Once the money has
// actually been handed over there is nothing left to withdraw, which is why a
// reimbursed one is refused: the ledger row behind it would be orphaned.
router.delete('/:id', async (req, res) => {
    const reimbursementId = parseInt(req.params.id)
    if (isNaN(reimbursementId)) { return res.status(400).json({ message: 'Invalid reimbursement id' }) }

    try {
        const existing = await prisma.reimbursement.findUnique({ where: { reimbursementId } })
        if (!existing) { return res.status(404).json({ message: 'Reimbursement not found' }) }
        if (existing.memberId !== req.userId) {
            return res.status(403).json({ message: 'That is not your request' })
        }
        if (existing.status === 'reimbursed') {
            return res.status(409).json({ message: 'Already reimbursed — there is nothing left to revoke' })
        }

        await prisma.reimbursement.delete({ where: { reimbursementId } })
        res.json({ message: 'Request revoked' })
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Treasurer+: all requests, ?status=pending for the review queue
router.get('/', requireRole('treasurer'), async (req, res) => {
    const { status } = req.query

    const where = {}
    if (status !== undefined) {
        if (!STATUSES.includes(status)) {
            return res.status(400).json({ message: `status must be one of: ${STATUSES.join(', ')}` })
        }
        where.status = status
    }

    try {
        const requests = await prisma.reimbursement.findMany({
            where,
            include: {
                member: {
                    include: {
                        user: { select: { username: true, firstName: true, lastName: true } }
                    }
                }
            },
            orderBy: { date: 'desc' }
        })
        res.json(requests)
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Treasurer+: move a request along. Which moves are legal is the whole rule:
//
//   pending   -> approved   the club agrees it owes the money
//             -> denied     with a reason, which is what the officer answers
//   approved  -> reimbursed the money has actually been handed over, and THIS
//                           is what writes the expense row — inside Postgres,
//                           by trigger. There is deliberately no ledger code
//                           here.
//             -> denied     an approval can still be taken back
//   reimbursed/denied       settled; nothing further
//
// Approving clears any earlier objection off the row: it's been answered, and
// leaving it there would keep flagging a settled argument.
const NEXT = {
    pending: ['approved', 'denied'],
    approved: ['reimbursed', 'denied'],
    reimbursed: [],
    denied: []
}

router.put('/:id/status', requireRole('treasurer'), async (req, res) => {
    const reimbursementId = parseInt(req.params.id)
    if (isNaN(reimbursementId)) { return res.status(400).json({ message: 'Invalid reimbursement id' }) }

    const { status, denialExplanation } = req.body
    if (!['approved', 'reimbursed', 'denied'].includes(status)) {
        return res.status(400).json({ message: 'status must be approved, reimbursed, or denied' })
    }
    if (status === 'denied' && !denialExplanation) {
        return res.status(400).json({ message: 'denialExplanation is required when denying' })
    }

    try {
        const existing = await prisma.reimbursement.findUnique({ where: { reimbursementId } })
        if (!existing) { return res.status(404).json({ message: 'Reimbursement not found' }) }
        if (!NEXT[existing.status].includes(status)) {
            return res.status(409).json({
                message: `A ${existing.status} request cannot be marked ${status}`
            })
        }

        const updated = await prisma.reimbursement.update({
            where: { reimbursementId },
            data: {
                status,
                denialExplanation: status === 'denied' ? denialExplanation : null
            }
        })
        res.json(updated)
        quietly(notifyRequester(updated))
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

export default router
