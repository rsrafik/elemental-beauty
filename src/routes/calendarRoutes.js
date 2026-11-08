// "Subscribe" on /calendar: the club's calendar in someone's own Google (or
// Apple, or Outlook) calendar, as a live feed rather than a one-off copy.
//
// Each member has one feed address, and it never changes: the link carries
// who they are and nothing else. What's on it — the tracks they picked in the
// popup — lives on their member row (calendarTracks), so changing the picks
// ("edit calendar") changes what their existing subscription shows, with
// nothing new to add on Google's side.
//
// Google fetches the feed itself, with no login, so the feed route is public
// and the signed link is the proof. Every fetch reads the person's role and
// j-board teams fresh and drops any track that role can't see — the same
// rules as GET /api/events (visibleWhere) — so a demotion, a team change or an
// event moved onto a board track reaches their calendar on Google's next
// refresh without anyone touching the link.
//
// Two routers: `default` is the signed-in popup's (mounted behind
// authMiddleware), `feedRouter` is the public feed.

import express from 'express'
import jwt from 'jsonwebtoken'
import prisma from '../prismaClient.js'
import { APP_URL } from '../verification.js'
import { clubToday, dateColumn } from '../clubTime.js'
import { buildCalendar } from '../calendarFeed.js'
import { EVENT_TRACKS, MEETING_TRACKS, TAKEN, WAITING, hiddenTracks, visibleWhere } from './eventRoutes.js'

const router = express.Router()
export const feedRouter = express.Router()

// Tracks a role can see but starts with switched off, as on the calendar's
// key — officers and the treasurer see j-board's only once they ask. Mirrors
// defaultOffTracks in frontend/lib/roles.js.
const DEFAULT_OFF_TRACKS = { officer: ['jboard'], treasurer: ['jboard'] }

// Labs ride the members track, as they do on the calendar grid.
const LAB_TRACK = 'members'

// How far back the feed reaches. Further than this is history nobody's
// calendar needs, and every entry is bytes Google pulls on each refresh.
const MONTHS_BACK = 6

const PURPOSE = 'calendar'

// What goes in front of each title: where the person whose feed it is stands
// on it. An offered spot isn't theirs until they accept it, so it still reads
// as waitlisted; absent (signed up, didn't come) was on the list all the same.
function standingTag(status) {
    if (status == null) { return '[NOT RSVP’D]' }
    if (status === 'waitlisted' || status === 'offered') { return '[WAITLISTED]' }
    return '[RSVP’D]'
}

// The description's first line, counted as the cards count it: seats gone
// plus everyone queued behind them, over the seats there are — so a full
// event with 5 waiting reads '25/20'.
function signedUpLine(taken, waiting, capacity) {
    const count = taken + waiting
    return capacity == null ? `Signed up: ${count}` : `Signed up: ${count}/${capacity}`
}

// Each row's own status and its counts, for buildCalendar's entries:
// `members` is the person's row (at most one), `_count.members` the seats.
const STANDING = (userId) => ({
    members: { where: { memberId: userId }, select: { attendanceStatus: true } },
    _count: { select: { members: { where: TAKEN } } },
})

// The feed token: who it's for and what it's for, and nothing that changes —
// no timestamp (noTimestamp), no expiry, no tracks — so signing it again gives
// the same string and the address Google holds keeps working. Rotating
// JWT_SECRET breaks every feed link; people would have to export again.
//
// It carries `purpose` and no `id`, so it can't be used to sign in:
// authMiddleware refuses any token with a purpose.
export function feedToken(userId) {
    return jwt.sign({ purpose: PURPOSE, uid: userId }, process.env.JWT_SECRET, { noTimestamp: true })
}

function readFeedToken(token) {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        if (decoded.purpose !== PURPOSE || !Number.isInteger(decoded.uid)) { return null }
        return decoded.uid
    } catch {
        return null
    }
}

const availableFor = (role) => EVENT_TRACKS.filter((track) => !hiddenTracks(role).includes(track))

