import prisma from './prismaClient.js'
import { log } from './activity.js'
import requireRole from './middleware/requireRole.js'
import { requireNotAttendee } from './routes/roster.js'
import { POINTS } from './points.js'
import { clubInstant, clubToday, dateColumn } from './clubTime.js'

// The feedback form for a lab or an event, shared by both the way the roster
// is (roster.js). A member may fill it in once they've been to it:
//
//   lab     checked in (attended) and passed its quiz — a lab with no quiz
//           has nothing to pass, so attending is enough there
//   event   checked in (attended)
//
// and once it's open: when it has ended (endsAt), or earlier if an officer has
// pressed "release feedback form" on the check-in page (feedbackReleased).
// Both are checked here, not only by the pages.
//
// One entry each. The first one earns POINTS.feedback; sending it again edits
// the same entry and earns nothing more. The entry is kept against the member
// so it can be one each and filled back in for them — but nothing that
// reaches staff says who wrote it. The check-in page's list carries the text
// and `name`, and `name` is only ever what the member typed in themselves.
// The first send is written to the activity log as `feedback_sent` — who
// filled it in, for which lab or event, and the point — but never what it
// said, so staff see that someone took the survey without being able to tie
// them to an entry. /account's history still works the point out from the
// entries, which also covers the ones sent before the log line existed.
//
// Mounted on the lab and event routers:
//
//   GET  /:id/feedback/mine     { eligible, open, entry: { body, name } | null, points }
//   PUT  /:id/feedback/mine     { body, name? } — sends or edits theirs;
//                               { entry, awarded } (awarded is 0 on an edit)
//   POST /:id/feedback/asked    the site's "would you like to give feedback?"
//                               popup was shown for this one — it isn't again
//   GET  /:id/feedback          staff: { released, open, endsAt, entries: [{ body, name }] }
//   PUT  /:id/feedback-release  staff: { released } — the check-in page's switch
//
// And GET /api/feedback/pending (feedbackRouter, below): what the site should
// ask the member about when they open it.

// the longest an entry or a name may be
const BODY_MAX = 5000
const NAME_MAX = 100

// The popup only asks about something that ended in the last fortnight, so a
// member isn't asked about labs from last semester. The form itself stays
// open for good.
const ASK_WITHIN_DAYS = 14

// When it's over: its date at its end time, on the club's clock — or, with no
// end time, the end of its day (the member pages call it "happened" from the
// next day too). Null for a draft lab with no date.
export function endsAt(row) {
    if (!row?.date) { return null }
    const day = row.date.toISOString().slice(0, 10)
    if (row.endTime) { return clubInstant(day, row.endTime) }
    const next = new Date(row.date.getTime() + 86_400_000).toISOString().slice(0, 10)
    return clubInstant(next, '00:00')
}

export function feedbackOpen(row, now = new Date()) {
    if (row.feedbackReleased) { return true }
    const end = endsAt(row)
    return end != null && now >= end
}

const KINDS = {
    lab: {
        kindName: 'lab', label: 'Lab', parentName: 'lab', linkName: 'memberLab', feedbackName: 'labFeedback',
        key: 'labId', compound: 'memberId_labId'
    },
    event: {
        kindName: 'event', label: 'Event', parentName: 'event', linkName: 'memberEvent', feedbackName: 'eventFeedback',
        key: 'eventId', compound: 'memberId_eventId'
    }
}

const PARENT_SELECT = { title: true, date: true, endTime: true, published: true, feedbackReleased: true }

// Whether this member may give feedback on it — the row they have on it, and
// for a lab the quiz. `parent` needs `published`, and a lab's `_count`.
function mayGive(kind, parent, link) {
    if (!parent?.published || link?.attendanceStatus !== 'attended') { return false }
    if (kind.kindName === 'lab') {
        return link.quizPassed === true || parent._count.quizQuestions === 0
    }
    return true
}

