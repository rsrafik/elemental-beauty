import express from 'express'
import prisma from '../prismaClient.js'
import { keepsBooks } from '../payments.js'
import { goggleRentalPrice } from '../payable.js'

const router = express.Router()
// mounted behind authMiddleware + requireRole('member') in server.js

// The ways to pay the club — /analytics' "accepted payments" card. Every
// member reads them (a lab's page, /vip, the reminder email's QR codes); the
// treasurer and admin add, edit and remove them.
//
//   title        what the payment dropdown offers ('Venmo') — required
//   image        its QR code, a data URL like a receipt photo — optional
//   description  a line under the QR code ('@elementalbeauty') — optional
//
// And on the same card, what renting goggles for a lab costs:
//   GET /goggles   { price } — everyone reads it
//   PUT /goggles   { price } — the treasurer or admin; 0 stops rentals

// a phone screenshot of a QR code, shrunk in the browser first (lib/images)
const IMAGE = /^data:image\/(png|jpe?g|webp|gif);base64,/
const MAX_IMAGE = 3_000_000

// `keep` is an edit: an image left out of the body stays as it was, and null
// takes it off.
function readMethod(body, { keep = false } = {}) {
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 60) : ''
    if (!title) { return { error: 'Give the payment platform a name' } }
    const description = typeof body.description === 'string' ? body.description.trim().slice(0, 200) || null : null
    if (keep && body.image === undefined) { return { fields: { title, description } } }
    const image = body.image ?? null
    if (image !== null && (typeof image !== 'string' || !IMAGE.test(image) || image.length > MAX_IMAGE)) {
        return { error: 'The QR code has to be a picture (PNG or JPEG), under 2MB' }
    }
    return { fields: { title, description, image } }
}

router.get('/', async (req, res) => {
    try {
        res.json(await prisma.paymentMethod.findMany({ orderBy: { methodId: 'asc' } }))
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

router.get('/goggles', async (req, res) => {
    try {
        res.json({ price: await goggleRentalPrice(prisma) })
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

router.put('/goggles', async (req, res) => {
    if (!keepsBooks(req)) { return res.status(403).json({ message: 'Only the treasurer or an admin can set the goggle rental price' }) }
    const price = Number(req.body?.price)
    if (!Number.isFinite(price) || price < 0 || price > 10_000) {
        return res.status(400).json({ message: 'The price has to be a number of dollars, 0 or more' })
    }
    try {
        const rounded = Math.round(price * 100) / 100
        await prisma.clubSettings.upsert({
            where: { settingId: 1 },
            update: { goggleRentalPrice: rounded },
            create: { settingId: 1, goggleRentalPrice: rounded }
        })
        res.json({ price: rounded })
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

router.post('/', async (req, res) => {
    if (!keepsBooks(req)) { return res.status(403).json({ message: 'Only the treasurer or an admin can add a way to pay' }) }
    const { fields, error } = readMethod(req.body ?? {})
    if (error) { return res.status(400).json({ message: error }) }
    try {
        res.status(201).json(await prisma.paymentMethod.create({ data: fields }))
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Payments already sent in under it keep the name it had then (methodTitle),
// so renaming one rewrites nothing that's been sent.
router.put('/:id', async (req, res) => {
    if (!keepsBooks(req)) { return res.status(403).json({ message: 'Only the treasurer or an admin can change a way to pay' }) }
    const methodId = parseInt(req.params.id)
    if (isNaN(methodId)) { return res.status(400).json({ message: 'Invalid id' }) }
    const { fields, error } = readMethod(req.body ?? {}, { keep: true })
    if (error) { return res.status(400).json({ message: error }) }
    try {
        res.json(await prisma.paymentMethod.update({ where: { methodId }, data: fields }))
    } catch (err) {
        if (err.code === 'P2025') { return res.status(404).json({ message: 'Not found' }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Payments already sent in under it keep its name (methodTitle), so taking
// one off rewrites nothing.
router.delete('/:id', async (req, res) => {
    if (!keepsBooks(req)) { return res.status(403).json({ message: 'Only the treasurer or an admin can remove a way to pay' }) }
    const methodId = parseInt(req.params.id)
    if (isNaN(methodId)) { return res.status(400).json({ message: 'Invalid id' }) }
    try {
        await prisma.paymentMethod.delete({ where: { methodId } })
        res.json({ message: 'Removed' })
    } catch (err) {
        if (err.code === 'P2025') { return res.status(404).json({ message: 'Not found' }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

export default router
