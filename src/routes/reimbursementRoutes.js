import express from 'express'
import prisma from '../prismaClient.js'
import requireRole from '../middleware/requireRole.js'

const router = express.Router()

router.post('/', async (req, res) => {
    const { explanation, amountRequested, category, receipt } = req.body
    // note what's absent: status (DB defaults to pending) and memberId (comes from req.userId)
})

router.get('/mine', async (req, res) => {
    // findMany({ where: { memberId: req.userId }, orderBy: { date: 'desc' } })
})

router.get('/', requireRole('treasurer'), async (req, res) => {
    // all requests; support ?status=pending for the treasurer's queue
})

router.put('/:id/status', requireRole('treasurer'), async (req, res) => {
    const { status, denialExplanation } = req.body
    // validate: status is 'approved' or 'denied'; if denied, denialExplanation required
    //   (the DB CHECK backs you up — catch its error → 400)
    // update ONLY these two fields. The approved→transaction ledger entry
    // happens inside Postgres via your trigger — no ledger code here at all.
})

export default router