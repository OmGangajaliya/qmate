const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { pool } = require('../db/connectdb')

const router = express.Router()
const passwordRounds = 12

const validPhone = (phone) => /^\+?\d{8,15}$/.test(phone)

const issueToken = (user) => jwt.sign(
	{ role: user.role },
	process.env.JWT_SECRET,
	{
		subject: String(user.user_id),
		issuer: 'qmate-api',
		audience: 'qmate-citizen',
		expiresIn: '2h',
	},
)

const requireJwtSecret = (response) => {
	if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32) return true

	response.status(503).json({
		message: 'Authentication is not configured. Set a JWT_SECRET of at least 32 characters.',
	})
	return false
}

router.post('/register', async (request, response) => {
	if (!requireJwtSecret(response)) return

	const userName = typeof request.body?.fullName === 'string' ? request.body.fullName.trim() : ''
	const phone = typeof request.body?.phone === 'string'
		? request.body.phone.trim().replace(/[\s()-]/g, '')
		: ''
	const password = typeof request.body?.password === 'string' ? request.body.password : ''
	const passwordBytes = Buffer.byteLength(password, 'utf8')

	if (!userName || userName.length > 160 || !validPhone(phone)) {
		return response.status(400).json({ message: 'Enter a name and a valid phone number.' })
	}
	if (passwordBytes < 8 || passwordBytes > 72) {
		return response.status(400).json({ message: 'Password must be at least 8 characters and no more than 72 bytes.' })
	}

	try {
		const passwordHash = await bcrypt.hash(password, passwordRounds)
		const { rows } = await pool.query(
			`INSERT INTO users (user_name, phone, password_hash, role)
			 VALUES ($1, $2, $3, 'citizen')
			 RETURNING user_id, user_name, phone, role`,
			[userName, phone, passwordHash],
		)
		const user = rows[0]

		return response.status(201).json({
			message: 'Account created successfully.',
			token: issueToken(user),
			user: { id: user.user_id, name: user.user_name, phone: user.phone, role: user.role },
		})
	} catch (error) {
		if (error.code === '23505') {
			return response.status(409).json({ message: 'An account with this phone number already exists.' })
		}
		console.error('Citizen registration failed:', error.message)
		return response.status(500).json({ message: 'Unable to create your account right now.' })
	}
})

router.post('/login', async (request, response) => {
	if (!requireJwtSecret(response)) return

	const phone = typeof request.body?.phone === 'string'
		? request.body.phone.trim().replace(/[\s()-]/g, '')
		: ''
	const password = typeof request.body?.password === 'string' ? request.body.password : ''

	if (!validPhone(phone) || !password || Buffer.byteLength(password, 'utf8') > 72) {
		return response.status(400).json({ message: 'Enter a valid phone number and password.' })
	}

	try {
		const { rows } = await pool.query(
			`SELECT user_id, user_name, phone, password_hash, role
			 FROM users
			 WHERE phone = $1`,
			[phone],
		)
		const user = rows[0]
		const passwordMatches = user ? await bcrypt.compare(password, user.password_hash) : false

		if (!user || user.role !== 'citizen' || !passwordMatches) {
			return response.status(401).json({ message: 'Phone number or password is incorrect.' })
		}

		return response.status(200).json({
			message: 'Signed in successfully.',
			token: issueToken(user),
			user: { id: user.user_id, name: user.user_name, phone: user.phone, role: user.role },
		})
	} catch (error) {
		console.error('Citizen login failed:', error.message)
		return response.status(500).json({ message: 'Unable to sign in right now.' })
	}
})

module.exports = router