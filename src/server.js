import express from 'express'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
import authRoutes from './routes/authRoutes.js'
import memberRoutes from './routes/memberRoutes.js'
import labRoutes from './routes/labRoutes.js'
import eventRoutes from './routes/eventRoutes.js'
import eventCategoryRoutes from './routes/eventCategoryRoutes.js'
import announcementRoutes from './routes/announcementRoutes.js'
import yearTargetRoutes from './routes/yearTargetRoutes.js'
import grantRoutes from './routes/grantRoutes.js'
import reimbursementRoutes from './routes/reimbursementRoutes.js'
import transactionRoutes from './routes/transactionRoutes.js'
import financeCategoryRoutes from './routes/financeCategoryRoutes.js'
import paymentMethodRoutes from './routes/paymentMethodRoutes.js'
import paymentRoutes from './routes/paymentRoutes.js'
import imageRoutes, { imageAuth } from './routes/imageRoutes.js'
import landingRoutes, { publicRouter as landingPublicRoutes } from './routes/landingRoutes.js'
import sponsorRoutes, { publicRouter as sponsorPublicRoutes, FORM_LIMIT } from './routes/sponsorRoutes.js'
import calendarRoutes, { feedRouter as calendarFeedRoutes } from './routes/calendarRoutes.js'
import authMiddleware from './middleware/authMiddleware.js'
import requireRole, { booksAccess } from './middleware/requireRole.js'
import { sweepAbsences } from './sweepAbsences.js'
import { expireOffers } from './offers.js'
import { enforcePaymentRules } from './payments.js'
import offerRoutes from './routes/offerRoutes.js'
import duesRoutes from './routes/duesRoutes.js'
import activityRoutes from './routes/activityRoutes.js'
import { sendReminders } from './reminders.js'
import { mailService } from './email.js'
import prisma from './prismaClient.js'
import { syncVipRoles } from './dues.js'

// Refuse to boot misconfigured — a missing secret must crash here, loudly,
// not surface later as broken tokens or leaked reset codes.
for (const key of ['DATABASE_URL', 'JWT_SECRET', 'QR_SECRET']) {
    if (!process.env[key]) {
        console.error(`Missing required environment variable: ${key}`)
        process.exit(1)
    }
}
// In production the two secrets have to be real ones: long, random, and not
// each other. A short or shared one would let anyone who guesses it sign in as
// any member (JWT_SECRET) or forge their check-in QR code (QR_SECRET).
if (process.env.NODE_ENV === 'production') {
    for (const key of ['JWT_SECRET', 'QR_SECRET']) {
        if (process.env[key].length < 32) {
            console.error(`${key} is too short for production — use at least 32 random characters (see .env.production.example)`)
            process.exit(1)
        }
    }
    if (process.env.JWT_SECRET === process.env.QR_SECRET) {
        console.error('JWT_SECRET and QR_SECRET must be different')
        process.exit(1)
    }
}
// one way or another the verification and reset emails have to go out —
// through a Gmail account or through Resend (see email.js)
const canEmail = mailService() !== null
if (process.env.NODE_ENV === 'production' && !canEmail) {
    console.error('Email is required in production (verification + password resets): set RESEND_API_KEY, or GMAIL_USER with GMAIL_APP_PASSWORD or the Gmail API settings')
    process.exit(1)
}
// the links in those emails are built on it
if (process.env.NODE_ENV === 'production' && !process.env.APP_URL) {
    console.error('APP_URL is required in production (the links in verification and reset emails)')
    process.exit(1)
}

const app = express()
const PORT = process.env.PORT || 5003

// Hosting platforms terminate HTTPS at a proxy in front of the app; trust it
// so the rate limiter sees real client IPs instead of the proxy's.
if (process.env.NODE_ENV === 'production') { app.set('trust proxy', 1) }

// Auth endpoints are the brute-force / bcrypt-exhaustion target — cap them.
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,                 // per IP per window, across all /auth endpoints
    message: { message: 'Too many attempts. Try again in 15 minutes' },
    // GET /auth/me is every page load's "who am I", and the onboarding page
    // asks it every few seconds while it waits for the email link — it isn't
    // an attempt at anything, and counting it would lock people out
    skip: (req) => req.method === 'GET'
})

// The landing page's "sponsor a batch" form is open to anyone, signed in or
// not — capped the same way, so it can't be used to fill the sponsors page.
const sponsorFormLimiter = rateLimit(FORM_LIMIT)

