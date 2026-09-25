import express from 'express'
import { acceptOffer, confirmSpot, readOfferToken } from '../offers.js'

// The "Accept my spot" link in a waitlist offer email, and the "Confirm my
// spot" link in a confirmation email, both land on the site's /offer page,
// which sends the token here. No login: holding the link is the proof, the
// same as the email-confirmation link. See src/offers.js.
const router = express.Router()

router.post('/accept', async (req, res) => {
    const offer = readOfferToken(req.body?.token)
    if (!offer) { return res.status(400).json({ message: 'This link isn’t valid, or it has expired' }) }

    try {
        const result = offer.purpose === 'confirm'
            ? await confirmSpot(offer.kind, offer.parentId, offer.memberId)
            : await acceptOffer(offer.kind, offer.parentId, offer.memberId)
        res.json({ ...result, action: offer.purpose, kind: offer.kind, id: offer.parentId })
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

export default router
