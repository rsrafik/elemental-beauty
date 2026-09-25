import express from 'express'
import jwt from 'jsonwebtoken'
import prisma from '../prismaClient.js'
import requireRole from '../middleware/requireRole.js'
import { POINTS } from '../points.js'
import { mountRoster } from './roster.js'
import { acceptOffer, confirmSpot, expireOffers, offerNext } from '../offers.js'

const router = express.Router()
const RANK_OFFICER = ['officer', 'jboard', 'treasurer', 'admin']

// Preview fields — what a member sees BEFORE passing the quiz
const PREVIEW_SELECT = {
    labId: true, title: true, date: true, startTime: true, location: true,
    description: true, image: true, capacity: true, published: true
}

// 'HH:MM' — what <input type="time"> hands back, same rule as events.
const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/

// The quiz as a member sees it: questions and options in a stable order, and
// never isCorrect — the answer key stays server-side.
const QUIZ_SELECT = {
    orderBy: { questionId: 'asc' },
    select: {
        questionId: true,
        question: true,
        options: {
            orderBy: { optionId: 'asc' },
            select: { optionId: true, answerText: true }
        }
    }
}

// ---- member-visible reads ----

// Seats spoken for. A waitlisted row is NOT one of them — that's the whole
// point of the waitlist — so the count is what fills the cap and nothing else.
// An open waitlist offer holds a seat too (see src/offers.js).
const TAKEN = { attendanceStatus: { in: ['rsvped', 'attended', 'offered'] } }

