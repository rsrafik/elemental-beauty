import express from 'express'
import { pendingFeedback } from '../feedback.js'

// GET /api/feedback/pending — the labs and events the site should ask this
// member for feedback on when they open it (see src/feedback.js). The forms
// themselves are on the lab and event routers.
const router = express.Router()

router.get('/pending', async (req, res) => {
    try {
        res.json(await pendingFeedback(req.userId))
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

export default router
