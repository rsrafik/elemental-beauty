import express from 'express'
import jwt from 'jsonwebtoken'
import prisma from '../prismaClient.js'
import requireRole from '../middleware/requireRole.js'
import { eventPoints } from '../points.js'
import { mountRoster } from './roster.js'
import { acceptOffer, confirmSpot, expireOffers, lockParent, offerNext, startsAt } from '../offers.js'
import { log } from '../activity.js'
import { DUES_ANSWERS, asksDues, duesAnswerProblem, duesLookup, duesOwed, duesUnpaid, settleDues } from '../dues.js'

const router = express.Router()

const EVENT_TYPES = ['official', 'social']
const EVENT_TRACKS = ['members', 'officers', 'open', 'online', 'board', 'jboard']

// The j-board team a j-board event is for — what the form asks in place of a
// seat cap there. Only a j-board event has one. '' or null = the whole of
// j-board.
//
// The board's tracks take no sign-ups, so none of them has a seat cap:
// j-board asks for a team instead, officers and EB board for nothing. The
// routes below hold both rules. Mirrors capacityField in
// frontend/lib/calendar.js.
const UNCAPPED_TRACKS = ['officers', 'board', 'jboard']
const EVENT_TEAMS = ['communication', 'secretary', 'treasury', 'formula', 'social_media']
function readTeam(value) {
    if (value === undefined) { return {} }
    if (value === null || value === '') { return { team: null } }
    if (!EVENT_TEAMS.includes(value)) { return { error: `team must be one of: ${EVENT_TEAMS.join(', ')}` } }
    return { team: value }
}

// Tracks a role never sees: to them these events don't exist. A member sees
// none of the board's — 'board' ("EB board") is everyone from officer up,
// 'officers' is the officers', 'jboard' is j-board's. J-board doesn't see the
// officers'; officers, treasurer and admin see everything. Mirrored for the
// pages in frontend/lib/roles.js (hiddenTracks).
const HIDDEN_TRACKS = {
    member: ['officers', 'board', 'jboard'],
    jboard: ['officers'],
}
const hiddenTracks = (role) => HIDDEN_TRACKS[role] ?? []

// Inside j-board, each member sees their own team's j-board events and the
// ones for all of j-board, never another team's — so the teams' calendars
// stay apart. One with no team yet sees only the all-of-j-board ones.
// Officers, treasurer and admin see every team's. `viewer` is
// { role, team } (viewerOf); a j-board member's team is on their member row.
async function viewerOf(req) {
    if (req.role !== 'jboard') { return { role: req.role, team: null } }
    const member = await prisma.member.findUnique({ where: { userId: req.userId }, select: { jboardTeam: true } })
    return { role: req.role, team: member?.jboardTeam ?? null }
}
const otherTeam = (event, viewer) =>
    viewer.role === 'jboard' && event.track === 'jboard' && event.team != null && event.team !== viewer.team
const hiddenFrom = (event, viewer) => hiddenTracks(viewer.role).includes(event.track) || otherTeam(event, viewer)

// The same rule as a query, for the list.
function visibleWhere(viewer) {
    const where = []
    if (hiddenTracks(viewer.role).length) { where.push({ track: { notIn: hiddenTracks(viewer.role) } }) }
    if (viewer.role === 'jboard') {
        where.push({ OR: [{ track: { not: 'jboard' } }, { team: null }, ...(viewer.team ? [{ team: viewer.team }] : [])] })
    }
    return where
}

// A j-board event an officer, treasurer or admin added is theirs to change:
// j-board can open it and read it, not edit or delete it. `creatorRole` is the
// creator's role now, so one added by someone since made j-board unlocks.
const LOCKING_ROLES = ['officer', 'treasurer', 'admin']
const lockedFor = (event, role, creatorRole) =>
    role === 'jboard' && event.track === 'jboard' && LOCKING_ROLES.includes(creatorRole)

// Who added it, as the list and the event's page return it: the name for the
// details popup, and the role that decides `canEdit`.
const CREATOR = { select: { firstName: true, lastName: true, username: true, member: { select: { role: true } } } }

// The two extras every event reply carries about its creator: their name, and
// whether the person asking may edit it. The nested row itself is dropped.
const RANK_OFFICER = ['officer', 'jboard', 'treasurer', 'admin']
function withCreator({ createdBy, ...event }, role) {
    const name = createdBy ? `${createdBy.firstName} ${createdBy.lastName}`.trim() || createdBy.username : null
    return {
        ...event,
        creatorName: name,
        canEdit: RANK_OFFICER.includes(role) && !lockedFor(event, role, createdBy?.member?.role)
    }
}

