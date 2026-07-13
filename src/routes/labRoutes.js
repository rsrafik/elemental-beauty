import express from 'express'
import jwt from 'jsonwebtoken'
import prisma from '../prismaClient.js'
import requireRole from '../middleware/requireRole.js'

const router = express.Router()
const RANK_OFFICER = ['officer', 'treasurer', 'admin']

// Preview fields — what a member sees BEFORE passing the quiz
const PREVIEW_SELECT = {
    labId: true, title: true, date: true, description: true, image: true, capacity: true
}

// ---- member-visible reads ----

// List labs. Always preview fields — full content is unlocked per-lab.
// ?when=upcoming|past derived against today at query time, never stored.
router.get('/', async (req, res) => {
    const { when } = req.query

    let where = {}
    if (when === 'upcoming') { where = { date: { gte: new Date() } } }
    if (when === 'past') { where = { date: { lt: new Date() } } }

    try {
        const labs = await prisma.lab.findMany({
            where,
            select: PREVIEW_SELECT,
            orderBy: { date: when === 'past' ? 'desc' : 'asc' }
        })
        res.json(labs)
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Full content only for officers+ or members who passed this lab's quiz (100%)
router.get('/:id', async (req, res) => {
    const labId = parseInt(req.params.id)
    if (isNaN(labId)) { return res.status(400).json({ message: 'Invalid lab id' }) }

    try {
        let unlocked = RANK_OFFICER.includes(req.role)

        if (!unlocked) {
            const link = await prisma.memberLab.findUnique({
                where: { memberId_labId: { memberId: req.userId, labId } }
            })
            unlocked = link?.quizPassed === true
        }

        if (unlocked) {
            const lab = await prisma.lab.findUnique({
                where: { labId },
                include: {
                    lessons: true,
                    quizQuestions: {
                        include: {
                            // never select isCorrect — the answer key stays server-side
                            options: { select: { optionId: true, answerText: true } }
                        }
                    }
                }
            })
            if (!lab) { return res.status(404).json({ message: 'Lab not found' }) }
            return res.json({ unlocked: true, ...lab })
        }

        const lab = await prisma.lab.findUnique({ where: { labId }, select: PREVIEW_SELECT })
        if (!lab) { return res.status(404).json({ message: 'Lab not found' }) }
        res.json({ unlocked: false, ...lab })
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// ---- officer+ content management ----

router.post('/', requireRole('officer'), async (req, res) => {
    const { title, date, description, image, ingredients, equipment, safetyNote, instructions, capacity } = req.body

    if (!title || !date) {
        return res.status(400).json({ message: 'title and date are required' })
    }
    const labDate = new Date(date)
    if (isNaN(labDate.getTime())) {
        return res.status(400).json({ message: 'date must be a valid date (YYYY-MM-DD)' })
    }
    if (capacity !== undefined && (!Number.isInteger(capacity) || capacity < 1)) {
        return res.status(400).json({ message: 'capacity must be a positive integer' })
    }

    try {
        const lab = await prisma.lab.create({
            data: { title, date: labDate, description, image, ingredients, equipment, safetyNote, instructions, capacity }
        })
        res.status(201).json(lab)
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

router.put('/:id', requireRole('officer'), async (req, res) => {
    const labId = parseInt(req.params.id)
    if (isNaN(labId)) { return res.status(400).json({ message: 'Invalid lab id' }) }

    // partial update: only touch fields the client actually sent
    const data = {}
    for (const field of ['title', 'description', 'image', 'ingredients', 'equipment', 'safetyNote', 'instructions']) {
        if (req.body[field] !== undefined) { data[field] = req.body[field] }
    }
    if (req.body.date !== undefined) {
        const labDate = new Date(req.body.date)
        if (isNaN(labDate.getTime())) {
            return res.status(400).json({ message: 'date must be a valid date (YYYY-MM-DD)' })
        }
        data.date = labDate
    }
    if (req.body.capacity !== undefined) {
        if (!Number.isInteger(req.body.capacity) || req.body.capacity < 1) {
            return res.status(400).json({ message: 'capacity must be a positive integer' })
        }
        data.capacity = req.body.capacity
    }

    try {
        const lab = await prisma.lab.update({ where: { labId }, data })
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

// ---- member actions ----

// RSVP is capped at the lab's capacity. When full, the member goes on the
// ONLINE waitlist (same waitlisted status the door uses) and is auto-promoted
// to rsvped if a seat opens (see DELETE /rsvp below).
router.post('/:labId/rsvp', async (req, res) => {
    const labId = parseInt(req.params.labId)
    if (isNaN(labId)) { return res.status(400).json({ message: 'Invalid lab id' }) }

    try {
        const lab = await prisma.lab.findUnique({ where: { labId } })
        if (!lab) { return res.status(404).json({ message: 'Lab not found' }) }

        const existing = await prisma.memberLab.findUnique({
            where: { memberId_labId: { memberId: req.userId, labId } }
        })
        if (existing) {
            if (existing.attendanceStatus === 'waitlisted') {
                return res.status(202).json({ code: 'ALREADY_WAITLISTED', message: 'You are already on the waitlist' })
            }
            return res.json({ code: 'ALREADY_RSVPED', message: 'You are already RSVP\'d', rsvp: existing })
        }

        // count + create inside one transaction so two simultaneous RSVPs
        // can't both grab the last seat
        const result = await prisma.$transaction(async (tx) => {
            const seatsTaken = await tx.memberLab.count({
                where: { labId, attendanceStatus: { in: ['rsvped', 'attended'] } }
            })

            if (seatsTaken < lab.capacity) {
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
            return res.status(202).json({
                code: 'WAITLISTED',
                message: 'Lab is full — you are on the waitlist and will be auto-RSVP\'d if a seat opens',
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

// Un-RSVP. If a confirmed seat opens, the oldest waitlisted member is
// auto-promoted to rsvped in the same transaction.
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

            // leaving the waitlist frees no seat — only a confirmed RSVP does
            if (existing.attendanceStatus !== 'rsvped') { return null }

            const next = await tx.memberLab.findFirst({
                where: { labId, attendanceStatus: 'waitlisted' },
                orderBy: { waitlistedAt: 'asc' }         // oldest waits shortest
            })
            if (!next) { return null }

            return tx.memberLab.update({
                where: { memberId_labId: { memberId: next.memberId, labId } },
                data: { attendanceStatus: 'rsvped', waitlistedAt: null }
            })
        })

        res.json({
            message: 'RSVP cancelled',
            promotedFromWaitlist: promoted ? promoted.memberId : null
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

        // rsvped → they have a reserved seat, check them in
        const attendance = await prisma.memberLab.update({
            where: { memberId_labId: { memberId: decoded.id, labId } },
            data: { attendanceStatus: 'attended' }
        })
        res.json({ code: 'CHECKED_IN', message: 'Checked in', attendance })
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

        const attendedCount = await prisma.memberLab.count({
            where: { labId, attendanceStatus: 'attended' }
        })
        const seatsLeft = lab.capacity - attendedCount

        if (seatsLeft <= 0) {
            return res.json({ admitted: [], seatsLeft: 0, message: 'Lab is already at capacity' })
        }

        const toAdmit = await prisma.memberLab.findMany({
            where: { labId, attendanceStatus: 'waitlisted' },
            orderBy: { waitlistedAt: 'asc' },            // oldest to newest
            take: seatsLeft                              // never over capacity
        })

        await prisma.memberLab.updateMany({
            where: { labId, memberId: { in: toAdmit.map(w => w.memberId) } },
            data: { attendanceStatus: 'attended' }
        })

        const stillWaitlisted = await prisma.memberLab.count({
            where: { labId, attendanceStatus: 'waitlisted' }
        })

        res.json({
            admitted: toAdmit.map(w => w.memberId),
            seatsLeft: seatsLeft - toAdmit.length,
            stillWaitlisted
        })
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

// Grade the quiz. Passing requires 100% — every question's submitted option
// set must exactly equal its correct set. Requires having attended the lab.
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

        const passed = questions.every(q => {
            const correct = q.options.filter(o => o.isCorrect).map(o => o.optionId).sort((a, b) => a - b)
            const given = [...(answers[q.questionId] ?? [])].map(Number).sort((a, b) => a - b)
            return correct.length === given.length && correct.every((id, i) => id === given[i])
        })

        await prisma.memberLab.update({
            where: { memberId_labId: { memberId: req.userId, labId } },
            data: { quizPassed: passed }
        })

        // pass/fail only — never which answers were wrong, or the key leaks
        res.json({ passed })
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

export default router
