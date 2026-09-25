import express from 'express'
import prisma from '../prismaClient.js'
import { log } from '../activity.js'
import { recordDues } from '../dues.js'

// Dues, for the treasurer (mounted behind requireRole('treasurer') in
// server.js). One payment per member per school year; marking one paid writes
// an income row under 'dues', so the money shows up in the ledger and the
// income donut like any other. See DuesPayment in schema.prisma.
//
//   GET    /?schoolYear=2025–26   every member and their payment for that year
//   POST   /                      { memberId, schoolYear, amount, paidOn? }
//   DELETE /:duesId               take a payment back (and its ledger row)

const router = express.Router()

const SCHOOL_YEAR = /^\d{4}–\d{2}$/
const DAY = /^\d{4}-\d{2}-\d{2}$/

router.get('/', async (req, res) => {
    const { schoolYear } = req.query
    if (!SCHOOL_YEAR.test(schoolYear ?? '')) {
        return res.status(400).json({ message: 'schoolYear must look like 2025–26' })
    }

    try {
        const [target, members] = await Promise.all([
            prisma.yearTarget.findUnique({ where: { schoolYear }, select: { duesAmount: true } }),
            prisma.member.findMany({
                select: {
                    userId: true,
                    role: true,
                    user: { select: { firstName: true, lastName: true, username: true } },
                    dues: {
                        where: { schoolYear },
                        select: { duesId: true, amount: true, paidOn: true, transactionId: true }
                    }
                }
            })
        ])
        const rows = members.map(({ user, dues, ...member }) => ({
            ...member,
            ...user,
            payment: dues[0]
                ? { ...dues[0], amount: Number(dues[0].amount), paidOn: dues[0].paidOn.toISOString().slice(0, 10) }
                : null
        }))
        rows.sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName))
        res.json({ schoolYear, duesAmount: Number(target?.duesAmount ?? 0), members: rows })
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Mark someone paid. 0 is a waived year — see recordDues in src/dues.js.
router.post('/', async (req, res) => {
    const memberId = Number(req.body?.memberId)
    const { schoolYear } = req.body ?? {}
    const amount = parseFloat(req.body?.amount)
    const paidOn = req.body?.paidOn

    if (!Number.isInteger(memberId)) { return res.status(400).json({ message: 'memberId is required' }) }
    if (!SCHOOL_YEAR.test(schoolYear ?? '')) { return res.status(400).json({ message: 'schoolYear must look like 2025–26' }) }
    if (isNaN(amount) || amount < 0) { return res.status(400).json({ message: 'amount must be 0 (waived) or more' }) }
    if (paidOn !== undefined && paidOn !== null && !DAY.test(paidOn)) {
        return res.status(400).json({ message: 'paidOn must be a date (YYYY-MM-DD)' })
    }

    try {
        const member = await prisma.member.findUnique({
            where: { userId: memberId },
            select: { user: { select: { firstName: true, lastName: true, username: true } } }
        })
        if (!member) { return res.status(404).json({ message: 'Member not found' }) }
        const day = paidOn ? new Date(`${paidOn}T00:00:00.000Z`) : undefined

        const payment = await prisma.$transaction((tx) => recordDues(tx, {
            memberId, user: member.user, schoolYear, amount, day, actorId: req.userId
        }))
        res.status(201).json({
            ...payment,
            amount: Number(payment.amount),
            paidOn: payment.paidOn.toISOString().slice(0, 10)
        })
    } catch (err) {
        if (err.code === 'P2002') { return res.status(409).json({ message: 'They’re already marked paid for that year' }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Take a payment back — a mistake, or a refund. Its ledger row goes too;
// deleting that row is what takes the payment with it (the cascade), so a
// waived year, which has none, is deleted directly.
router.delete('/:duesId', async (req, res) => {
    const duesId = parseInt(req.params.duesId)
    if (isNaN(duesId)) { return res.status(400).json({ message: 'Invalid dues id' }) }

    try {
        const payment = await prisma.duesPayment.findUnique({ where: { duesId } })
        if (!payment) { return res.status(404).json({ message: 'Payment not found' }) }

        await prisma.$transaction(async (tx) => {
            if (payment.transactionId != null) {
                await tx.transaction.delete({ where: { transactionId: payment.transactionId } })
            } else {
                await tx.duesPayment.delete({ where: { duesId } })
            }
            await log({
                actorId: req.userId, action: 'dues_cleared', targetId: payment.memberId,
                details: { schoolYear: payment.schoolYear, amount: Number(payment.amount) }
            }, tx)
        })
        res.json({ message: 'Payment removed' })
    } catch (err) {
        if (err.code === 'P2025') { return res.status(404).json({ message: 'Payment not found' }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

export default router