// List labs. Always preview fields — full content is unlocked per-lab.
// ?when=upcoming|past derived against today at query time, never stored.
//
// Every row carries two things the cards can't work out for themselves: how
// many seats are gone, and where the person asking stands on it. Both come off
// the junction table in the same query rather than as a request per card.
router.get('/', async (req, res) => {
    const { when } = req.query

    const where = {}
    if (when === 'upcoming') { where.date = { gte: new Date() } }
    if (when === 'past') { where.date = { lt: new Date() } }
    // a lab that's only ever been saved as a draft doesn't exist for members
    if (!RANK_OFFICER.includes(req.role)) { where.published = true }

    try {
        const labs = await prisma.lab.findMany({
            where,
            select: {
                ...PREVIEW_SELECT,
                // at most one row — the pair is the primary key
                members: {
                    where: { memberId: req.userId },
                    select: { attendanceStatus: true, quizPassed: true }
                },
                _count: { select: { members: { where: TAKEN } } },
                ...(RANK_OFFICER.includes(req.role) ? { draft: true } : {})
            },
            orderBy: { date: when === 'past' ? 'desc' : 'asc' }
        })

        res.json(labs.map(({ members, _count, draft, ...lab }) => ({
            ...lab,
            // officers: whether there are unpublished edits waiting on it
            hasDraft: draft != null,
            // the true total, this person included — the card doesn't have to
            // add itself back in
            taken: _count.members,
            // null when they have nothing to do with it
            mine: members[0]?.attendanceStatus ?? null,
            quizPassed: members[0]?.quizPassed ?? null
        })))
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Full content only for officers+ or members who passed this lab's quiz (100%).
//
// Every answer also says where the person asking stands on the lab, which is
// what the member view switches on: `mine` (their attendance status, or null),
// `quizPassed`, `taken` seats, and — while they're waitlisted — how many places
// from the front of the queue they are (1 = next in line for a seat).
//
// Checked in but not passed yet is the one in-between case: the content is
// still locked, but the quiz questions come along so there's something to take.
router.get('/:id', async (req, res) => {
    const labId = parseInt(req.params.id)
    if (isNaN(labId)) { return res.status(400).json({ message: 'Invalid lab id' }) }

    try {
        const link = await prisma.memberLab.findUnique({
            where: { memberId_labId: { memberId: req.userId, labId } }
        })
        const officer = RANK_OFFICER.includes(req.role)
        const unlocked = officer || link?.quizPassed === true
        const quizOpen = !unlocked && link?.attendanceStatus === 'attended'

        const lab = unlocked
            ? await prisma.lab.findUnique({
                where: { labId },
                include: { lessons: true, quizQuestions: QUIZ_SELECT }
            })
            : await prisma.lab.findUnique({
                where: { labId },
                select: { ...PREVIEW_SELECT, ...(quizOpen ? { quizQuestions: QUIZ_SELECT } : {}) }
            })
        if (!lab || (!lab.published && !officer)) { return res.status(404).json({ message: 'Lab not found' }) }

        const taken = await prisma.memberLab.count({ where: { labId, ...TAKEN } })

        // everyone who joined the queue before this person, plus them
        let waitlistPosition = null
        if (link?.attendanceStatus === 'waitlisted') {
            const ahead = await prisma.memberLab.count({
                where: {
                    labId,
                    attendanceStatus: 'waitlisted',
                    waitlistedAt: { lt: link.waitlistedAt }
                }
            })
            waitlistPosition = ahead + 1
        }

        // the file itself is its own request (GET /:id/lesson) — this only says
        // whether there is one
        // the drafts are the officers' business — a member who passed gets the
        // full row but not what's still being worked on
        const { lessonPdfName, draft, quizDraft, ...rest } = lab
        res.json({
            unlocked,
            ...rest,
            ...(officer ? { draft: draft ?? null } : {}),
            // the officer editor names the file it already has
            ...(officer ? { lessonPdfName } : {}),
            hasLesson: Boolean(lessonPdfName),
            taken,
            mine: link?.attendanceStatus ?? null,
            quizPassed: link?.quizPassed ?? null,
            // asked to confirm their spot (the check-in page's "confirmation")
            // and hasn't yet — the lab's page offers the button
            confirmPending: link?.attendanceStatus === 'rsvped' && Boolean(link.confirmSentAt) && !link.confirmedAt,
            confirmBy: link?.confirmBy ?? null,
            waitlistPosition
        })
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// The lesson PDF, for the same people who can see the rest of the full lab:
// officers, and members who've passed its quiz. Sent inline so a browser that
// opens the URL directly shows it rather than downloading it.
router.get('/:id/lesson', async (req, res) => {
    const labId = parseInt(req.params.id)
    if (isNaN(labId)) { return res.status(400).json({ message: 'Invalid lab id' }) }

    try {
        if (!RANK_OFFICER.includes(req.role)) {
            const link = await prisma.memberLab.findUnique({
                where: { memberId_labId: { memberId: req.userId, labId } }
            })
            if (link?.quizPassed !== true) {
                return res.status(403).json({ message: 'Pass the lab quiz to open its lesson' })
            }
        }

        const lab = await prisma.lab.findUnique({
            where: { labId },
            select: { lessonPdf: true, lessonPdfName: true }
        })
        if (!lab?.lessonPdf) { return res.status(404).json({ message: 'This lab has no lesson yet' }) }

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Length': lab.lessonPdf.length,
            // the plain name for old clients, the RFC 5987 one for anything
            // with spaces or accents in it
            'Content-Disposition': `inline; filename="lesson.pdf"; filename*=UTF-8''${encodeURIComponent(lab.lessonPdfName)}`,
            'Cache-Control': 'private, no-store'
        })
        res.end(Buffer.from(lab.lessonPdf))
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// ---- officer+ content management ----

// Upload (or replace) a lab's lesson. The body is the PDF itself, sent as
// application/pdf, with the original file name in X-Filename — no multipart
// parsing to pull in for one file. Capped well above any lesson handout.
const LESSON_LIMIT = '25mb'

router.put('/:id/lesson', requireRole('officer'), express.raw({ type: 'application/pdf', limit: LESSON_LIMIT }), async (req, res) => {
    const labId = parseInt(req.params.id)
    if (isNaN(labId)) { return res.status(400).json({ message: 'Invalid lab id' }) }

    const bytes = req.body
    // every PDF starts with this signature; anything else isn't one, whatever
    // its Content-Type says
    if (!Buffer.isBuffer(bytes) || bytes.subarray(0, 5).toString('latin1') !== '%PDF-') {
        return res.status(400).json({ message: 'Send the lesson as a PDF (Content-Type: application/pdf)' })
    }
    // URL-encoded by the client, since a header can't carry accents as-is
    let name = 'lesson.pdf'
    try { name = decodeURIComponent(req.get('X-Filename') || name) } catch {}
    name = name.slice(0, 200)

    try {
        await prisma.lab.update({
            where: { labId },
            data: { lessonPdf: bytes, lessonPdfName: name },
            select: { labId: true }
        })
        res.json({ message: 'Lesson uploaded', lessonPdfName: name, size: bytes.length })
    } catch (err) {
        if (err.code === 'P2025') { return res.status(404).json({ message: 'Lab not found' }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

router.delete('/:id/lesson', requireRole('officer'), async (req, res) => {
    const labId = parseInt(req.params.id)
    if (isNaN(labId)) { return res.status(400).json({ message: 'Invalid lab id' }) }

    try {
        await prisma.lab.update({
            where: { labId },
            data: { lessonPdf: null, lessonPdfName: null },
            select: { labId: true }
        })
        res.json({ message: 'Lesson removed' })
    } catch (err) {
        if (err.code === 'P2025') { return res.status(404).json({ message: 'Lab not found' }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

// The fields the edit page sends, checked and turned into a Prisma `data`
// object. Only what the body actually carries is touched, so a partial save
// leaves the rest alone. Returns { data } or { error }.
const TEXT_FIELDS = ['title', 'location', 'description', 'image', 'ingredients', 'equipment', 'safetyNote', 'instructions']

function labData(body) {
    const data = {}
    for (const field of TEXT_FIELDS) {
        if (body[field] !== undefined) { data[field] = body[field] === '' && field !== 'title' ? null : body[field] }
    }
    if (body.startTime !== undefined) {
        if (body.startTime && !TIME.test(body.startTime)) { return { error: 'startTime must be HH:MM' } }
        data.startTime = body.startTime || null
    }
    // null clears it, which only a draft can get away with
    if (body.date !== undefined) {
        if (body.date === null || body.date === '') {
            data.date = null
        } else {
            const labDate = new Date(body.date)
            if (isNaN(labDate.getTime())) { return { error: 'date must be a valid date (YYYY-MM-DD)' } }
            data.date = labDate
        }
    }
    // null (or left blank) = unlimited seats
    if (body.capacity !== undefined) {
        if (body.capacity !== null && (!Number.isInteger(body.capacity) || body.capacity < 1)) {
            return { error: 'capacity must be a positive integer, or null for unlimited' }
        }
        data.capacity = body.capacity
    }
    return { data }
}

// Body: the lab's fields, plus `published` — false is "save draft", which
// keeps it off the members' pages until it's published. A draft only needs a
// title; a published lab needs its date too.
// The prelab handout — uploaded on the check-in page, attached to the
// confirmation emails (src/offers.js). Same shape as the lesson: the PDF as the
// request body, its name in X-Filename. Officers can read it back to check it.
router.get('/:id/prelab', requireRole('officer'), async (req, res) => {
    const labId = parseInt(req.params.id)
    if (isNaN(labId)) { return res.status(400).json({ message: 'Invalid lab id' }) }
    try {
        const lab = await prisma.lab.findUnique({ where: { labId }, select: { prelabPdf: true, prelabPdfName: true } })
        if (!lab?.prelabPdf) { return res.status(404).json({ message: 'This lab has no prelab yet' }) }
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Length': lab.prelabPdf.length,
            'Content-Disposition': `inline; filename="prelab.pdf"; filename*=UTF-8''${encodeURIComponent(lab.prelabPdfName)}`,
            'Cache-Control': 'private, no-store'
        })
        res.end(Buffer.from(lab.prelabPdf))
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

router.put('/:id/prelab', requireRole('officer'), express.raw({ type: 'application/pdf', limit: LESSON_LIMIT }), async (req, res) => {
    const labId = parseInt(req.params.id)
    if (isNaN(labId)) { return res.status(400).json({ message: 'Invalid lab id' }) }
    const bytes = req.body
    if (!Buffer.isBuffer(bytes) || bytes.subarray(0, 5).toString('latin1') !== '%PDF-') {
        return res.status(400).json({ message: 'Send the prelab as a PDF (Content-Type: application/pdf)' })
    }
    let name = 'prelab.pdf'
    try { name = decodeURIComponent(req.get('X-Filename') || name) } catch {}
    name = name.slice(0, 200)
    try {
        await prisma.lab.update({ where: { labId }, data: { prelabPdf: bytes, prelabPdfName: name }, select: { labId: true } })
        res.json({ message: 'Prelab uploaded', prelabPdfName: name, size: bytes.length })
    } catch (err) {
        if (err.code === 'P2025') { return res.status(404).json({ message: 'Lab not found' }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

router.delete('/:id/prelab', requireRole('officer'), async (req, res) => {
    const labId = parseInt(req.params.id)
    if (isNaN(labId)) { return res.status(400).json({ message: 'Invalid lab id' }) }
    try {
        await prisma.lab.update({ where: { labId }, data: { prelabPdf: null, prelabPdfName: null }, select: { labId: true } })
        res.json({ message: 'Prelab removed' })
    } catch (err) {
        if (err.code === 'P2025') { return res.status(404).json({ message: 'Lab not found' }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

// A member confirming their spot from the lab's page rather than the email.
router.post('/:labId/confirm', async (req, res) => {
    const labId = parseInt(req.params.labId)
    if (isNaN(labId)) { return res.status(400).json({ message: 'Invalid lab id' }) }
    try {
        const result = await confirmSpot('lab', labId, req.userId)
        if (result.status === 'gone') { return res.status(404).json({ message: 'You have no spot to confirm' }) }
        res.json({ message: 'Spot confirmed', ...result })
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

router.post('/', requireRole('officer'), async (req, res) => {
    const publishing = req.body.published !== false
    if (!req.body.title) {
        return res.status(400).json({ message: 'title is required' })
    }
    const { data, error } = labData(req.body)
    if (error) { return res.status(400).json({ message: error }) }
    if (publishing && !data.date) {
        return res.status(400).json({ message: 'a published lab needs a date' })
    }

    try {
        const lab = await prisma.lab.create({
            data: { ...data, published: req.body.published !== false }
        })
        res.status(201).json(lab)
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Partial update. How a save lands depends on the lab:
//
//   published: true    the fields go onto the lab, it goes (or stays) live,
//                      and any waiting draft is cleared — it's been published
//   published: false   on a lab members can't see yet, the same but it stays
//                      hidden. On a live lab it can't be the row itself —
//                      people are signed up to what it says — so the fields
//                      are parked in `draft` and the live lab is untouched.
//   discardDraft       throws the parked edits away
//   neither            a plain edit, as before
router.put('/:id', requireRole('officer'), async (req, res) => {
    const labId = parseInt(req.params.id)
    if (isNaN(labId)) { return res.status(400).json({ message: 'Invalid lab id' }) }

    const { data, error } = labData(req.body)
    if (error) { return res.status(400).json({ message: error }) }
    if (data.title !== undefined && !String(data.title).trim()) {
        return res.status(400).json({ message: 'title cannot be empty' })
    }

    try {
        const current = await prisma.lab.findUnique({ where: { labId }, select: { published: true, date: true } })
        if (!current) { return res.status(404).json({ message: 'Lab not found' }) }

        // whatever a lab ends up live with has to have a date on it
        const liveAfter = req.body.published === true || (current.published && req.body.published !== false && req.body.discardDraft !== true)
        const dateAfter = data.date !== undefined ? data.date : current.date
        if (liveAfter && !dateAfter) {
            return res.status(400).json({ message: 'a published lab needs a date' })
        }

        let update = data
        if (req.body.discardDraft === true) {
            update = { draft: null }
        } else if (req.body.published === true) {
            update = { ...data, published: true, draft: null }
        } else if (req.body.published === false) {
            update = current.published
                // stored as the body was sent, so the editor can load it back
                ? { draft: Object.fromEntries(
                    [...TEXT_FIELDS, 'startTime', 'date', 'capacity']
                        .filter((field) => req.body[field] !== undefined)
                        .map((field) => [field, req.body[field]])
                ) }
                : { ...data, published: false }
        }

        const lab = await prisma.lab.update({ where: { labId }, data: update })
        res.json(lab)
    } catch (err) {
        if (err.code === 'P2025') { return res.status(404).json({ message: 'Lab not found' }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

router.delete('/:id', requireRole('officer'), async (req, res) => {
    const labId = parseInt(req.params.id)
    if (isNaN(labId)) { return res.status(400).json({ message: 'Invalid lab id' }) }

    try {
        // cascades to lessons, quiz questions/options, member_lab
        await prisma.lab.delete({ where: { labId } })
        res.json({ message: 'Lab deleted' })
    } catch (err) {
        if (err.code === 'P2025') { return res.status(404).json({ message: 'Lab not found' }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

router.post('/:labId/lessons', requireRole('officer'), async (req, res) => {
    const labId = parseInt(req.params.labId)
    if (isNaN(labId)) { return res.status(400).json({ message: 'Invalid lab id' }) }

    const { title, explanation } = req.body
    if (!title) { return res.status(400).json({ message: 'title is required' }) }

    try {
        const lesson = await prisma.labLesson.create({
            data: { labId, title, explanation }
        })
        res.status(201).json(lesson)
    } catch (err) {
        if (err.code === 'P2003') { return res.status(404).json({ message: 'Lab not found' }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Create a quiz question WITH its options in one transaction — the deferred
// DB trigger checks "at least one correct option" at COMMIT, so these inserts
// must land together or not at all.
router.post('/:labId/quiz', requireRole('officer'), async (req, res) => {
    const labId = parseInt(req.params.labId)
    if (isNaN(labId)) { return res.status(400).json({ message: 'Invalid lab id' }) }

    const { question, options } = req.body   // options: [{ answerText, isCorrect }, ...]
    if (!question || !Array.isArray(options) || options.length === 0) {
        return res.status(400).json({ message: 'question and a non-empty options array are required' })
    }
    if (options.some(o => !o.answerText)) {
        return res.status(400).json({ message: 'every option needs an answerText' })
    }
    if (!options.some(o => o.isCorrect === true)) {
        return res.status(400).json({ message: 'at least one option must be marked correct' })
    }

    try {
        const created = await prisma.$transaction(async (tx) => {
            const q = await tx.labQuizQuestion.create({
                data: { labId, question }
            })
            await tx.quizAnswerOption.createMany({
                data: options.map(o => ({
                    questionId: q.questionId,
                    answerText: o.answerText,
                    isCorrect: o.isCorrect === true
                }))
            })
            return q
        })
        res.status(201).json(created)
    } catch (err) {
        if (err.code === 'P2003') { return res.status(404).json({ message: 'Lab not found' }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

// The quiz editor's view of the quiz: every question with its answer key,
// plus the unpublished draft if there is one (which is what the editor opens
// on, since it's the newer of the two).
router.get('/:labId/quiz/edit', requireRole('officer'), async (req, res) => {
    const labId = parseInt(req.params.labId)
    if (isNaN(labId)) { return res.status(400).json({ message: 'Invalid lab id' }) }

    try {
        const lab = await prisma.lab.findUnique({
            where: { labId },
            select: {
                labId: true,
                title: true,
                quizDraft: true,
                quizQuestions: {
                    orderBy: { questionId: 'asc' },
                    select: {
                        question: true,
                        options: {
                            orderBy: { optionId: 'asc' },
                            select: { answerText: true, isCorrect: true }
                        }
                    }
                }
            }
        })
        if (!lab) { return res.status(404).json({ message: 'Lab not found' }) }
        res.json({
            labId: lab.labId,
            title: lab.title,
            questions: lab.quizQuestions,
            draft: lab.quizDraft
        })
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Save the whole quiz at once. Body: { questions: [{ question, options:
// [{ answerText, isCorrect }] }], publish }.
//
// A draft is kept as it was typed — half-written questions and all — and
// members never see it. Publishing swaps it in for the live questions, so it
// has to be a quiz someone can take: every question worded, at least two
// answers, and exactly one of them right (members pick one answer each, and
// grading wants the picks to match the key exactly).
router.put('/:labId/quiz', requireRole('officer'), async (req, res) => {
    const labId = parseInt(req.params.labId)
    if (isNaN(labId)) { return res.status(400).json({ message: 'Invalid lab id' }) }

    const { questions, publish } = req.body
    if (!Array.isArray(questions)) {
        return res.status(400).json({ message: 'questions must be an array' })
    }
    const clean = questions.map((q) => ({
        question: String(q?.question ?? '').trim(),
        options: (Array.isArray(q?.options) ? q.options : []).map((o) => ({
            answerText: String(o?.answerText ?? '').trim(),
            isCorrect: o?.isCorrect === true
        }))
    }))

    try {
        const lab = await prisma.lab.findUnique({ where: { labId }, select: { labId: true } })
        if (!lab) { return res.status(404).json({ message: 'Lab not found' }) }

        if (publish !== true) {
            await prisma.lab.update({ where: { labId }, data: { quizDraft: clean } })
            return res.json({ message: 'Draft saved' })
        }

        // blank answer boxes are just unused slots
        const live = clean.map((q) => ({ ...q, options: q.options.filter((o) => o.answerText) }))
        for (const [i, q] of live.entries()) {
            const n = i + 1
            if (!q.question) { return res.status(400).json({ message: `Question ${n} needs wording` }) }
            if (q.options.length < 2) { return res.status(400).json({ message: `Question ${n} needs at least two answers` }) }
            if (q.options.filter((o) => o.isCorrect).length !== 1) {
                return res.status(400).json({ message: `Question ${n} needs exactly one correct answer ticked` })
            }
        }

        await prisma.$transaction(async (tx) => {
            // options cascade with their question
            await tx.labQuizQuestion.deleteMany({ where: { labId } })
            for (const q of live) {
                const created = await tx.labQuizQuestion.create({ data: { labId, question: q.question } })
                await tx.quizAnswerOption.createMany({
                    data: q.options.map((o) => ({ questionId: created.questionId, ...o }))
                })
            }
            await tx.lab.update({ where: { labId }, data: { quizDraft: null } })
        })
        res.json({ message: 'Quiz published', count: live.length })
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Discard: throw away the quiz's unpublished draft.
router.delete('/:labId/quiz/draft', requireRole('officer'), async (req, res) => {
    const labId = parseInt(req.params.labId)
    if (isNaN(labId)) { return res.status(400).json({ message: 'Invalid lab id' }) }
    try {
        await prisma.lab.update({ where: { labId }, data: { quizDraft: null }, select: { labId: true } })
        res.json({ message: 'Draft discarded' })
    } catch (err) {
        if (err.code === 'P2025') { return res.status(404).json({ message: 'Lab not found' }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

// The check-in page's roster and its by-hand buttons (see roster.js).
mountRoster(router, {
    kindName: 'lab',
    parentName: 'lab',
    linkName: 'memberLab',
    key: 'labId',
    compound: 'memberId_labId',
    points: () => POINTS.lab,
    label: 'Lab'
})

// ---- member actions ----

// RSVP is capped at the lab's capacity. When full, the member goes on the
// ONLINE waitlist (same waitlisted status the door uses) and is auto-promoted
// to rsvped if a seat opens (see DELETE /rsvp below).
router.post('/:labId/rsvp', async (req, res) => {
    const labId = parseInt(req.params.labId)
    if (isNaN(labId)) { return res.status(400).json({ message: 'Invalid lab id' }) }

    try {
        const lab = await prisma.lab.findUnique({ where: { labId } })
        if (!lab || !lab.published) { return res.status(404).json({ message: 'Lab not found' }) }

        const existing = await prisma.memberLab.findUnique({
            where: { memberId_labId: { memberId: req.userId, labId } }
        })
        if (existing) {
            // pressing the button while holding an offer accepts it
            if (existing.attendanceStatus === 'offered') {
                await acceptOffer('lab', labId, req.userId)
                return res.status(201).json({ code: 'ACCEPTED', message: 'Spot accepted — you\'re signed up' })
            }
            if (existing.attendanceStatus === 'waitlisted') {
                return res.status(202).json({ code: 'ALREADY_WAITLISTED', message: 'You are already on the waitlist' })
            }
            return res.json({ code: 'ALREADY_RSVPED', message: 'You are already RSVP\'d', rsvp: existing })
        }

        // count + create inside one transaction so two simultaneous RSVPs
        // can't both grab the last seat
        const result = await prisma.$transaction(async (tx) => {
            const seatsTaken = await tx.memberLab.count({
                where: { labId, ...TAKEN }
            })

            // no capacity = unlimited seats
            if (lab.capacity == null || seatsTaken < lab.capacity) {
                const rsvp = await tx.memberLab.create({
                    data: { memberId: req.userId, labId }   // status defaults to 'rsvped'
                })
                return { code: 'RSVPED', rsvp }
            }

            const rsvp = await tx.memberLab.create({
                data: {
                    memberId: req.userId,
                    labId,
                    attendanceStatus: 'waitlisted',
                    waitlistedAt: new Date()
                }
            })
            return { code: 'WAITLISTED', rsvp }
        })

        if (result.code === 'WAITLISTED') {
            // someone waiting is what makes missed confirmation deadlines
            // count — see enforceConfirmations in src/offers.js
            expireOffers().catch((err) => console.error(`Offer sweep failed: ${err.message}`))
            return res.status(202).json({
                code: 'WAITLISTED',
                message: 'Lab is full — you are on the waitlist and will be offered a spot if one opens',
                rsvp: result.rsvp
            })
        }
        res.status(201).json({ code: 'RSVPED', message: 'RSVP confirmed', rsvp: result.rsvp })
    } catch (err) {
        if (err.code === 'P2003') { return res.status(404).json({ message: 'Lab not found' }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Un-RSVP (or turn down an offer). If a held seat opens, the oldest
// waitlisted member is offered it in the same transaction — see src/offers.js.
router.delete('/:labId/rsvp', async (req, res) => {
    const labId = parseInt(req.params.labId)
    if (isNaN(labId)) { return res.status(400).json({ message: 'Invalid lab id' }) }

    try {
        const existing = await prisma.memberLab.findUnique({
            where: { memberId_labId: { memberId: req.userId, labId } }
        })
        if (!existing) { return res.status(404).json({ message: 'You have no RSVP for this lab' }) }
        if (existing.attendanceStatus === 'attended') {
            return res.status(409).json({ message: 'You are already checked in and cannot un-RSVP' })
        }

        const promoted = await prisma.$transaction(async (tx) => {
            await tx.memberLab.delete({
                where: { memberId_labId: { memberId: req.userId, labId } }
            })

            // leaving the waitlist frees no seat — only a held one (a
            // confirmed RSVP or an open offer) does, and it's offered to the
            // front of the waitlist, who has to accept it (src/offers.js)
            if (existing.attendanceStatus !== 'rsvped' && existing.attendanceStatus !== 'offered') { return null }
            return offerNext(tx, 'lab', labId)
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

// Officer scans a member's QR. RSVP'd → checked in. Not RSVP'd → waitlisted,
// with a distinct code so the scanner UI can show it. Waitlisted members are
// admitted later via /admit-waitlist, not by re-scanning.
router.post('/:labId/checkin', requireRole('officer'), async (req, res) => {
    const labId = parseInt(req.params.labId)
    if (isNaN(labId)) { return res.status(400).json({ message: 'Invalid lab id' }) }

    const { qrToken } = req.body
    if (!qrToken) { return res.status(400).json({ message: 'qrToken is required' }) }

    let decoded
    try {
        decoded = jwt.verify(qrToken, process.env.QR_SECRET)   // NOT JWT_SECRET
    } catch {
        return res.status(400).json({ message: 'Invalid QR code' })
    }

    try {
        const existing = await prisma.memberLab.findUnique({
            where: { memberId_labId: { memberId: decoded.id, labId } }
        })

        if (!existing) {
            // walk-in with no RSVP → waitlist, timestamped for oldest-first admission
            const waitlisted = await prisma.memberLab.create({
                data: {
                    memberId: decoded.id,
                    labId,
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

        // rsvped → attended; lab points awarded atomically with the transition
        // (only this transition earns — rescans hit the guards above)
        const [attendance] = await prisma.$transaction([
            prisma.memberLab.update({
                where: { memberId_labId: { memberId: decoded.id, labId } },
                data: { attendanceStatus: 'attended' }
            }),
            prisma.member.update({
                where: { userId: decoded.id },
                data: { points: { increment: POINTS.lab } }
            })
        ])
        res.json({ code: 'CHECKED_IN', message: `Checked in (+${POINTS.lab} points)`, attendance })
    } catch (err) {
        if (err.code === 'P2003') { return res.status(404).json({ message: 'Lab or member not found' }) }
        console.error(err.message)
        res.sendStatus(500)
    }
})

// The button: once the lab starts, admit waitlisted walk-ins oldest-first
// into whatever seats the no-shows left open (capacity minus attended).
router.post('/:labId/admit-waitlist', requireRole('officer'), async (req, res) => {
    const labId = parseInt(req.params.labId)
    if (isNaN(labId)) { return res.status(400).json({ message: 'Invalid lab id' }) }

    try {
        const lab = await prisma.lab.findUnique({ where: { labId } })
        if (!lab) { return res.status(404).json({ message: 'Lab not found' }) }

        // null = unlimited, which admits everyone waiting
        let seatsLeft = null
        if (lab.capacity != null) {
            const attendedCount = await prisma.memberLab.count({
                where: { labId, attendanceStatus: 'attended' }
            })
            seatsLeft = lab.capacity - attendedCount
            if (seatsLeft <= 0) {
                return res.json({ admitted: [], seatsLeft: 0, message: 'Lab is already at capacity' })
            }
        }

        const toAdmit = await prisma.memberLab.findMany({
            where: { labId, attendanceStatus: 'waitlisted' },
            orderBy: { waitlistedAt: 'asc' },            // oldest to newest
            ...(seatsLeft !== null ? { take: seatsLeft } : {})   // never over capacity
        })

        const memberIds = toAdmit.map(w => w.memberId)
        await prisma.$transaction([
            prisma.memberLab.updateMany({
                where: { labId, memberId: { in: memberIds } },
                data: { attendanceStatus: 'attended' }
            }),
            // admitted = attended, so they earn lab points like anyone else
            prisma.member.updateMany({
                where: { userId: { in: memberIds } },
                data: { points: { increment: POINTS.lab } }
            })
        ])

        const stillWaitlisted = await prisma.memberLab.count({
            where: { labId, attendanceStatus: 'waitlisted' }
        })

        res.json({
            admitted: memberIds,
            pointsEach: POINTS.lab,
            seatsLeft: seatsLeft === null ? null : seatsLeft - memberIds.length,
            stillWaitlisted
        })
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Grade the quiz. Passing requires 100% — every question's submitted option
// set must exactly equal its correct set. Requires having attended the lab.
//
// The reply carries the score and the ids of the questions that were wrong,
// because a retake only puts those back in front of the member. It still never
// says which option would have been right.
router.post('/:labId/quiz/submit', async (req, res) => {
    const labId = parseInt(req.params.labId)
    if (isNaN(labId)) { return res.status(400).json({ message: 'Invalid lab id' }) }

    const { answers } = req.body   // { [questionId]: [optionId, ...] }
    if (!answers || typeof answers !== 'object') {
        return res.status(400).json({ message: 'answers object is required' })
    }

    try {
        const link = await prisma.memberLab.findUnique({
            where: { memberId_labId: { memberId: req.userId, labId } }
        })
        if (!link || link.attendanceStatus !== 'attended') {
            return res.status(403).json({ message: 'You must attend the lab before taking its quiz' })
        }
        if (link.quizPassed === true) {
            return res.json({ passed: true, message: 'Already passed' })   // passing is sticky
        }

        const questions = await prisma.labQuizQuestion.findMany({
            where: { labId },
            include: { options: true }
        })
        if (questions.length === 0) {
            return res.status(400).json({ message: 'This lab has no quiz yet' })
        }

        const wrong = questions.filter(q => {
            const correct = q.options.filter(o => o.isCorrect).map(o => o.optionId).sort((a, b) => a - b)
            const given = [...(answers[q.questionId] ?? [])].map(Number).sort((a, b) => a - b)
            return !(correct.length === given.length && correct.every((id, i) => id === given[i]))
        }).map(q => q.questionId)
        const passed = wrong.length === 0

        await prisma.memberLab.update({
            where: { memberId_labId: { memberId: req.userId, labId } },
            data: { quizPassed: passed }
        })

        res.json({ passed, correct: questions.length - wrong.length, total: questions.length, wrong })
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

export default router
