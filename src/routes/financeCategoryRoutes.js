import express from 'express'
import prisma from '../prismaClient.js'
import requireRole from '../middleware/requireRole.js'
import { LOCKED, keyFor } from '../financeCategories.js'

const router = express.Router()
// mounted behind requireRole('officer') + booksAccess in server.js — every
// officer's page draws its donuts and receipt form off the list; only the
// treasurer and admin add or remove one. booksAccess keeps j-board's treasury
// team to reading it, and authMiddleware the advisor.

const TYPES = ['income', 'expense']
const COLOR = /^#[0-9a-f]{6}$/i

// Each with how many ledger rows and receipts are filed under it — the page
// only offers the bin on one with none — and, for the four the app files
// money under itself, why it's locked.
router.get('/', async (req, res) => {
    try {
        const categories = await prisma.financeCategory.findMany({
            orderBy: { position: 'asc' },
            include: { _count: { select: { transactions: true, reimbursements: true } } }
        })
        res.json(categories.map(({ _count, ...category }) => ({
            ...category,
            inUse: _count.transactions + _count.reimbursements,
            locked: LOCKED[category.key] ?? null
        })))
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Treasurer+: a new slice on one of the donuts. The key is made from the
// label and never changes after, so nothing filed under it has to move.
router.post('/', requireRole('treasurer'), async (req, res) => {
    const label = typeof req.body.label === 'string' ? req.body.label.trim().slice(0, 40) : ''
    // optional — the line the card prints under it
    const description = typeof req.body.description === 'string' ? req.body.description.trim().slice(0, 120) || null : null
    const { type, color } = req.body
    if (!label) { return res.status(400).json({ message: 'label is required' }) }
    if (!TYPES.includes(type)) { return res.status(400).json({ message: 'type must be income or expense' }) }
    if (typeof color !== 'string' || !COLOR.test(color)) {
        return res.status(400).json({ message: 'color must be a hex colour like #FF8A78' })
    }
    const key = keyFor(label)
    if (!key) { return res.status(400).json({ message: 'The name needs at least one letter or number' }) }

    try {
        // one name per category across both halves — the ledger's funnel and
        // the CSV both list them by name, and two "events" would be ambiguous
        const clash = await prisma.financeCategory.findFirst({
            where: { OR: [{ key }, { label: { equals: label, mode: 'insensitive' } }] }
        })
        if (clash) { return res.status(409).json({ message: `There's already a category called ${clash.label}` }) }

        const category = await prisma.financeCategory.create({
            data: { key, label, type, color: color.toUpperCase(), description }
        })
        res.status(201).json({ ...category, inUse: 0, locked: null })
    } catch (err) {
        if (err.code === 'P2002') { return res.status(409).json({ message: 'That category already exists' }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Treasurer+: take one off. Refused for the locked four, for one that still
// has rows or receipts filed under it (move them first — the money would
// otherwise vanish from the summaries), and for the last of its half, since
// the forms always need something to file under.
router.delete('/:key', requireRole('treasurer'), async (req, res) => {
    const { key } = req.params
    if (LOCKED[key]) {
        return res.status(409).json({ message: `That one can't be removed: ${LOCKED[key]}` })
    }

    try {
        const category = await prisma.financeCategory.findUnique({
            where: { key },
            include: { _count: { select: { transactions: true, reimbursements: true } } }
        })
        if (!category) { return res.status(404).json({ message: 'Category not found' }) }

        const { transactions, reimbursements } = category._count
        if (transactions + reimbursements > 0) {
            const filed = [
                transactions && `${transactions} ledger ${transactions === 1 ? 'row' : 'rows'}`,
                reimbursements && `${reimbursements} ${reimbursements === 1 ? 'receipt' : 'receipts'}`
            ].filter(Boolean).join(' and ')
            return res.status(409).json({ message: `${filed} ${transactions + reimbursements === 1 ? 'is' : 'are'} still filed under ${category.label}. Move them to another category first` })
        }

        const left = await prisma.financeCategory.count({ where: { type: category.type } })
        if (left <= 1) {
            return res.status(409).json({ message: `It's the only ${category.type} category left` })
        }

        await prisma.financeCategory.delete({ where: { key } })
        res.json({ message: 'Category removed' })
    } catch (err) {
        // something was filed under it between the count and the delete
        if (err.code === 'P2003') { return res.status(409).json({ message: 'Something is filed under it now. Move it first' }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

export default router
