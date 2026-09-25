import express from 'express'
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
import authMiddleware from './middleware/authMiddleware.js'
import requireRole, { denyRole } from './middleware/requireRole.js'
import { sweepAbsences } from './sweepAbsences.js'
import { expireOffers } from './offers.js'
import offerRoutes from './routes/offerRoutes.js'
import duesRoutes from './routes/duesRoutes.js'
import activityRoutes from './routes/activityRoutes.js'
import { sendReminders } from './reminders.js'

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
const canEmail = (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) || process.env.RESEND_API_KEY
if (process.env.NODE_ENV === 'production' && !canEmail) {
    console.error('Email is required in production (verification + password resets): set GMAIL_USER + GMAIL_APP_PASSWORD, or RESEND_API_KEY')
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
    message: { message: 'Too many attempts — try again in 15 minutes' },
    // GET /auth/me is every page load's "who am I", and the onboarding page
    // asks it every few seconds while it waits for the email link — it isn't
    // an attempt at anything, and counting it would lock people out
    skip: (req) => req.method === 'GET'
})

// Get file path from URL of current module
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Middleware
//
// Cover images still travel as data URLs inside the lab/event JSON (see the
// edit pages), and a phone photo is a few megabytes of base64 — well past
// express's 100kb default.
app.use(express.json({ limit: '15mb' }))

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
// Members-only for now: the address opens on the sign-in page (which sends
// anyone signed in on to /dashboard), and the landing and about-us pages are
// off. See frontend/app/page.js.
app.get(['/', '/about-us'], (req, res) => { res.redirect(302, '/login') })
app.use(express.static(PUBLIC, { extensions: ['html'], redirect: false }))
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
app.use('/api/members', authMiddleware, requireRole('member'), memberRoutes)
app.use('/api/labs', authMiddleware, requireRole('member'), labRoutes)
app.use('/api/events', authMiddleware, requireRole('member'), eventRoutes)
// the calendar's tag list and the club's announcements: every member reads
// them, officers write them — that split is inside the routers
app.use('/api/event-categories', authMiddleware, requireRole('member'), eventCategoryRoutes)
app.use('/api/announcements', authMiddleware, requireRole('member'), announcementRoutes)
// the income goal and spending budget: on the summary cards every officer
// sees, set by the treasurer alone (enforced inside the router)
//
// J-board outranks an officer but the books aren't theirs, so every finance
// route turns them away (see denyRole).
app.use('/api/year-targets', authMiddleware, requireRole('officer'), denyRole('jboard'), yearTargetRoutes)
app.use('/api/reimbursements', authMiddleware, requireRole('officer'), denyRole('jboard'), reimbursementRoutes)
app.use('/api/transactions', authMiddleware, requireRole('officer'), denyRole('jboard'), transactionRoutes)
// Same split as transactions: every officer reads the books — the grant
// tracker is on the analytics page they all see — and only the treasurer
// writes to them. The write gate is inside the router.
app.use('/api/grants', authMiddleware, requireRole('officer'), denyRole('jboard'), grantRoutes)
// dues are the treasurer's to keep — reading as well as writing
app.use('/api/dues', authMiddleware, requireRole('treasurer'), duesRoutes)
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

// The day-before reminder for labs and events (see reminders.js) — on boot,
// then hourly, so each one goes out somewhere in the hour it comes due.
sendReminders().catch(err => console.error('Reminder sweep failed:', err.message))
setInterval(
    () => sendReminders().catch(err => console.error('Reminder sweep failed:', err.message)),
    60 * 60 * 1000
)

app.listen(PORT, () => {
    console.log(`Server has started on port: ${PORT}`)
})