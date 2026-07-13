import express from 'express'
import jwt from 'jsonwebtoken'
import prisma from '../prismaClient.js'
import requireRole from '../middleware/requireRole.js'

const router = express.Router()

router.get('/')                                            // members: full event info (no unlock gate)
router.get('/:id')
router.post('/', requireRole('officer'))
router.put('/:id', requireRole('officer'))
router.delete('/:id', requireRole('officer'))
router.post('/:eventId/rsvp')                              // same upsert, memberEvent table
router.post('/:eventId/checkin', requireRole('officer'))   // same QR verify + upsert

export default router