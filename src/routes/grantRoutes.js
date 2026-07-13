import express from 'express'
import prisma from '../prismaClient.js'

const router = express.Router()

router.post('/', async (req, res) => { /* create grant */ })
router.get('/', async (req, res) => { /* list */ })

router.get('/:id', async (req, res) => {
    const grantId = parseInt(req.params.id)
    // fetch the grant, then derive spending — never stored, per your schema comment:
    const spent = await prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { grantId }
    })
    // res.json({ ...grant, amountSpent: Number(spent._sum.amount ?? 0),
    //            remaining: Number(grant.amountGranted) - Number(spent._sum.amount ?? 0) })
})

router.put('/:id', async (req, res) => { /* update */ })
router.delete('/:id', async (req, res) => {
    // will FAIL (P2003 / Restrict) if transactions reference it — catch → 409
    // "grant has linked transactions" is the correct behavior, not a bug
})

export default router