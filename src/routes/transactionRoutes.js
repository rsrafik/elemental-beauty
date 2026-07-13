import express from 'express'
import prisma from '../prismaClient.js'
import requireRole from '../middleware/requireRole.js'

const router = express.Router()

router.get('/', async (req, res) => {
    // officer+ ledger view: ?type=&category=&from=&to= filters on findMany
})

router.get('/summary', async (req, res) => {
    // the "analytics" endpoint. groupBy is the tool:
    // prisma.transaction.groupBy({ by: ['type'], _sum: { amount: true } })
    // and/or by: ['category'] — income vs expense totals, breakdown per category.
    // Decimal sums: convert with Number(...) before res.json
})

router.get('/export', async (req, res) => {
    // same findMany → build CSV string (header row + map/join) →
    // res.type('text/csv')
    // res.set('Content-Disposition', 'attachment; filename="ledger.csv"')
    // res.send(csv)
})

router.post('/', requireRole('treasurer'), async (req, res) => {
    // manual ledger entry (income or expense); optional grantId links spending to a grant
})

router.put('/:id', requireRole('treasurer'), async (req, res) => { /* edit entry */ })
// deliberately NO router.delete — your "void, don't hard-delete financial rows" rule.
// A correction is a new offsetting entry, not an erasure.

export default router