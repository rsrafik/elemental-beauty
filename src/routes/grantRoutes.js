import express from 'express'
import prisma from '../prismaClient.js'
import requireRole from '../middleware/requireRole.js'

const router = express.Router()
// Mounted behind requireRole('officer') in server.js: every officer reads the
// grant tracker on /analytics. Writing is the treasurer's, so each write below
// raises the floor — the same split transactions use.

const GRANT_STATUSES = ['drafting', 'under_review', 'awarded', 'denied']

// amountAwarded: a positive number, or null/'' to clear it.
// Returns { value } (undefined = not sent) or { error }.
function readAwarded(body) {
    if (body.amountAwarded === undefined) { return {} }
    if (body.amountAwarded === null || body.amountAwarded === '') { return { value: null } }
    const amount = parseFloat(body.amountAwarded)
    if (isNaN(amount) || amount <= 0) { return { error: 'amountAwarded must be a positive number' } }
    return { value: amount }
}

// A grant is tracked from before it's sent, so what's required to file one is
// what an application has at that point: who it's from, what's being asked for,
// and when it's due. The money is separate — awarding one doesn't bank it, so
// dateGranted only turns up once the decision does, and the deposit itself is
// an income transaction the treasurer records when it lands.
router.post('/', requireRole('treasurer'), async (req, res) => {
    const { name, org, amountRequested, status, deadline, dateGranted, expirationDate } = req.body
    const awarded = readAwarded(req.body)
    if (awarded.error) { return res.status(400).json({ message: awarded.error }) }

    if (!name || !org || amountRequested === undefined || !deadline) {
        return res.status(400).json({ message: 'name, org, amountRequested, and deadline are required' })
    }
    const amount = parseFloat(amountRequested)
    if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ message: 'amountRequested must be a positive number' })
    }
    if (status !== undefined && !GRANT_STATUSES.includes(status)) {
        return res.status(400).json({ message: `status must be one of: ${GRANT_STATUSES.join(', ')}` })
    }
    const due = new Date(deadline)
    if (isNaN(due.getTime())) {
        return res.status(400).json({ message: 'deadline must be a valid date (YYYY-MM-DD)' })
    }
    let granted = null
    if (dateGranted !== undefined && dateGranted !== null) {
        granted = new Date(dateGranted)
        if (isNaN(granted.getTime())) {
            return res.status(400).json({ message: 'dateGranted must be a valid date (YYYY-MM-DD)' })
        }
    }
    let expiration = null
    if (expirationDate !== undefined && expirationDate !== null) {
        expiration = new Date(expirationDate)
        if (isNaN(expiration.getTime())) {
            return res.status(400).json({ message: 'expirationDate must be a valid date (YYYY-MM-DD)' })
        }
        if (granted && expiration < granted) {
            return res.status(400).json({ message: 'expirationDate cannot be before dateGranted' })
        }
    }

    try {
        const grant = await prisma.grant.create({
            data: {
                name,
                org,
                amountRequested: amount,
                amountAwarded: awarded.value ?? null,
                status,
                deadline: due,
                dateGranted: granted,
                expirationDate: expiration
            }
        })
        res.status(201).json(grant)
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// By deadline, because an application that isn't awarded yet has no other date
// on it — and the ones with something still to do about them are the point of
// the tracker.
router.get('/', async (req, res) => {
    try {
        const grants = await prisma.grant.findMany({ orderBy: { deadline: 'desc' } })
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

        // counted from what was granted, not what was asked for — and there's
        // nothing to have left over until something has been granted
        res.json({
            ...grant,
            amountSpent,
            remaining: grant.amountAwarded == null ? null : Number(grant.amountAwarded) - amountSpent
        })
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

router.put('/:id', requireRole('treasurer'), async (req, res) => {
    const grantId = parseInt(req.params.id)
    if (isNaN(grantId)) { return res.status(400).json({ message: 'Invalid grant id' }) }

    const data = {}
    if (req.body.name !== undefined) { data.name = req.body.name }
    if (req.body.org !== undefined) { data.org = req.body.org }
    if (req.body.amountRequested !== undefined) {
        const amount = parseFloat(req.body.amountRequested)
        if (isNaN(amount) || amount <= 0) {
            return res.status(400).json({ message: 'amountRequested must be a positive number' })
        }
        data.amountRequested = amount
    }
    const awarded = readAwarded(req.body)
    if (awarded.error) { return res.status(400).json({ message: awarded.error }) }
    if (awarded.value !== undefined) { data.amountAwarded = awarded.value }
    if (req.body.status !== undefined) {
        if (!GRANT_STATUSES.includes(req.body.status)) {
            return res.status(400).json({ message: `status must be one of: ${GRANT_STATUSES.join(', ')}` })
        }
        data.status = req.body.status
    }
    if (req.body.deadline !== undefined) {
        const due = new Date(req.body.deadline)
        if (isNaN(due.getTime())) {
            return res.status(400).json({ message: 'deadline must be a valid date (YYYY-MM-DD)' })
        }
        data.deadline = due
    }
    if (req.body.dateGranted !== undefined) {
        if (req.body.dateGranted === null) {
            data.dateGranted = null
        } else {
            const granted = new Date(req.body.dateGranted)
            if (isNaN(granted.getTime())) {
                return res.status(400).json({ message: 'dateGranted must be a valid date (YYYY-MM-DD)' })
            }
            data.dateGranted = granted
        }
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
        // chk_grants_expiration: an expiry before the day it was granted
        if (err.code === 'P2010' || err.code === 'P2000') {
            return res.status(400).json({ message: 'expirationDate cannot be before dateGranted' })
        }
        console.error(err.message)
        res.sendStatus(500)
    }
})

router.delete('/:id', requireRole('treasurer'), async (req, res) => {
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
