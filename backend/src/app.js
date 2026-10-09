const express = require('express')
const cors = require('cors')
const { pool } = require('./db/connectdb')
const authRoutes = require('./routes/auth.route')
const queueRoutes = require('./routes/queue.route')

const app = express()
const allowedOrigins = new Set(
	(process.env.CORS_ORIGINS || 'http://localhost:5173,https://qmate-beige.vercel.app')
		.split(',')
		.map((origin) => origin.trim())
		.filter(Boolean),
)

app.use(cors({
	origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)),
}))
app.use(express.json())
app.use('/api/auth', authRoutes)
app.use('/api/queue', queueRoutes)

app.get('/health', async (_request, response) => {
	try {
		await pool.query('SELECT 1')
		response.status(200).json({ status: 'ok', database: 'connected' })
	} catch {
		response.status(503).json({ status: 'error', database: 'unavailable' })
	}
})

module.exports = app
