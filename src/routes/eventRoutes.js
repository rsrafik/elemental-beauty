import express from 'express'
import jwt from 'jsonwebtoken'
import prisma from '../prismaClient.js'
import requireRole from '../middleware/requireRole.js'

const router = express.Router()

router.get('/', async (req, res) => {
    const { when } = req.query

    let where = {}
    if (when === 'upcoming') { where = { date: { gte: new Date() } } }
    if (when === 'past') { where = { date: { lt: new Date() } } }

    try {
        const events = await prisma.event.findMany({
            where,
            orderBy: { date: when === 'past' ? 'desc' : 'asc' }
        })
        res.json(events)
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

router.get('/:id', async (req, res) => {
    const eventId = parseInt(req.params.id)
    if (isNaN(eventId)) { return res.status(400).json({ message: 'Invalid event id' }) }

    try {
        const event = await prisma.event.findUnique({ where: { eventId } })
        if (!event) { return res.status(404).json({ message: 'Event not found' }) }

        res.json(event)
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// ---- officer+ event management ----

router.post('/', requireRole('officer'), async (req, res) => {
    const { title, description, date, image } = req.body

    if (!title || !date) {
        return res.status(400).json({ message: 'title and date are required' })
    }
    const eventDate = new Date(date)
    if (isNaN(eventDate.getTime())) {
        return res.status(400).json({ message: 'date must be a valid date (YYYY-MM-DD)' })
    }

    try {
        const event = await prisma.event.create({
            data: { title, description, date: eventDate, image }
        })
        res.status(201).json(event)
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

router.put('/:id', requireRole('officer'), async (req, res) => {
    const eventId = parseInt(req.params.id)
    if (isNaN(eventId)) { return res.status(400).json({ message: 'Invalid event id' }) }

    const { title, description, date, image } = req.body

    // Only include fields the client actually sent, so a partial update
    // doesn't null out the columns that were left off.
    const data = {}
    if (title !== undefined) { data.title = title }
    if (description !== undefined) { data.description = description }
    if (image !== undefined) { data.image = image }
    if (date !== undefined) {
        const eventDate = new Date(date)
        if (isNaN(eventDate.getTime())) {
            return res.status(400).json({ message: 'date must be a valid date (YYYY-MM-DD)' })
        }
        data.date = eventDate
    }

    try {
        const event = await prisma.event.update({ where: { eventId }, data })
        res.json(event)
    } catch (err) {
        if (err.code === 'P2025') { return res.status(404).json({ message: 'Event not found' }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

router.delete('/:id', requireRole('officer'), async (req, res) => {
    const eventId = parseInt(req.params.id)
    if (isNaN(eventId)) { return res.status(400).json({ message: 'Invalid event id' }) }

    try {
        // cascades to member_event rows per the schema
        await prisma.event.delete({ where: { eventId } })
        res.json({ message: 'Event deleted' })
    } catch (err) {
        if (err.code === 'P2025') { return res.status(404).json({ message: 'Event not found' }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

// ---- member actions ----

router.post('/:eventId/rsvp', async (req, res) => {
    const eventId = parseInt(req.params.eventId)
    if (isNaN(eventId)) { return res.status(400).json({ message: 'Invalid event id' }) }

    try {
        // upsert = RSVPing twice is a harmless no-op instead of a crash
        const rsvp = await prisma.memberEvent.upsert({
            where: { memberId_eventId: { memberId: req.userId, eventId } },
            update: {},
            create: { memberId: req.userId, eventId }   // status defaults to 'rsvped'
        })
        res.status(201).json(rsvp)
    } catch (err) {
        if (err.code === 'P2003') { return res.status(404).json({ message: 'Event not found' }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Un-RSVP. Events are uncapped, so no promotion logic — just remove the row.
router.delete('/:eventId/rsvp', async (req, res) => {
    const eventId = parseInt(req.params.eventId)
    if (isNaN(eventId)) { return res.status(400).json({ message: 'Invalid event id' }) }

    try {
        const existing = await prisma.memberEvent.findUnique({
            where: { memberId_eventId: { memberId: req.userId, eventId } }
        })
        if (!existing) { return res.status(404).json({ message: 'You have no RSVP for this event' }) }
        if (existing.attendanceStatus === 'attended') {
            return res.status(409).json({ message: 'You are already checked in and cannot un-RSVP' })
        }

        await prisma.memberEvent.delete({
            where: { memberId_eventId: { memberId: req.userId, eventId } }
        })
        res.json({ message: 'RSVP cancelled' })
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Officer scans a member's QR at the door. Body: { qrToken }
router.post('/:eventId/checkin', requireRole('officer'), async (req, res) => {
    const eventId = parseInt(req.params.eventId)
    if (isNaN(eventId)) { return res.status(400).json({ message: 'Invalid event id' }) }

    const { qrToken } = req.body
    if (!qrToken) { return res.status(400).json({ message: 'qrToken is required' }) }

    let decoded
    try {
        decoded = jwt.verify(qrToken, process.env.QR_SECRET)
    } catch {
        return res.status(400).json({ message: 'Invalid QR code' })
    }

    try {
        const existing = await prisma.memberEvent.findUnique({
            where: { memberId_eventId: { memberId: decoded.id, eventId } }
        })

        if (!existing) {
            // walk-in with no RSVP → waitlist, timestamped for oldest-first admission
            const waitlisted = await prisma.memberEvent.create({
                data: {
                    memberId: decoded.id,
                    eventId,
                    attendanceStatus: 'waitlisted',
                    waitlistedAt: new Date()
                }
            })
            return res.status(202).json({
                code: 'WAITLISTED',
                message: 'No RSVP found — added to the waitlist',
                attendance: waitlisted
            })
        }

        if (existing.attendanceStatus === 'attended') {
            return res.json({ code: 'ALREADY_CHECKED_IN', message: 'Already checked in' })
        }
        if (existing.attendanceStatus === 'waitlisted') {
            return res.status(202).json({ code: 'ALREADY_WAITLISTED', message: 'Still on the waitlist' })
        }

        // rsvped → check them in
        const attendance = await prisma.memberEvent.update({
            where: { memberId_eventId: { memberId: decoded.id, eventId } },
            data: { attendanceStatus: 'attended' }
        })
        res.json({ code: 'CHECKED_IN', message: 'Checked in', attendance })
    } catch (err) {
        if (err.code === 'P2003') { return res.status(404).json({ message: 'Event or member not found' }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Events have no seat cap, so the button admits the entire waitlist.
// (Labs cap admission at capacity — see labRoutes.)
router.post('/:eventId/admit-waitlist', requireRole('officer'), async (req, res) => {
    const eventId = parseInt(req.params.eventId)
    if (isNaN(eventId)) { return res.status(400).json({ message: 'Invalid event id' }) }

    try {
        const result = await prisma.memberEvent.updateMany({
            where: { eventId, attendanceStatus: 'waitlisted' },
            data: { attendanceStatus: 'attended' }
        })
        res.json({ admitted: result.count })
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

export default router