// Whether Google could ever fetch the feed — it can't reach a localhost
// address, so in development the popup says export only works on the live
// site. The link still works for curl.
function reachable(base) {
    try {
        const host = new URL(base).hostname
        return !['localhost', '127.0.0.1', '[::1]', '::1'].includes(host)
    } catch {
        return false
    }
}

// What the popup reads, after a load and after every save.
//   subscribed  whether they've exported it (the button says "edit calendar")
//   tracks      what's picked — saved picks the role can still see, or before
//               the first export, everything it can see bar the defaults off
//   available   every track the role can see: the popup's pills
//   lost        saved picks the role can no longer see, to say so
//   url         the feed address (https), and googleUrl / webcalUrl to add it
function subscriptionReply(req, member) {
    const userId = req.userId
    const available = availableFor(member.role)
    const saved = member.calendarTracks ?? []
    const tracks = member.calendarSubscribed
        ? saved.filter((track) => available.includes(track))
        : available.filter((track) => !(DEFAULT_OFF_TRACKS[member.role] ?? []).includes(track))
    const base = siteOf(req)
    const url = `${base}/api/calendar/feed/${feedToken(userId)}.ics`
    const webcalUrl = url.replace(/^https?:/, 'webcal:')
    return {
        subscribed: member.calendarSubscribed,
        tracks,
        available,
        lost: member.calendarSubscribed ? saved.filter((track) => !available.includes(track)) : [],
        url,
        webcalUrl,
        googleUrl: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl)}`,
        reachable: reachable(base),
    }
}

// Where the site is, for the feed's address and the links inside it: APP_URL,
// which production always sets (server.js won't boot without it), or else
// whatever host the request came in on.
const siteOf = (req) => APP_URL || `${req.protocol}://${req.get('host')}`

const MEMBER_SELECT = { role: true, jboardTeams: true, calendarTracks: true, calendarSubscribed: true }