// The 403 PUT and DELETE give j-board on a locked event (see lockedFor).
async function refuseLocked(eventId, viewer, res) {
    const event = await prisma.event.findUnique({ where: { eventId }, select: { track: true, team: true, createdBy: CREATOR } })
    if (!event || hiddenFrom(event, viewer)) {
        res.status(404).json({ message: 'Event not found' })
        return true
    }
    if (lockedFor(event, viewer.role, event.createdBy?.member?.role)) {
        res.status(403).json({ message: 'Only whoever added this event can change it' })
        return true
    }
    return false
}

// 'HH:MM' — what <input type="time"> hands back, and what the calendar prints.
const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/

// The links an event's page lists under its photo: [{ title, url }], each an
// http(s) address — one typed without a scheme ('linkedin.com/in/…') gets
// https:// put on the front. A link with no title shows its address instead;
// a row with no address at all is dropped, so an empty box left on the form
// doesn't save. Returns { links } (null for none) or { error }.
const MAX_LINKS = 20
function readLinks(value) {
    if (value === null) { return { links: null } }
    if (!Array.isArray(value)) { return { error: 'links must be a list of { title, url }' } }
    const links = []
    for (const entry of value) {
        const title = String(entry?.title ?? '').trim().slice(0, 100)
        let url = String(entry?.url ?? '').trim()
        if (!url) { continue }
        if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) { url = `https://${url}` }
        let parsed
        try { parsed = new URL(url) } catch { return { error: `${url} isn't a web address` } }
        if (!['http:', 'https:'].includes(parsed.protocol)) { return { error: 'links must be http or https addresses' } }
        links.push({ title, url: parsed.href })
    }
    if (links.length > MAX_LINKS) { return { error: `at most ${MAX_LINKS} links` } }
    return { links: links.length ? links : null }
}

