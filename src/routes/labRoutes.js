import express from 'express'
import jwt from 'jsonwebtoken'
import prisma from '../prismaClient.js'
import requireRole from '../middleware/requireRole.js'

const router = express.Router()
const RANK_OFFICER = ['officer', 'treasurer', 'admin']   // or reuse your RANK map

// Preview fields — what a member sees BEFORE passing the quiz
const PREVIEW_SELECT = { labId: true, title: true, date: true, description: true, image: true }

// ---- member-visible reads ----

router.get('/', async (req, res) => {
    // ?when=upcoming|past → where: { date: { gte: new Date() } } or { lt: ... }
    // list view returns PREVIEW_SELECT for everyone — full content is per-lab
})

router.get('/:id', async (req, res) => {
    const labId = parseInt(req.params.id)

    // officers+ always get everything
    let unlocked = RANK_OFFICER.includes(req.role)

    if (!unlocked) {
        const link = await prisma.memberLab.findUnique({
            where: { memberId_labId: { memberId: req.userId, labId } }   // composite key syntax
        })
        unlocked = link?.quizPassed === true
    }

    if (unlocked) {
        // full: findUnique with include: { lessons: true } and all content columns.
        // quiz questions: include options but select answerText/optionId ONLY — never isCorrect
    } else {
        // preview: findUnique({ where: { labId }, select: PREVIEW_SELECT })
    }
})

// ---- officer+ content management ----

router.post('/', requireRole('officer'), async (req, res) => { /* create lab */ })
router.put('/:id', requireRole('officer'), async (req, res) => { /* update lab */ })
router.delete('/:id', requireRole('officer'), async (req, res) => { /* delete (cascades) */ })

router.post('/:labId/lessons', requireRole('officer'), async (req, res) => { /* create lesson */ })

router.post('/:labId/quiz', requireRole('officer'), async (req, res) => {
    const { question, options } = req.body   // options: [{ answerText, isCorrect }, ...]
    // MUST be one transaction — your deferred trigger checks at COMMIT:
    const created = await prisma.$transaction(async (tx) => {
        const q = await tx.labQuizQuestion.create({
            data: { labId: parseInt(req.params.labId), question }
        })
        await tx.quizAnswerOption.createMany({
            data: options.map(o => ({ ...o, questionId: q.questionId }))
        })
        return q
    })
    // if no option has isCorrect, the trigger rejects the whole thing here → catch → 400
    res.status(201).json(created)
})

// ---- member actions ----

router.post('/:labId/rsvp', async (req, res) => {
    // upsert makes double-RSVP harmless:
    // prisma.memberLab.upsert({
    //   where: { memberId_labId: { memberId: req.userId, labId } },
    //   update: {},                                  // already linked: no-op
    //   create: { memberId: req.userId, labId }      // status defaults to 'rsvped'
    // })
})

router.post('/:labId/checkin', requireRole('officer'), async (req, res) => {
    const { qrToken } = req.body
    let decoded
    try {
        decoded = jwt.verify(qrToken, process.env.QR_SECRET)   // NOT JWT_SECRET
    } catch {
        return res.status(400).json({ message: 'Invalid QR code' })
    }
    // upsert member_lab for (decoded.id, labId) setting attendanceStatus: 'attended'
    // — upsert, so walk-ins who never RSVPed still check in cleanly
})

router.post('/:labId/quiz/submit', async (req, res) => {
    const labId = parseInt(req.params.labId)
    const { answers } = req.body   // { [questionId]: [optionId, ...] }

    // optional attendance gate (your open decision):
    // const link = await prisma.memberLab.findUnique({ where: { memberId_labId: {...} } })
    // if (link?.attendanceStatus !== 'attended') return res.status(403).json(...)

    const questions = await prisma.labQuizQuestion.findMany({
        where: { labId },
        include: { options: true }
    })

    // 100% rule: for EVERY question, the submitted set must exactly equal the correct set
    const passed = questions.every(q => {
        const correct = q.options.filter(o => o.isCorrect).map(o => o.optionId).sort()
        const given = (answers[q.questionId] ?? []).map(Number).sort()
        return correct.length === given.length && correct.every((id, i) => id === given[i])
    })

    // upsert member_lab with quizPassed: passed
    // res.json({ passed })  ← return pass/fail only, never which answers were wrong
    //                          (or they binary-search their way to the key)
})

export default router