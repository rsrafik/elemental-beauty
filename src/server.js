import express from 'express'
import rateLimit from 'express-rate-limit'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
import authRoutes from './routes/authRoutes.js'
import memberRoutes from './routes/memberRoutes.js'
import labRoutes from './routes/labRoutes.js'
import eventRoutes from './routes/eventRoutes.js'
import grantRoutes from './routes/grantRoutes.js'
import reimbursementRoutes from './routes/reimbursementRoutes.js'
import transactionRoutes from './routes/transactionRoutes.js'
import authMiddleware from './middleware/authMiddleware.js'
import requireRole from './middleware/requireRole.js'
import { sweepAbsences } from './sweepAbsences.js'

// Refuse to boot misconfigured — a missing secret must crash here, loudly,
// not surface later as broken tokens or leaked reset codes.
for (const key of ['DATABASE_URL', 'JWT_SECRET', 'QR_SECRET']) {
    if (!process.env[key]) {
        console.error(`Missing required environment variable: ${key}`)
        process.exit(1)
    }
}
if (process.env.NODE_ENV === 'production' && !process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY is required in production (email verification + password resets)')
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
    message: { message: 'Too many attempts — try again in 15 minutes' }
})

// Get file path from URL of current module
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Middleware
app.use(express.json())

// Serve the built Next.js frontend (copied into public/ by `npm run build:frontend`).
// extensions: ['html'] lets /labs resolve to public/labs.html — Next's static
// export emits one HTML file per page.
app.use(express.static(path.join(__dirname, '../public'), { extensions: ['html'] }))

// API routes — all under /api so they can never collide with frontend pages
// (frontend /labs is a page; /api/labs is the API).
app.use('/api/auth', authLimiter, authRoutes)
app.use('/api/members', authMiddleware, requireRole('member'), memberRoutes)
app.use('/api/labs', authMiddleware, requireRole('member'), labRoutes)
app.use('/api/events', authMiddleware, requireRole('member'), eventRoutes)
app.use('/api/reimbursements', authMiddleware, requireRole('officer'), reimbursementRoutes)
app.use('/api/transactions', authMiddleware, requireRole('officer'), transactionRoutes)
app.use('/api/grants', authMiddleware, requireRole('treasurer'), grantRoutes)

// Mark RSVP'd no-shows absent once a lab/event's day has passed —
// on boot, then hourly.
sweepAbsences().catch(err => console.error('Absence sweep failed:', err.message))
setInterval(
    () => sweepAbsences().catch(err => console.error('Absence sweep failed:', err.message)),
    60 * 60 * 1000
)

app.listen(PORT, () => {
    console.log(`Server has started on port: ${PORT}`)
})