// { body, name } as sent, trimmed — or { error }
function readEntry(body) {
    const text = typeof body?.body === 'string' ? body.body.trim() : ''
    if (!text) { return { error: 'Write something before sending it' } }
    if (text.length > BODY_MAX) { return { error: `Keep it under ${BODY_MAX} characters` } }
    if (body.name != null && typeof body.name !== 'string') { return { error: 'name must be text' } }
    const name = body.name?.trim() || null
    if (name && name.length > NAME_MAX) { return { error: `Keep the name under ${NAME_MAX} characters` } }
    return { body: text, name }
}

export function mountFeedback(router, kindName) {
    const kind = KINDS[kindName]
    const { label, key, compound } = kind
    const parent = prisma[kind.parentName]
    const link = prisma[kind.linkName]
    const feedback = prisma[kind.feedbackName]
    const staffOnly = [requireRole('officer'), requireNotAttendee('id', kindName)]
    const select = kindName === 'lab'
        ? { ...PARENT_SELECT, _count: { select: { quizQuestions: true } } }
        : PARENT_SELECT
    const badId = (res) => res.status(400).json({ message: `Invalid ${label.toLowerCase()} id` })

    // the parent, their row on it and their entry, all in one go
    const standing = (parentId, memberId) => Promise.all([
        parent.findUnique({ where: { [key]: parentId }, select }),
        link.findUnique({ where: { [compound]: { memberId, [key]: parentId } } }),
        feedback.findUnique({ where: { [compound]: { memberId, [key]: parentId } }, select: { body: true, name: true } })
    ])

    router.get('/:id/feedback/mine', async (req, res) => {
        const parentId = parseInt(req.params.id)
        if (isNaN(parentId)) { return badId(res) }
        try {
            const [row, mine, entry] = await standing(parentId, req.userId)
            if (!row || !row.published) { return res.status(404).json({ message: `${label} not found` }) }
            res.json({
                eligible: mayGive(kind, row, mine),
                open: feedbackOpen(row),
                entry,
                points: POINTS.feedback
            })
        } catch (err) {
            console.error(err.message)
            res.sendStatus(500)
        }
    })

    router.put('/:id/feedback/mine', async (req, res) => {
        const parentId = parseInt(req.params.id)
        if (isNaN(parentId)) { return badId(res) }
        const sent = readEntry(req.body)
        if (sent.error) { return res.status(400).json({ message: sent.error }) }
        try {
            const [row, mine] = await standing(parentId, req.userId)
            if (!row || !row.published) { return res.status(404).json({ message: `${label} not found` }) }
            if (!mayGive(kind, row, mine)) {
                return res.status(403).json({
                    message: kindName === 'lab'
                        ? 'Only someone checked in who has passed its quiz can give feedback on this lab'
                        : 'Only someone checked in can give feedback on this event'
                })
            }
            if (!feedbackOpen(row)) {
                return res.status(403).json({ message: `Feedback opens once the ${label.toLowerCase()} is over` })
            }

            const where = { [compound]: { memberId: req.userId, [key]: parentId } }
            const data = { body: sent.body, name: sent.name }
            // The point goes with the first entry, in the same transaction: a
            // second send finds the row and only edits it. Two sends at once
            // both miss it, and the loser's create fails on the primary key
            // (P2002) — taken back with its point, and answered below.
            const result = await prisma.$transaction(async (tx) => {
                const had = await tx[kind.feedbackName].findUnique({ where, select: { memberId: true } })
                if (had) {
                    const entry = await tx[kind.feedbackName].update({ where, data, select: { body: true, name: true } })
                    return { entry, awarded: 0 }
                }
                const entry = await tx[kind.feedbackName].create({
                    data: { memberId: req.userId, [key]: parentId, ...data },
                    select: { body: true, name: true }
                })
                await tx.member.update({
                    where: { userId: req.userId },
                    data: { points: { increment: POINTS.feedback } }
                })
                // that they sent one, not what it says
                await log({
                    actorId: req.userId,
                    action: 'feedback_sent',
                    targetId: req.userId,
                    points: POINTS.feedback,
                    details: { kind: kindName, id: parentId, title: row.title }
                }, tx)
                return { entry, awarded: POINTS.feedback }
            })
            res.json(result)
        } catch (err) {
            if (err.code === 'P2002') { return res.status(409).json({ message: 'That was sent twice at once. Try again' }) }
            console.error(err.message)
            res.sendStatus(500)
        }
    })

    router.post('/:id/feedback/asked', async (req, res) => {
        const parentId = parseInt(req.params.id)
        if (isNaN(parentId)) { return badId(res) }
        try {
            await link.updateMany({
                where: { memberId: req.userId, [key]: parentId, feedbackAskedAt: null },
                data: { feedbackAskedAt: new Date() }
            })
            res.sendStatus(204)
        } catch (err) {
            console.error(err.message)
            res.sendStatus(500)
        }
    })

    // Everything sent in, newest first. Who sent it is never selected: only
    // the text and the name they chose to give.
    router.get('/:id/feedback', ...staffOnly, async (req, res) => {
        const parentId = parseInt(req.params.id)
        if (isNaN(parentId)) { return badId(res) }
        try {
            const row = await parent.findUnique({ where: { [key]: parentId }, select: PARENT_SELECT })
            if (!row) { return res.status(404).json({ message: `${label} not found` }) }
            const entries = await feedback.findMany({
                where: { [key]: parentId },
                orderBy: { createdAt: 'desc' },
                select: { body: true, name: true }
            })
            res.json({ released: row.feedbackReleased, open: feedbackOpen(row), endsAt: endsAt(row), entries })
        } catch (err) {
            console.error(err.message)
            res.sendStatus(500)
        }
    })

    router.put('/:id/feedback-release', ...staffOnly, async (req, res) => {
        const parentId = parseInt(req.params.id)
        if (isNaN(parentId)) { return badId(res) }
        if (typeof req.body?.released !== 'boolean') { return res.status(400).json({ message: 'released must be true or false' }) }
        try {
            const row = await parent.update({
                where: { [key]: parentId },
                data: { feedbackReleased: req.body.released },
                select: PARENT_SELECT
            })
            res.json({ released: row.feedbackReleased, open: feedbackOpen(row), endsAt: endsAt(row) })
        } catch (err) {
            if (err.code === 'P2025') { return res.status(404).json({ message: `${label} not found` }) }
            console.error(err.message)
            res.sendStatus(500)
        }
    })
}