// Get file path from URL of current module
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Middleware
//
// A cover, avatar or receipt is still uploaded as a data URL inside the JSON
// (see the edit pages), and a photo is a megabyte or two of base64 — well past
// express's 100kb default. They're served back on their own (/api/img).
app.use(express.json({ limit: '15mb' }))

// JSON and the page's HTML, JS and CSS gzipped on the way out — a big list is
// a fraction of its size over the wire. Pictures (GET /api/img/...) are
// already compressed and skip it (the filter only takes text types).
app.use(compression())

// Serve the built Next.js frontend (copied into public/ by `npm run build:frontend`).
// extensions: ['html'] lets /labs resolve to public/labs.html — Next's static
// export emits one HTML file per page.
//
// redirect: false, and the fallback under it, are for the nested pages. Next
// exports /labs/view as public/labs/view.html *beside* a public/labs/view/
// folder of its own page data, and serve-static, finding the folder first,
// redirected /labs/view to /labs/view/ — which has no index.html, so every
// link that opened one directly (the emailed "view the lab" and "view the
// event" buttons, a refresh) landed on a 404.
const PUBLIC = path.join(__dirname, '../public')
// The home address is the public landing page (frontend/app/page.js, served
// from public/index.html below). /landing was its preview address, so it
// sends people there; the about-us page is still off.
app.get('/landing', (req, res) => { res.redirect(302, '/') })
app.get('/about-us', (req, res) => { res.redirect(302, '/login') })
app.use(express.static(PUBLIC, {
    extensions: ['html'],
    redirect: false,
    // Next names its bundles by their content (/_next/static/...), so they
    // never change under the same name: kept a year, never re-checked. The
    // pages themselves are re-checked every load (a 304 when nothing changed)
    // so a deploy shows up at once; the rest (images, fonts) for a day.
    //
    // The .txt files are pages too: they're what the router fetches when you
    // click from one page to another (labs.txt, labs/__next.labs.txt, ...),
    // and each carries the build it came from. They keep their names across
    // deploys, so a day's cache left the browser holding the last build's
    // copy; the router saw a build that didn't match the page it was on and
    // gave up on the in-app move for a full reload — the whole screen,
    // menu included, blinking out and back on a click between pages.
    setHeaders(res, file) {
        if (file.includes(`${path.sep}_next${path.sep}static${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
        } else if (file.endsWith('.html') || file.endsWith('.txt')) {
            res.setHeader('Cache-Control', 'no-cache')
        } else {
            res.setHeader('Cache-Control', 'public, max-age=86400')
        }
    }
}))
app.get(/^\/(?!api\/).+/, (req, res, next) => {
    const page = path.join(PUBLIC, `${req.path.replace(/\/+$/, '')}.html`)
    // never outside public/, whatever the path says
    if (!page.startsWith(PUBLIC + path.sep)) { return next() }
    res.sendFile(page, (err) => { if (err) { next() } })
})

// "Is the server up?" — for the host's health check and the uptime pinger that
// keeps Render's free instance from sleeping. It never touches the database,
// so pinging it every few minutes doesn't keep Neon awake too.
app.get('/api/health', (req, res) => { res.json({ ok: true }) })

// API routes — all under /api so they can never collide with frontend pages
// (frontend /labs is a page; /api/labs is the API).
app.use('/api/auth', authLimiter, authRoutes)
// a waitlist offer's "accept" link — no login, the link is the proof — held to
// the same limit as the other token-in-hand routes
app.use('/api/offers', authLimiter, offerRoutes)
// pictures, one at a time and cached (see the router) — each kind is held to
// who can see the row it's on. The landing page's are open to anyone
// (imageAuth).
app.use('/api/img', imageAuth, imageRoutes)
// the landing page's people, album and sponsors: anyone reads them (the page
// is public), an admin keeps them on /landing-editor
app.use('/api/landing', landingPublicRoutes)
app.use('/api/landing', authMiddleware, requireRole('admin'), landingRoutes)
// sponsors: anyone sends the landing page's form (POST /request), an admin
// keeps the rest on /sponsors
app.use('/api/sponsors/request', sponsorFormLimiter)
app.use('/api/sponsors', sponsorPublicRoutes)
app.use('/api/sponsors', authMiddleware, requireRole('admin'), sponsorRoutes)
app.use('/api/members', authMiddleware, requireRole('member'), memberRoutes)
app.use('/api/labs', authMiddleware, requireRole('member'), labRoutes)
app.use('/api/events', authMiddleware, requireRole('member'), eventRoutes)
// "subscribe" on /calendar. The feed is fetched by Google itself, with no
// login — the signed link is the proof — so it's mounted first and on its own,
// with a limit loose enough for Google's shared IPs polling it. The popup's
// own routes are a member's like the rest.
const feedLimiter = rateLimit({ windowMs: 60 * 1000, limit: 120 })
app.use('/api/calendar/feed', feedLimiter, calendarFeedRoutes)
app.use('/api/calendar', authMiddleware, requireRole('member'), calendarRoutes)
// the calendar's tag list and the club's announcements: every member reads
// them, officers write them — that split is inside the routers
app.use('/api/event-categories', authMiddleware, requireRole('member'), eventCategoryRoutes)
app.use('/api/announcements', authMiddleware, requireRole('member'), announcementRoutes)
// paying the club on your own: the ways to pay (every member reads them; the
// treasurer and admin keep them) and the payments members send in for review
// — the splits are inside the routers (keepsBooks in src/payments.js)
app.use('/api/payment-methods', authMiddleware, requireRole('member'), paymentMethodRoutes)
app.use('/api/payments', authMiddleware, requireRole('member'), paymentRoutes)
// the income goal and spending budget: on the summary cards every officer
// sees, set by the treasurer alone (enforced inside the router)
//
// J-board reads the books the way an officer does (the overview, and files
// their own receipts); j-board's treasury team reads them all and changes
// only grants and sponsorships (see booksAccess).
app.use('/api/year-targets', authMiddleware, requireRole('officer'), booksAccess, yearTargetRoutes)
app.use('/api/reimbursements', authMiddleware, requireRole('officer'), booksAccess, reimbursementRoutes)
app.use('/api/transactions', authMiddleware, requireRole('officer'), booksAccess, transactionRoutes)
// Same split as transactions: every officer reads the books — the grant
// tracker is on the analytics page they all see — and only the treasurer
// writes to them. The write gate is inside the router.
app.use('/api/grants', authMiddleware, requireRole('officer'), booksAccess, grantRoutes)
// what money is filed under — the donuts' slices and the receipt form's
// list: every officer reads it, the treasurer and admin add and remove them
app.use('/api/finance-categories', authMiddleware, requireRole('officer'), booksAccess, financeCategoryRoutes)
// dues are the treasurer's to keep — reading as well as writing (the
// treasury team reads them, see booksAccess)
app.use('/api/dues', authMiddleware, requireRole('treasurer'), booksAccess, duesRoutes)
// the staff activity log: who changed whose role, points, membership, dues.
// Every officer reads it (j-board without the dues lines — see the router).
app.use('/api/activity', authMiddleware, requireRole('officer'), activityRoutes)

// Mark RSVP'd no-shows absent once a lab/event's day has passed —
// on boot, then hourly.
sweepAbsences().catch(err => console.error('Absence sweep failed:', err.message))
setInterval(
    () => sweepAbsences().catch(err => console.error('Absence sweep failed:', err.message)),
    60 * 60 * 1000
)

// Pass on waitlist offers left unanswered 48 hours (see offers.js) — on boot,
// then hourly. Each check-in page also runs it when it loads its roster.
expireOffers().catch(err => console.error('Offer sweep failed:', err.message))
setInterval(
    () => expireOffers().catch(err => console.error('Offer sweep failed:', err.message)),
    60 * 60 * 1000
)

// Payment due dates (a week before, 11:59 PM) and sent-back payments left
// unfixed for 48 hours: whoever's owed is moved to the waitlist (see
// payments.js) — on boot, then hourly, and on each check-in page's roster read.
enforcePaymentRules().catch(err => console.error('Payment sweep failed:', err.message))
setInterval(
    () => enforcePaymentRules().catch(err => console.error('Payment sweep failed:', err.message)),
    60 * 60 * 1000
)

// The day-before reminder for labs and events (see reminders.js) — on boot,
// then hourly, so each one goes out somewhere in the hour it comes due.
sendReminders().catch(err => console.error('Reminder sweep failed:', err.message))
setInterval(
    () => sendReminders().catch(err => console.error('Reminder sweep failed:', err.message)),
    60 * 60 * 1000
)

// VIP follows this school year's dues (see dues.js). Every payment change
// already re-syncs it; this is for the turn of the year, when last year's VIPs
// have nothing paid for the new one — on boot, then hourly.
const syncVip = () => syncVipRoles(prisma)
    .then(({ promoted, lapsed }) => {
        if (promoted || lapsed) { console.log(`VIP sync: ${promoted} made VIP, ${lapsed} back to member`) }
    })
    .catch(err => console.error('VIP sync failed:', err.message))
syncVip()
setInterval(syncVip, 60 * 60 * 1000)

app.listen(PORT, () => {
    console.log(`Server has started on port: ${PORT}`)
})