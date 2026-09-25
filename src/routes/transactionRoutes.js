import express from 'express'
import prisma from '../prismaClient.js'
import requireRole from '../middleware/requireRole.js'
import { csvCell } from '../csv.js'
import { log } from '../activity.js'

const router = express.Router()
// mounted behind requireRole('officer') — officers get the read/analytics
// tier; every write below raises the floor to treasurer

// helper: build a where clause from ?type=&category=&from=&to=
function buildLedgerWhere(query) {
    const { type, category, from, to } = query
    const where = {}
    if (type !== undefined) {
        if (!['income', 'expense'].includes(type)) { return { error: 'type must be income or expense' } }
        where.type = type
    }
    if (category !== undefined) { where.category = category }
    if (from !== undefined || to !== undefined) {
        where.date = {}
        if (from !== undefined) {
            const d = new Date(from)
            if (isNaN(d.getTime())) { return { error: 'from must be a valid date (YYYY-MM-DD)' } }
            where.date.gte = d
        }
        if (to !== undefined) {
            const d = new Date(to)
            if (isNaN(d.getTime())) { return { error: 'to must be a valid date (YYYY-MM-DD)' } }
            where.date.lte = d
        }
    }
    return { where }
}

// Officer+: ledger view
router.get('/', async (req, res) => {
    const { where, error } = buildLedgerWhere(req.query)
    if (error) { return res.status(400).json({ message: error }) }

    try {
        const transactions = await prisma.transaction.findMany({
            where,
            // A row that came from settling a receipt says who it was paid back
            // to — the ledger prints "reimbursed to Ada White · #12", and
            // deleting one of those is really unpicking somebody's payout, so
            // the name has to be on the row rather than looked up per click.
            include: {
                reimbursement: {
                    select: {
                        reimbursementId: true,
                        member: { select: { user: { select: { firstName: true, lastName: true } } } }
                    }
                }
            },
            orderBy: { date: 'desc' }
        })
        res.json(transactions)
    } catch (err) {
        if (err.name === 'PrismaClientValidationError') {
            return res.status(400).json({ message: 'Invalid category' })
        }
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Officer+: analytics — income vs expense totals and per-category breakdown
router.get('/summary', async (req, res) => {
    try {
        const byType = await prisma.transaction.groupBy({
            by: ['type'],
            _sum: { amount: true }
        })
        const byCategory = await prisma.transaction.groupBy({
            by: ['type', 'category'],
            _sum: { amount: true }
        })

        const income = Number(byType.find(t => t.type === 'income')?._sum.amount ?? 0)
        const expenses = Number(byType.find(t => t.type === 'expense')?._sum.amount ?? 0)

        res.json({
            income,
            expenses,
            balance: income - expenses,
            byCategory: byCategory.map(c => ({
                type: c.type,
                category: c.category,
                total: Number(c._sum.amount ?? 0)
            }))
        })
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Officer+: CSV download of the ledger (same filters as GET /)
router.get('/export', async (req, res) => {
    const { where, error } = buildLedgerWhere(req.query)
    if (error) { return res.status(400).json({ message: error }) }

    try {
        const transactions = await prisma.transaction.findMany({
            where,
            orderBy: { date: 'asc' }
        })

        // quote a field if it contains commas, quotes, or newlines
        const esc = csvCell

        const header = 'transaction_id,date,type,category,source,amount,grant_id,reimbursement_id'
        const rows = transactions.map(t => [
            t.transactionId,
            t.date.toISOString().slice(0, 10),
            t.type,
            t.category,
            esc(t.source),
            t.amount,
            t.grantId ?? '',
            t.reimbursementId ?? ''
        ].join(','))

        res.type('text/csv')
        const range = [req.query.from, req.query.to].filter(Boolean).join('-to-')
        res.set('Content-Disposition', `attachment; filename="ledger${range ? `-${range}` : ''}.csv"`)
        res.send([header, ...rows].join('\n'))
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Treasurer+: manual ledger entry; optional grantId links spending to a grant
router.post('/', requireRole('treasurer'), async (req, res) => {
    const { type, source, amount, category, date, grantId } = req.body

    if (!['income', 'expense'].includes(type)) {
        return res.status(400).json({ message: 'type must be income or expense' })
    }
    if (!source || amount === undefined || !category) {
        return res.status(400).json({ message: 'source, amount, and category are required' })
    }
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ message: 'amount must be a positive number' })
    }

    const data = { type, source, amount: parsedAmount, category }
    if (date !== undefined) {
        const d = new Date(date)
        if (isNaN(d.getTime())) { return res.status(400).json({ message: 'date must be a valid date (YYYY-MM-DD)' }) }
        data.date = d
    }
    if (grantId !== undefined && grantId !== null) {
        const gid = parseInt(grantId)
        if (isNaN(gid)) { return res.status(400).json({ message: 'grantId must be an integer' }) }
        data.grantId = gid
    }

    try {
        const transaction = await prisma.transaction.create({ data })
        res.status(201).json(transaction)
    } catch (err) {
        if (err.code === 'P2003') { return res.status(404).json({ message: 'Grant not found' }) }
        if (err.name === 'PrismaClientValidationError') {
            return res.status(400).json({ message: 'Invalid category' })
        }
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Treasurer+: correct an entry
router.put('/:id', requireRole('treasurer'), async (req, res) => {
    const transactionId = parseInt(req.params.id)
    if (isNaN(transactionId)) { return res.status(400).json({ message: 'Invalid transaction id' }) }

    const data = {}
    if (req.body.type !== undefined) {
        if (!['income', 'expense'].includes(req.body.type)) {
            return res.status(400).json({ message: 'type must be income or expense' })
        }
        data.type = req.body.type
    }
    if (req.body.source !== undefined) { data.source = req.body.source }
    if (req.body.category !== undefined) { data.category = req.body.category }
    if (req.body.amount !== undefined) {
        const parsedAmount = parseFloat(req.body.amount)
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ message: 'amount must be a positive number' })
        }
        data.amount = parsedAmount
    }
    if (req.body.date !== undefined) {
        const d = new Date(req.body.date)
        if (isNaN(d.getTime())) { return res.status(400).json({ message: 'date must be a valid date (YYYY-MM-DD)' }) }
        data.date = d
    }
    if (req.body.grantId !== undefined) {
        if (req.body.grantId === null) {
            data.grantId = null
        } else {
            const gid = parseInt(req.body.grantId)
            if (isNaN(gid)) { return res.status(400).json({ message: 'grantId must be an integer' }) }
            data.grantId = gid
        }
    }

    try {
        const transaction = await prisma.transaction.update({ where: { transactionId }, data })
        res.json(transaction)
    } catch (err) {
        if (err.code === 'P2025') { return res.status(404).json({ message: 'Transaction not found' }) }
        if (err.code === 'P2003') { return res.status(404).json({ message: 'Grant not found' }) }
        if (err.name === 'PrismaClientValidationError') {
            return res.status(400).json({ message: 'Invalid category' })
        }
        console.error(err.message)
        res.sendStatus(500)
    }
})

// deliberately NO router.delete — financial rows are never hard-deleted.
// A correction is a new offsetting entry, not an erasure.

// Treasurer: take a row out of the ledger.
//
// Two kinds of row are the other end of something, and deleting one undoes
// that too, in the same transaction, so the books never disagree with
// themselves:
//
//   a paid receipt   the request goes back to 'approved' — the club still
//                    owes it, it just hasn't been handed over. Marking it
//                    reimbursed again writes a fresh row (the trigger fires on
//                    the move into 'reimbursed').
//   a dues payment   the payment goes with it (the foreign key cascades), so
//                    that member reads as unpaid for the year again
router.delete('/:id', requireRole('treasurer'), async (req, res) => {
    const transactionId = parseInt(req.params.id)
    if (isNaN(transactionId)) { return res.status(400).json({ message: 'Invalid transaction id' }) }

    try {
        const existing = await prisma.transaction.findUnique({
            where: { transactionId },
            include: { dues: true }
        })
        if (!existing) { return res.status(404).json({ message: 'Transaction not found' }) }

        await prisma.$transaction(async (tx) => {
            await tx.transaction.delete({ where: { transactionId } })
            if (existing.reimbursementId != null) {
                await tx.reimbursement.update({
                    where: { reimbursementId: existing.reimbursementId },
                    data: { status: 'approved' }
                })
            }
            if (existing.dues) {
                await log({
                    actorId: req.userId, action: 'dues_cleared', targetId: existing.dues.memberId,
                    details: { schoolYear: existing.dues.schoolYear, amount: Number(existing.dues.amount) }
                }, tx)
            }
        })
        res.json({
            message: 'Transaction deleted',
            // the page re-reads the receipts when this is set
            reopenedRequest: existing.reimbursementId ?? null
        })
    } catch (err) {
        if (err.code === 'P2025') { return res.status(404).json({ message: 'Transaction not found' }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

export default router
