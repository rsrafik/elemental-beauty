import express from 'express'
import prisma from '../prismaClient.js'

const router = express.Router()
// no requireRole imports needed — the whole router is mounted behind
// requireRole('treasurer') in server.js

router.post('/', async (req, res) => {
    const { source, amountGranted, dateGranted, expirationDate } = req.body

    if (!source || amountGranted === undefined || !dateGranted) {
        return res.status(400).json({ message: 'source, amountGranted, and dateGranted are required' })
    }
    const amount = parseFloat(amountGranted)
    if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ message: 'amountGranted must be a positive number' })
    }
    const granted = new Date(dateGranted)
    if (isNaN(granted.getTime())) {
        return res.status(400).json({ message: 'dateGranted must be a valid date (YYYY-MM-DD)' })
    }
    let expiration = null
    if (expirationDate !== undefined && expirationDate !== null) {
        expiration = new Date(expirationDate)
        if (isNaN(expiration.getTime())) {
            return res.status(400).json({ message: 'expirationDate must be a valid date (YYYY-MM-DD)' })
        }
        if (expiration < granted) {
            return res.status(400).json({ message: 'expirationDate cannot be before dateGranted' })
        }
    }

    try {
        const grant = await prisma.grant.create({
            data: { source, amountGranted: amount, dateGranted: granted, expirationDate: expiration }
        })
        res.status(201).json(grant)
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

router.get('/', async (req, res) => {
    try {
        const grants = await prisma.grant.findMany({ orderBy: { dateGranted: 'desc' } })
        res.json(grants)
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// amountSpent is derived by summing linked transactions — never stored,
// so it can't drift out of sync with the ledger.
router.get('/:id', async (req, res) => {
    const grantId = parseInt(req.params.id)
    if (isNaN(grantId)) { return res.status(400).json({ message: 'Invalid grant id' }) }

    try {
        const grant = await prisma.grant.findUnique({ where: { grantId } })
        if (!grant) { return res.status(404).json({ message: 'Grant not found' }) }

        const spent = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: { grantId }
        })
        const amountSpent = Number(spent._sum.amount ?? 0)

        res.json({
            ...grant,
            amountSpent,
            remaining: Number(grant.amountGranted) - amountSpent
        })
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

router.put('/:id', async (req, res) => {
    const grantId = parseInt(req.params.id)
    if (isNaN(grantId)) { return res.status(400).json({ message: 'Invalid grant id' }) }

    const data = {}
    if (req.body.source !== undefined) { data.source = req.body.source }
    if (req.body.amountGranted !== undefined) {
        const amount = parseFloat(req.body.amountGranted)
        if (isNaN(amount) || amount <= 0) {
            return res.status(400).json({ message: 'amountGranted must be a positive number' })
        }
        data.amountGranted = amount
    }
    if (req.body.dateGranted !== undefined) {
        const granted = new Date(req.body.dateGranted)
        if (isNaN(granted.getTime())) {
            return res.status(400).json({ message: 'dateGranted must be a valid date (YYYY-MM-DD)' })
        }
        data.dateGranted = granted
    }
    if (req.body.expirationDate !== undefined) {
        if (req.body.expirationDate === null) {
            data.expirationDate = null
        } else {
            const expiration = new Date(req.body.expirationDate)
            if (isNaN(expiration.getTime())) {
                return res.status(400).json({ message: 'expirationDate must be a valid date (YYYY-MM-DD)' })
            }
            data.expirationDate = expiration
        }
    }

    try {
        const grant = await prisma.grant.update({ where: { grantId }, data })
        res.json(grant)
    } catch (err) {
        if (err.code === 'P2025') { return res.status(404).json({ message: 'Grant not found' }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

router.delete('/:id', async (req, res) => {
    const grantId = parseInt(req.params.id)
    if (isNaN(grantId)) { return res.status(400).json({ message: 'Invalid grant id' }) }

    try {
        await prisma.grant.delete({ where: { grantId } })
        res.json({ message: 'Grant deleted' })
    } catch (err) {
        if (err.code === 'P2025') { return res.status(404).json({ message: 'Grant not found' }) }
        if (err.code === 'P2003') {
            // ON DELETE RESTRICT: transactions reference this grant.
            // Refusing is correct behavior — the ledger must stay intact.
            return res.status(409).json({ message: 'Grant has linked transactions and cannot be deleted' })
        }
        console.error(err.message)
        res.sendStatus(500)
    }
})

export default router
