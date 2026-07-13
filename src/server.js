import express from 'express'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'

const app = express()
const PORT = process.env.PORT || 5000

// Get file path from URL of current module
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Middleware
app.use(express.json())

// Serves HTML from /public directory
// Tells express to serve all files from public folder as static assets
app.use(express.static(path.join(__dirname, '../public')))

// Serving up HTML file from /public directory
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 
    'public', 'index.html'
    ))
})

// Routes
app.use('/auth', authRoutes)
app.use('/members', authMiddleware, requireRole('member'), memberRoutes)
app.use('/labs', authMiddleware, requireRole('member'), labRoutes)
app.use('/events', authMiddleware, requireRole('member'), eventRoutes)
app.use('/reimbursements', authMiddleware, requireRole('officer'), reimbursementRoutes)
app.use('/transactions', authMiddleware, requireRole('officer'), transactionRoutes)
app.use('/grants', authMiddleware, requireRole('treasurer'), grantRoutes)

app.listen(PORT, () => {
    console.log(`Server has started on port: $(PORT)`)
})