const express = require('express')
const { pool } = require('./db/connectdb')

const app = express()

app.use(express.json())

app.get('/health', async (_request, response) => {
	try {
		await pool.query('SELECT 1')
		response.status(200).json({ status: 'ok', database: 'connected' })
	} catch {
		response.status(503).json({ status: 'error', database: 'unavailable' })
	}
})

module.exports = app