router.get('/subscription', async (req, res) => {
    try {
        const member = await prisma.member.findUnique({ where: { userId: req.userId }, select: MEMBER_SELECT })
        res.json(subscriptionReply(req, member))
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// The popup's "export" and "save" both land here: the picks are saved and
// the subscription marked as exported.
router.put('/subscription', async (req, res) => {
    const { tracks } = req.body ?? {}
    if (!Array.isArray(tracks) || tracks.length === 0) {
        return res.status(400).json({ message: 'Pick at least one track' })
    }
    const available = availableFor(req.role)
    const unknown = tracks.filter((track) => !EVENT_TRACKS.includes(track))
    if (unknown.length) {
        return res.status(400).json({ message: `tracks must be among: ${EVENT_TRACKS.join(', ')}` })
    }
    if (tracks.some((track) => !available.includes(track))) {
        return res.status(400).json({ message: 'That track isn’t open to your role' })
    }

    try {
        const member = await prisma.member.update({
            where: { userId: req.userId },
            data: { calendarTracks: [...new Set(tracks)], calendarSubscribed: true },
            select: MEMBER_SELECT,
        })
        res.json(subscriptionReply(req, member))
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// "Stop syncing": the feed goes empty, so their copy in Google empties out on
// its next refresh, and the button goes back to "subscribe". Removing the
// calendar from Google itself is theirs to do — we can't reach it.
router.delete('/subscription', async (req, res) => {
    try {
        const member = await prisma.member.update({
            where: { userId: req.userId },
            data: { calendarTracks: [], calendarSubscribed: false },
            select: MEMBER_SELECT,
        })
        res.json(subscriptionReply(req, member))
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// What goes on someone's feed, as buildCalendar's entries. Only the columns
// the file needs: an event's or lab's `image` is a data URL in the row, and
// every Google refresh would otherwise pull it.
//
// Each title carries where they stand on it ([RSVP’D], [WAITLISTED],
// [NOT RSVP’D]) and each description the sign-up count, as of the fetch —
// so it's only as fresh as the calendar app's last refresh.
async function entriesFor(userId, member, site) {
    if (!member?.calendarSubscribed) { return [] }
    const available = availableFor(member.role)
    const tracks = (member.calendarTracks ?? []).filter((track) => available.includes(track))
    if (tracks.length === 0) { return [] }

    const from = new Date(dateColumn(clubToday()))
    from.setUTCMonth(from.getUTCMonth() - MONTHS_BACK)

    const viewer = { role: member.role, teams: member.jboardTeams ?? [] }
    const events = await prisma.event.findMany({
        // a draft event never goes out either, as a lab's doesn't below
        where: { published: true, date: { gte: from }, track: { in: tracks }, AND: visibleWhere(viewer) },
        select: {
            eventId: true, title: true, date: true, startTime: true, endTime: true,
            location: true, description: true, track: true, meetingUrl: true, capacity: true,
            ...STANDING(userId),
        },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    })
    // drafts never go out, not even on a staff feed: a lab only exists for
    // the club once it's published, and publishing needs a date
    const labs = tracks.includes(LAB_TRACK)
        ? await prisma.lab.findMany({
            where: { published: true, date: { gte: from } },
            select: {
                labId: true, title: true, date: true, startTime: true, endTime: true,
                location: true, description: true, capacity: true,
                ...STANDING(userId),
            },
            orderBy: { date: 'asc' },
        })
        : []

    // who's waiting on each, asked of the rows just found
    const [labQueues, eventQueues] = await Promise.all([
        labs.length
            ? prisma.memberLab.groupBy({ by: ['labId'], where: { ...WAITING, labId: { in: labs.map((lab) => lab.labId) } }, _count: true })
            : [],
        events.length
            ? prisma.memberEvent.groupBy({ by: ['eventId'], where: { ...WAITING, eventId: { in: events.map((event) => event.eventId) } }, _count: true })
            : [],
    ])
    const labWaiting = new Map(labQueues.map((queue) => [queue.labId, queue._count]))
    const eventWaiting = new Map(eventQueues.map((queue) => [queue.eventId, queue._count]))

    const day = (date) => date.toISOString().slice(0, 10)
    const titled = (row) => `${standingTag(row.members[0]?.attendanceStatus)} ${row.title}`
    const described = (row, waiting, ...rest) =>
        [signedUpLine(row._count.members, waiting, row.capacity), ...rest].filter(Boolean).join('\n\n')
    return [
        ...labs.map((lab) => ({
            uid: `lab-${lab.labId}`,
            title: titled(lab),
            day: day(lab.date),
            startTime: lab.startTime,
            endTime: lab.endTime,
            location: lab.location,
            description: described(lab, labWaiting.get(lab.labId) ?? 0, lab.description),
            url: `${site}/labs/view?id=${lab.labId}`,
        })),
        ...events.map((event) => {
            // the meeting link only where the calendar's "join" pill shows one
            const join = MEETING_TRACKS.includes(event.track) && event.meetingUrl ? `Join: ${event.meetingUrl}` : null
            return {
                uid: `event-${event.eventId}`,
                title: titled(event),
                day: day(event.date),
                startTime: event.startTime,
                endTime: event.endTime,
                location: event.location,
                description: described(event, eventWaiting.get(event.eventId) ?? 0, event.description, join),
                url: `${site}/events/view?id=${event.eventId}`,
            }
        }),
    ]
}

// The feed itself, for Google to fetch. A link that isn't ours is a 404. One
// that's ours but whose person or membership is gone gets an empty calendar,
// not an error: an error leaves Google showing what it last had — which can
// include board meetings and their links — while an empty feed clears it.
//
// `:file` rather than `:token.ics`: the token is a JWT, full of dots, and the
// router would split it on them.
feedRouter.get('/:file', async (req, res) => {
    const userId = readFeedToken(req.params.file.replace(/\.ics$/, ''))
    if (userId == null) { return res.sendStatus(404) }

    try {
        const member = await prisma.member.findUnique({ where: { userId }, select: MEMBER_SELECT })
        const body = buildCalendar(await entriesFor(userId, member, siteOf(req)))
        res.set({
            'Content-Type': 'text/calendar; charset=utf-8',
            'Content-Disposition': 'inline; filename="elemental-beauty.ics"',
            // someone's own calendar: no shared cache may keep it
            'Cache-Control': 'private, max-age=300',
        })
        res.send(body)
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

export default router
