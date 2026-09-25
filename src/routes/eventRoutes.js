import express from 'express'
import jwt from 'jsonwebtoken'
import prisma from '../prismaClient.js'
import requireRole from '../middleware/requireRole.js'
import { eventPoints } from '../points.js'
import { mountRoster } from './roster.js'
import { acceptOffer, confirmSpot, expireOffers, lockParent, offerNext, startsAt } from '../offers.js'
import { log } from '../activity.js'

const router = express.Router()

const EVENT_TYPES = ['official', 'social']
const EVENT_TRACKS = ['members', 'officers', 'open', 'online']

// 'HH:MM' — what <input type="time"> hands back, and what the calendar prints.
const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/

// Seats spoken for. A waitlisted row is NOT one of them — that's the whole
// point of the waitlist — so the count is what fills the cap and nothing else.
// An open waitlist offer holds a seat too (see src/offers.js).
const TAKEN = { attendanceStatus: { in: ['rsvped', 'attended', 'offered'] } }

// ---- member-visible reads ----

// ?when=upcoming|past and ?type=official|social both optional, combinable.
//
// Officers-only events never reach a plain member. The member calendar filters
// them out on its own too, but that's the view side of the rule — this is the
// one that matters, because a page can't hide what it was never sent.
router.get('/', async (req, res) => {
    const { when, type } = req.query

    const where = {}
    if (when === 'upcoming') { where.date = { gte: new Date() } }
    if (when === 'past') { where.date = { lt: new Date() } }
    if (type !== undefined) {
        if (!EVENT_TYPES.includes(type)) {
            return res.status(400).json({ message: 'type must be official or social' })
        }
        where.type = type
    }
    if (req.role === 'member') { where.track = { not: 'officers' } }

    try {
        const events = await prisma.event.findMany({
            where,
            include: {
                category: { select: { name: true } },
                // at most one row — the pair is the primary key
                members: {
                    where: { memberId: req.userId },
                    select: { attendanceStatus: true }
                },
                _count: { select: { members: { where: TAKEN } } }
            },
            orderBy: [{ date: when === 'past' ? 'desc' : 'asc' }, { startTime: 'asc' }]
        })

        // Same two extras the lab list carries: how many seats are gone, and
        // where the person asking stands on it.
        res.json(events.map(({ members, _count, ...event }) => ({
            ...event,
            taken: _count.members,
            mine: members[0]?.attendanceStatus ?? null
        })))
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

router.get('/:id', async (req, res) => {
    const eventId = parseInt(req.params.id)
    if (isNaN(eventId)) { return res.status(400).json({ message: 'Invalid event id' }) }

    try {
        const event = await prisma.event.findUnique({
            where: { eventId },
            include: { category: { select: { name: true } } }
        })
        if (!event) { return res.status(404).json({ message: 'Event not found' }) }
        // an officers-only event doesn't exist as far as a member is concerned —
        // 404, not 403, so the reply doesn't confirm there's something there
        if (event.track === 'officers' && req.role === 'member') {
            return res.status(404).json({ message: 'Event not found' })
        }

        // Where the person asking stands on it — what /events/view switches
        // on, the same extras a lab's page gets: their status, seats gone,
        // whether they've been asked to confirm, and their place in the queue.
        const [link, taken] = await Promise.all([
            prisma.memberEvent.findUnique({ where: { memberId_eventId: { memberId: req.userId, eventId } } }),
            prisma.memberEvent.count({ where: { eventId, ...TAKEN } })
        ])
        let waitlistPosition = null
        if (link?.attendanceStatus === 'waitlisted') {
            const ahead = await prisma.memberEvent.count({
                where: { eventId, attendanceStatus: 'waitlisted', waitlistedAt: { lt: link.waitlistedAt } }
            })
            waitlistPosition = ahead + 1
        }

        res.json({
            ...event,
            taken,
            mine: link?.attendanceStatus ?? null,
            confirmPending: link?.attendanceStatus === 'rsvped' && Boolean(link.confirmSentAt) && !link.confirmedAt,
            confirmBy: link?.confirmBy ?? null,
            confirmedAt: link?.confirmedAt ?? null,
            waitlistPosition,
            // true once it's begun — the page stops offering the rsvp button
            started: startsAt(event).getTime() <= Date.now()
        })
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// ---- officer+ event management ----

router.post('/', requireRole('officer'), async (req, res) => {
    const { title, type, track, categoryId, description, date, startTime, location, image, capacity } = req.body

    if (!title || !date) {
        return res.status(400).json({ message: 'title and date are required' })
    }
    if (!EVENT_TYPES.includes(type)) {
        return res.status(400).json({ message: 'type must be official or social' })
    }
    if (track !== undefined && !EVENT_TRACKS.includes(track)) {
        return res.status(400).json({ message: `track must be one of: ${EVENT_TRACKS.join(', ')}` })
    }
    const eventDate = new Date(date)
    if (isNaN(eventDate.getTime())) {
        return res.status(400).json({ message: 'date must be a valid date (YYYY-MM-DD)' })
    }
    if (startTime !== undefined && startTime !== null && startTime !== '' && !TIME.test(startTime)) {
        return res.status(400).json({ message: 'startTime must be HH:MM' })
    }
    if (capacity !== undefined && capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) {
        return res.status(400).json({ message: 'capacity must be a positive integer (or omitted for unlimited)' })
    }

    try {
        const event = await prisma.event.create({
            data: {
                title,
                type,
                track,
                categoryId: categoryId ?? null,
                description,
                date: eventDate,
                startTime: startTime || null,
                location: location?.trim() || null,
                image,
                capacity
            }
        })
        res.status(201).json(event)
    } catch (err) {
        // categoryId naming a tag that isn't on the calendar's legend
        if (err.code === 'P2003') { return res.status(400).json({ message: 'Unknown categoryId' }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

router.put('/:id', requireRole('officer'), async (req, res) => {
    const eventId = parseInt(req.params.id)
    if (isNaN(eventId)) { return res.status(400).json({ message: 'Invalid event id' }) }

    // partial update: only touch fields the client actually sent
    const data = {}
    if (req.body.title !== undefined) { data.title = req.body.title }
    if (req.body.description !== undefined) { data.description = req.body.description }
    if (req.body.image !== undefined) { data.image = req.body.image }
    if (req.body.location !== undefined) { data.location = req.body.location?.trim() || null }
    if (req.body.type !== undefined) {
        if (!EVENT_TYPES.includes(req.body.type)) {
            return res.status(400).json({ message: 'type must be official or social' })
        }
        data.type = req.body.type
    }
    if (req.body.track !== undefined) {
        if (!EVENT_TRACKS.includes(req.body.track)) {
            return res.status(400).json({ message: `track must be one of: ${EVENT_TRACKS.join(', ')}` })
        }
        data.track = req.body.track
    }
    if (req.body.categoryId !== undefined) { data.categoryId = req.body.categoryId }
    if (req.body.startTime !== undefined) {
        if (req.body.startTime && !TIME.test(req.body.startTime)) {
            return res.status(400).json({ message: 'startTime must be HH:MM' })
        }
        data.startTime = req.body.startTime || null
    }
    if (req.body.date !== undefined) {
        const eventDate = new Date(req.body.date)
        if (isNaN(eventDate.getTime())) {
            return res.status(400).json({ message: 'date must be a valid date (YYYY-MM-DD)' })
        }
        data.date = eventDate
    }
    if (req.body.capacity !== undefined) {
        if (req.body.capacity !== null && (!Number.isInteger(req.body.capacity) || req.body.capacity < 1)) {
            return res.status(400).json({ message: 'capacity must be a positive integer or null' })
        }
        data.capacity = req.body.capacity
    }

    // moved to another day or time: the day-before reminder is owed again
    if (data.date !== undefined || data.startTime !== undefined) { data.reminderSentAt = null }

    try {
        const event = await prisma.event.update({ where: { eventId }, data })
        res.json(event)
    } catch (err) {
        if (err.code === 'P2025') { return res.status(404).json({ message: 'Event not found' }) }
        if (err.code === 'P2003') { return res.status(400).json({ message: 'Unknown categoryId' }) }
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

// The check-in page's roster and its by-hand buttons (see roster.js).
mountRoster(router, {
    kindName: 'event',
    parentName: 'event',
    linkName: 'memberEvent',
    key: 'eventId',
    compound: 'memberId_eventId',
    points: (event) => eventPoints(event.type),
    label: 'Event'
})

// ---- member actions ----

// RSVP. Capped events (capacity set) behave exactly like labs: when full,
// the member joins the online waitlist and is auto-promoted if a seat opens.
// Uncapped events (capacity null) always RSVP directly.
router.post('/:eventId/rsvp', async (req, res) => {
    const eventId = parseInt(req.params.eventId)
    if (isNaN(eventId)) { return res.status(400).json({ message: 'Invalid event id' }) }

    try {
        const event = await prisma.event.findUnique({ where: { eventId } })
        // an officers-only event doesn't exist for a member — the same 404
        // GET /:id gives, so signing up by id can't get round it
        if (!event || (event.track === 'officers' && req.role === 'member')) {
            return res.status(404).json({ message: 'Event not found' })
        }

        const existing = await prisma.memberEvent.findUnique({
            where: { memberId_eventId: { memberId: req.userId, eventId } }
        })
        // once it's begun, sign-ups are the door's business (the QR scan and
        // the check-in page) — but an offer in hand can still be taken
        if (startsAt(event).getTime() <= Date.now() && existing?.attendanceStatus !== 'offered') {
            return res.status(409).json({ message: 'This event has already started' })
        }
        if (existing) {
            // pressing the button while holding an offer accepts it
            if (existing.attendanceStatus === 'offered') {
                await acceptOffer('event', eventId, req.userId)
                return res.status(201).json({ code: 'ACCEPTED', message: 'Spot accepted — you\'re signed up' })
            }
            if (existing.attendanceStatus === 'waitlisted') {
                return res.status(202).json({ code: 'ALREADY_WAITLISTED', message: 'You are already on the waitlist' })
            }
            return res.json({ code: 'ALREADY_RSVPED', message: 'You are already RSVP\'d', rsvp: existing })
        }

        // under the event's row lock, so two sign-ups for the last seat queue
        // up rather than both counting it free (see lockParent)
        const result = await prisma.$transaction(async (tx) => {
            await lockParent(tx, 'event', eventId)
            if (event.capacity !== null) {
                const seatsTaken = await tx.memberEvent.count({
                    where: { eventId, ...TAKEN }
                })
                if (seatsTaken >= event.capacity) {
                    const rsvp = await tx.memberEvent.create({
                        data: {
                            memberId: req.userId,
                            eventId,
                            attendanceStatus: 'waitlisted',
                            waitlistedAt: new Date()
                        }
                    })
                    return { code: 'WAITLISTED', rsvp }
                }
            }
            const rsvp = await tx.memberEvent.create({
                data: { memberId: req.userId, eventId }   // status defaults to 'rsvped'
            })
            return { code: 'RSVPED', rsvp }
        })

        if (result.code === 'WAITLISTED') {
            // someone waiting is what makes missed confirmation deadlines
            // count — see enforceConfirmations in src/offers.js
            expireOffers().catch((err) => console.error(`Offer sweep failed: ${err.message}`))
            return res.status(202).json({
                code: 'WAITLISTED',
                message: 'Event is full — you are on the waitlist and will be offered a spot if one opens',
                rsvp: result.rsvp
            })
        }
        res.status(201).json({ code: 'RSVPED', message: 'RSVP confirmed', rsvp: result.rsvp })
    } catch (err) {
        // the same button pressed twice at once: the second insert loses
        if (err.code === 'P2002') { return res.json({ code: 'ALREADY_RSVPED', message: 'You are already RSVP\'d' }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

// A member confirming their spot from the event's page rather than the email
// (the check-in page's "confirmation" — src/offers.js).
router.post('/:eventId/confirm', async (req, res) => {
    const eventId = parseInt(req.params.eventId)
    if (isNaN(eventId)) { return res.status(400).json({ message: 'Invalid event id' }) }
    try {
        const result = await confirmSpot('event', eventId, req.userId)
        if (result.status === 'gone') { return res.status(404).json({ message: 'You have no spot to confirm' }) }
        res.json({ message: 'Spot confirmed', ...result })
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Un-RSVP (or turn down an offer). If a held seat frees up, the oldest
// waitlisted member is offered it in the same transaction — see src/offers.js.
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

        const promoted = await prisma.$transaction(async (tx) => {
            await lockParent(tx, 'event', eventId)
            await tx.memberEvent.delete({
                where: { memberId_eventId: { memberId: req.userId, eventId } }
            })

            // leaving the waitlist frees no seat — only a held one (a
            // confirmed RSVP or an open offer) does, and it's offered to the
            // front of the waitlist, who has to accept it (src/offers.js)
            if (existing.attendanceStatus !== 'rsvped' && existing.attendanceStatus !== 'offered') { return null }
            return offerNext(tx, 'event', eventId)
        })

        res.json({
            message: 'RSVP cancelled',
            offeredTo: promoted
        })
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Officer scans a member's QR. RSVP'd → checked in (+points: official 5,
// social 3, awarded exactly once at the transition to attended). Not RSVP'd
// → waitlisted with a distinct code. Body: { qrToken }
router.post('/:eventId/checkin', requireRole('officer'), async (req, res) => {
    const eventId = parseInt(req.params.eventId)
    if (isNaN(eventId)) { return res.status(400).json({ message: 'Invalid event id' }) }

    const { qrToken } = req.body
    if (!qrToken) { return res.status(400).json({ message: 'qrToken is required' }) }

    let decoded
    try {
        decoded = jwt.verify(qrToken, process.env.QR_SECRET)   // NOT JWT_SECRET
    } catch {
        return res.status(400).json({ message: 'Invalid QR code' })
    }

    try {
        const event = await prisma.event.findUnique({ where: { eventId } })
        if (!event) { return res.status(404).json({ message: 'Event not found' }) }

        const existing = await prisma.memberEvent.findUnique({
            where: { memberId_eventId: { memberId: decoded.id, eventId } }
        })

        if (!existing) {
            // walk-in with no RSVP → waitlist (no points — waitlisting never earns)
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

        // rsvped → attended, points awarded atomically with the transition
        const attendance = await prisma.$transaction(async (tx) => {
            const row = await tx.memberEvent.update({
                where: { memberId_eventId: { memberId: decoded.id, eventId } },
                data: { attendanceStatus: 'attended', offerSentAt: null }
            })
            await tx.member.update({
                where: { userId: decoded.id },
                data: { points: { increment: eventPoints(event.type) } }
            })
            await log({
                actorId: req.userId, action: 'checked_in', targetId: decoded.id, points: eventPoints(event.type),
                details: { kind: 'event', id: eventId, title: event.title, by: 'qr' }
            }, tx)
            return row
        })
        res.json({ code: 'CHECKED_IN', message: `Checked in (+${eventPoints(event.type)} points)`, attendance })
    } catch (err) {
        if (err.code === 'P2003') { return res.status(404).json({ message: 'Event or member not found' }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

export default router
