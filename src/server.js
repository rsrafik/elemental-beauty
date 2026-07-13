import express from 'express'
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

const app = express()
const PORT = process.env.PORT || 5003

// Get file path from URL of current module
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Middleware
app.use(express.json())

// Serves HTML from /public directory
// Tells express to serve all files from public folder as static assets
app.use(express.static(path.join(__dirname, '../public')))

// Serving up HTML file from /public directory
// (public/ is a sibling of src/, hence '../public' — will 404 until an
// index.html exists there; the dashboard frontend is a later step)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'))
})

// Routes
app.use('/auth', authRoutes)
app.use('/members', authMiddleware, requireRole('member'), memberRoutes)
app.use('/labs', authMiddleware, requireRole('member'), labRoutes)
app.use('/events', authMiddleware, requireRole('member'), eventRoutes)
app.use('/reimbursements', authMiddleware, requireRole('officer'), reimbursementRoutes)
app.use('/transactions', authMiddleware, requireRole('officer'), transactionRoutes)
app.use('/grants', authMiddleware, requireRole('treasurer'), grantRoutes)

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