// What someone who hasn't paid dues is charged for it: the year's non-member
// price on a members-only event (`owe` is from duesLookup). Null when they
// owe nothing, or it's open to all.
const duesFor = (event, owe) => asksDues('event', event) ? owe(event.date.toISOString().slice(0, 10)) : null

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

    try {
        where.AND = visibleWhere(await viewerOf(req))
        const owe = await duesLookup(prisma, req.userId)
        const events = await prisma.event.findMany({
            where,
            include: {
                category: { select: { name: true } },
                createdBy: CREATOR,
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
            ...withCreator(event, req.role),
            taken: _count.members,
            mine: members[0]?.attendanceStatus ?? null,
            // unpaid dues: { schoolYear, amount, price } — the card shows the
            // price, the page warns about it (see src/dues.js)
            dues: duesFor(event, owe)
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
            include: { category: { select: { name: true } }, createdBy: CREATOR }
        })
        if (!event) { return res.status(404).json({ message: 'Event not found' }) }
        // a board-only event doesn't exist as far as a member is concerned —
        // 404, not 403, so the reply doesn't confirm there's something there
        if (hiddenFrom(event, await viewerOf(req))) {
            return res.status(404).json({ message: 'Event not found' })
        }

        // Where the person asking stands on it — what /events/view switches
        // on, the same extras a lab's page gets: their status, seats gone,
        // whether they've been asked to confirm, and their place in the queue.
        const [link, taken, owe] = await Promise.all([
            prisma.memberEvent.findUnique({ where: { memberId_eventId: { memberId: req.userId, eventId } } }),
            prisma.memberEvent.count({ where: { eventId, ...TAKEN } }),
            duesLookup(prisma, req.userId)
        ])
        let waitlistPosition = null
        if (link?.attendanceStatus === 'waitlisted') {
            const ahead = await prisma.memberEvent.count({
                where: { eventId, attendanceStatus: 'waitlisted', waitlistedAt: { lt: link.waitlistedAt } }
            })
            waitlistPosition = ahead + 1
        }

        res.json({
            ...withCreator(event, req.role),
            taken,
            mine: link?.attendanceStatus ?? null,
            confirmPending: link?.attendanceStatus === 'rsvped' && Boolean(link.confirmSentAt) && !link.confirmedAt,
            confirmBy: link?.confirmBy ?? null,
            confirmedAt: link?.confirmedAt ?? null,
            waitlistPosition,
            dues: duesFor(event, owe),
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
    const { title, type, track, categoryId, description, date, startTime, location, image, capacity, hideFromEvents } = req.body
    const { links, error: linksError } = readLinks(req.body.links ?? null)
    if (linksError) { return res.status(400).json({ message: linksError }) }
    const { team, error: teamError } = readTeam(req.body.team)
    if (teamError) { return res.status(400).json({ message: teamError }) }
    const forJboard = track === 'jboard'
    const viewer = await viewerOf(req)
    // j-board files for their own team or all of j-board — another team's
    // would vanish off their calendar the moment it saved
    if (forJboard && otherTeam({ track, team: team ?? null }, viewer)) {
        return res.status(403).json({ message: 'You can only add j-board events for your own team' })
    }
    const uncapped = UNCAPPED_TRACKS.includes(track)

    if (!title || !date) {
        return res.status(400).json({ message: 'title and date are required' })
    }
    if (!EVENT_TYPES.includes(type)) {
        return res.status(400).json({ message: 'type must be official or social' })
    }
    if (track !== undefined && !EVENT_TRACKS.includes(track)) {
        return res.status(400).json({ message: `track must be one of: ${EVENT_TRACKS.join(', ')}` })
    }
    if (hideFromEvents !== undefined && typeof hideFromEvents !== 'boolean') {
        return res.status(400).json({ message: 'hideFromEvents must be true or false' })
    }
    // an officer can't file something j-board-only, nor j-board something
    // officers-only — it'd vanish off their own calendar the moment it saved
    if (hiddenTracks(req.role).includes(track)) {
        return res.status(403).json({ message: 'You can\'t add an event to that track' })
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
                // the board's tracks have no seat cap; j-board has a team
                capacity: uncapped ? null : capacity,
                team: forJboard ? team ?? null : null,
                hideFromEvents: hideFromEvents ?? false,
                links,
                createdById: req.userId
            },
            include: { createdBy: CREATOR }
        })
        res.status(201).json(withCreator(event, req.role))
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
        if (hiddenTracks(req.role).includes(req.body.track)) {
            return res.status(403).json({ message: 'You can\'t move an event to that track' })
        }
        data.track = req.body.track
    }
    if (req.body.categoryId !== undefined) { data.categoryId = req.body.categoryId }
    if (req.body.hideFromEvents !== undefined) {
        if (typeof req.body.hideFromEvents !== 'boolean') {
            return res.status(400).json({ message: 'hideFromEvents must be true or false' })
        }
        data.hideFromEvents = req.body.hideFromEvents
    }
    if (req.body.links !== undefined) {
        const { links, error } = readLinks(req.body.links)
        if (error) { return res.status(400).json({ message: error }) }
        data.links = links
    }
    const teamRead = readTeam(req.body.team)
    if (teamRead.error) { return res.status(400).json({ message: teamRead.error }) }
    if (teamRead.team !== undefined) { data.team = teamRead.team }
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
        // one on a track this role can't see doesn't exist for them — the
        // same 404 GET /:id gives, so editing by id can't get round it — and
        // one locked to its creator (lockedFor) is refused
        const viewer = await viewerOf(req)
        if (await refuseLocked(eventId, viewer, res)) { return }
        // a team only on a j-board event, a seat cap only off one — whichever
        // track it ends up on after this edit
        const existing = await prisma.event.findUnique({ where: { eventId }, select: { track: true, team: true } })
        const track = data.track ?? existing.track
        if (UNCAPPED_TRACKS.includes(track)) { data.capacity = null }
        if (track !== 'jboard') { data.team = null }
        if (otherTeam({ track, team: data.team !== undefined ? data.team : existing.team }, viewer)) {
            return res.status(403).json({ message: 'You can only move j-board events to your own team' })
        }
        const event = await prisma.event.update({ where: { eventId }, data, include: { createdBy: CREATOR } })
        res.json(withCreator(event, req.role))
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
        if (await refuseLocked(eventId, await viewerOf(req), res)) { return }
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
        // a board-only event doesn't exist for a member — the same 404
        // GET /:id gives, so signing up by id can't get round it
        if (!event || hiddenFrom(event, await viewerOf(req))) {
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
// → waitlisted with a distinct code.
//
// A members-only event asks after dues the way a lab does: someone unpaid
// comes back DUES_UNPAID, and the officer's answer is the same scan with
// `dues` set (see src/dues.js). Body: { qrToken, dues? }
router.post('/:eventId/checkin', requireRole('officer'), async (req, res) => {
    const eventId = parseInt(req.params.eventId)
    if (isNaN(eventId)) { return res.status(400).json({ message: 'Invalid event id' }) }

    const { qrToken, dues } = req.body
    if (!qrToken) { return res.status(400).json({ message: 'qrToken is required' }) }
    if (dues !== undefined && !DUES_ANSWERS.includes(dues)) {
        return res.status(400).json({ message: `dues must be one of: ${DUES_ANSWERS.join(', ')}` })
    }

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

        const owed = asksDues('event', event)
            ? await duesOwed(prisma, decoded.id, event.date.toISOString().slice(0, 10))
            : null
        if (owed && !dues) { return duesUnpaid(res, decoded.id, owed) }
        const problem = owed && duesAnswerProblem(owed, dues)
        if (problem) { return res.status(400).json({ message: problem }) }

        // rsvped → attended, points awarded atomically with the transition
        const attendance = await prisma.$transaction(async (tx) => {
            if (owed) {
                await settleDues(tx, { owed, dues, memberId: decoded.id, actorId: req.userId, item: { kind: 'event', id: eventId, title: event.title } })
            }
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
        // the treasurer marked them paid while the popup was up — scan again
        if (err.code === 'P2002') { return res.status(409).json({ message: 'Their dues were just marked paid — scan them again' }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

export default router