// What the site asks about when a member opens it: each lab or event they may
// give feedback on, that's open, that they haven't given any on, that they
// haven't been asked about before, and that ended (or was released) in the
// last fortnight. Newest first; the page asks about the first one and marks it
// asked (POST /:id/feedback/asked), so each is asked about once.
export async function pendingFeedback(memberId, now = new Date()) {
    const since = dateColumn(clubToday(new Date(now.getTime() - ASK_WITHIN_DAYS * 86_400_000)))
    const upTo = dateColumn(clubToday(now))
    const fresh = { published: true, date: { gte: since, lte: upTo } }
    const [labRows, eventRows] = await Promise.all([
        prisma.memberLab.findMany({
            where: { memberId, attendanceStatus: 'attended', feedbackAskedAt: null, lab: { ...fresh, feedback: { none: { memberId } } } },
            select: {
                attendanceStatus: true,
                quizPassed: true,
                lab: { select: { labId: true, ...PARENT_SELECT, _count: { select: { quizQuestions: true } } } }
            }
        }),
        prisma.memberEvent.findMany({
            where: { memberId, attendanceStatus: 'attended', feedbackAskedAt: null, event: { ...fresh, feedback: { none: { memberId } } } },
            select: { attendanceStatus: true, event: { select: { eventId: true, ...PARENT_SELECT } } }
        })
    ])
    const labs = labRows
        .filter((row) => mayGive(KINDS.lab, row.lab, row) && feedbackOpen(row.lab, now))
        .map(({ lab }) => ({ kind: 'lab', id: lab.labId, title: lab.title, date: lab.date }))
    const events = eventRows
        .filter((row) => mayGive(KINDS.event, row.event, row) && feedbackOpen(row.event, now))
        .map(({ event }) => ({ kind: 'event', id: event.eventId, title: event.title, date: event.date }))
    return [...labs, ...events].sort((a, b) => b.date - a.date)
}
