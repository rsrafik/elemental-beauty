import express from 'express'
import prisma from '../prismaClient.js'
import requireRole from '../middleware/requireRole.js'

const router = express.Router()

// Officer+: submit a request. Status is NOT read from the body — the DB
// defaults it to pending, and only the treasurer route below changes it.
router.post('/', async (req, res) => {
    const { explanation, amountRequested, category, receipt } = req.body

    if (!explanation || amountRequested === undefined || !category) {
        return res.status(400).json({ message: 'explanation, amountRequested, and category are required' })
    }
    const amount = parseFloat(amountRequested)
    if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ message: 'amountRequested must be a positive number' })
    }

    try {
        const reimbursement = await prisma.reimbursement.create({
            data: {
                memberId: req.userId,      // identity from the token, never the body
                explanation,
                amountRequested: amount,
                category,
                receipt
            }
        })
        res.status(201).json(reimbursement)
    } catch (err) {
        if (err.name === 'PrismaClientValidationError') {
            return res.status(400).json({ message: 'Invalid category' })
        }
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

// Treasurer+: all requests, ?status=pending for the review queue
router.get('/', requireRole('treasurer'), async (req, res) => {
    const { status } = req.query

    const where = {}
    if (status !== undefined) {
        if (!['pending', 'approved', 'denied'].includes(status)) {
            return res.status(400).json({ message: 'status must be pending, approved, or denied' })
        }
        where.status = status
    }

    try {
        const requests = await prisma.reimbursement.findMany({
            where,
            include: { member: { include: { user: { select: { username: true } } } } },
            orderBy: { date: 'desc' }
        })
        res.json(requests)
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Treasurer+: approve or deny. Only pending requests can transition — once
// decided, a request is final (the approved→transaction ledger entry is
// created inside Postgres by the trigger; there is deliberately no ledger
// code here).
router.put('/:id/status', requireRole('treasurer'), async (req, res) => {
    const reimbursementId = parseInt(req.params.id)
    if (isNaN(reimbursementId)) { return res.status(400).json({ message: 'Invalid reimbursement id' }) }

    const { status, denialExplanation } = req.body
    if (!['approved', 'denied'].includes(status)) {
        return res.status(400).json({ message: 'status must be approved or denied' })
    }
    if (status === 'denied' && !denialExplanation) {
        return res.status(400).json({ message: 'denialExplanation is required when denying' })
    }

    try {
        const existing = await prisma.reimbursement.findUnique({ where: { reimbursementId } })
        if (!existing) { return res.status(404).json({ message: 'Reimbursement not found' }) }
        if (existing.status !== 'pending') {
            return res.status(409).json({ message: `Request was already ${existing.status}` })
        }

        const updated = await prisma.reimbursement.update({
            where: { reimbursementId },
            data: {
                status,
                denialExplanation: status === 'denied' ? denialExplanation : null
            }
        })
        res.json(updated)
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

export default router
