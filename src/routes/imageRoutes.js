import express from 'express'
import prisma from '../prismaClient.js'
import { IMAGES, decodeDataUrl, imageKey } from '../images.js'
import { onTreasuryTeam } from '../middleware/treasury.js'
import { runsDoor } from '../payments.js'
import authMiddleware from '../middleware/authMiddleware.js'
import { onLandingPage } from '../sponsors.js'
import { memo } from '../memo.js'

// GET /api/img/:kind/:id/:key — one picture, as the picture itself (see
// src/images.js). Mounted behind imageAuth (below) in server.js: everything
// here needs someone signed in except the landing page's pictures, and each
// kind is held to who can see the row it belongs to.
//
// The key is the picture's fingerprint, so an address only ever means one
// picture. That's what lets a cover or an avatar be cached for good — by the
// browser (Cache-Control below, and the page's own cache, frontend/lib/
// images.js) and by this process (the LRU below), so a cover a hundred people
// open leaves the database once. A stale key (the picture's since changed)
// is a 404; the page has the new address by then.
//
// A payment screenshot or a receipt is someone's own paperwork: checked the
// same way as the rows they're on, and never cached anywhere.

const router = express.Router()

const RASTER = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/avif']

const STAFF = ['officer', 'jboard', 'treasurer', 'admin', 'advisor']
const BOOKS = ['treasurer', 'admin', 'advisor']

// who may see the picture on this row — `row` has the fields `select` asked for
const ACCESS = {
    lab: {
        select: { published: true },
        allowed: (req, row) => row.published || STAFF.includes(req.role)
    },
    event: {
        select: { track: true, published: true },
        allowed: (req, row) => (row.published && row.track !== 'officers') || STAFF.includes(req.role)
    },
    // your own photo whatever your standing (the account page shows it to
    // someone not yet a member); everyone else's to members, as on /members
    user: {
        select: { userId: true },
        allowed: (req, row) => row.userId === req.userId || Boolean(req.role)
    },
    method: {
        select: { methodId: true },
        allowed: (req) => Boolean(req.role)
    },
    // whoever sent it, the door (the check-in page), and the books (dues)
    payment: {
        select: { memberId: true },
        allowed: (req, row) => row.memberId === req.userId || runsDoor(req) || BOOKS.includes(req.role) || onTreasuryTeam(req)
    },
    // the landing page's people and album cards are public, like the page
    person: { select: {}, allowed: () => true },
    album: { select: {}, allowed: () => true },
    // a sponsor's while its pill is on the landing page; otherwise staff's,
    // like the rest of what the club knows about them
    sponsor: {
        select: { onLanding: true, status: true },
        allowed: (req, row) => onLandingPage(row) || STAFF.includes(req.role)
    },
    // whoever handed it in, and the books
    receipt: {
        select: { memberId: true },
        allowed: (req, row) => (row.memberId === req.userId && STAFF.includes(req.role)) || BOOKS.includes(req.role) || onTreasuryTeam(req)
    }
}

// The sign-in check, except for a landing page picture asked for by someone
// who isn't signed in (no Authorization header) — a visitor to the public
// page, or its plain <img> tags. Signed in, it's checked as ever, so staff
// still see a sponsor's picture that isn't on the page.
export function imageAuth(req, res, next) {
    const kind = req.path.split('/')[1]
    if (IMAGES[kind]?.public && !req.headers['authorization']) { return next() }
    return authMiddleware(req, res, next)
}

// Decoded pictures, newest use last, up to ~32MB. Keyed by kind/id/key, so a
// changed picture is simply a different entry and the old one ages out.
const LIMIT = 32 * 1024 * 1024
const cache = new Map()
let cached = 0

function remember(name, picture) {
    cache.set(name, picture)
    cached += picture.bytes.length
    for (const [old, value] of cache) {
        if (cached <= LIMIT) { break }
        cache.delete(old)
        cached -= value.bytes.length
    }
}

function recall(name) {
    const picture = cache.get(name)
    if (picture) {
        // to the back of the line
        cache.delete(name)
        cache.set(name, picture)
    }
    return picture
}

// the picture, with the headers every one goes out with
function send(res, picture, isPrivate = false) {
    res.set({
        'Content-Type': picture.type,
        'Content-Length': picture.bytes.length,
        'Cache-Control': isPrivate ? 'private, no-store' : 'private, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox"
    })
    res.end(picture.bytes)
}

// GET /api/img/eventdraft/:id/:key — the picture in a live event's parked
// draft (draftImagePath in src/images.js), which staff's cards on /events
// show. Drafts are staff's alone, as GET /api/events has them.
router.get('/eventdraft/:id/:key', async (req, res) => {
    const id = parseInt(req.params.id)
    const key = req.params.key
    if (!STAFF.includes(req.role) || isNaN(id) || !/^[0-9a-f]{12}$/.test(key)) { return res.sendStatus(404) }

    try {
        const name = `eventdraft/${id}/${key}`
        let picture = recall(name)
        if (!picture) {
            const [row] = await prisma.$queryRaw`SELECT draft->>'image' AS image FROM events WHERE event_id = ${id}`
            if (!row?.image || imageKey(row.image) !== key) { return res.sendStatus(404) }
            picture = decodeDataUrl(row.image)
            if (!picture || !RASTER.includes(picture.type)) { return res.sendStatus(404) }
            remember(name, picture)
        }
        send(res, picture)
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

router.get('/:kind/:id/:key', async (req, res) => {
    const spec = IMAGES[req.params.kind]
    const access = ACCESS[req.params.kind]
    const id = parseInt(req.params.id)
    const key = req.params.key
    if (!spec || isNaN(id) || !/^[0-9a-f]{12}$/.test(key)) { return res.sendStatus(404) }

    try {
        const name = `${req.params.kind}/${id}/${key}`
        const hit = spec.private ? null : recall(name)
        // the row is checked every time, for who may see it; the picture is
        // read only when it isn't already in hand. With the picture in hand
        // the check is kept a minute too (cleared by any write to the table,
        // KEPT in src/prismaClient.js) — a page of thirty covers is otherwise
        // thirty queries on every visit, and the landing page's are asked for
        // by everyone who opens the site.
        const check = () => prisma[spec.model].findUnique({
            where: { [spec.id]: id },
            select: { ...access.select, [spec.key]: true, ...(hit ? {} : { [spec.field]: true }) }
        })
        const row = hit ? await memo(`img:${spec.model}:${id}`, 60_000, check) : await check()
        if (!row || row[spec.key] !== key || !access.allowed(req, row)) { return res.sendStatus(404) }

        const picture = hit ?? decodeDataUrl(row[spec.field])
        // raster pictures only — an SVG served from this origin could run
        // script if someone opened its address directly
        if (!picture || !RASTER.includes(picture.type)) { return res.sendStatus(404) }
        if (!hit && !spec.private) { remember(name, picture) }

        send(res, picture, spec.private)
    } catch (err) {
        console.error(err.message)
        res.sendStatus(500)
    }
})

export default router
