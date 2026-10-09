const express = require('express')
const { pool } = require('../db/connectdb')
const requireEmployee = require('../middlewares/employee-auth.middleware')

const router = express.Router()
const datePattern = /^\d{4}-\d{2}-\d{2}$/
const terminalStatuses = ['completed', 'cancelled', 'no_show']
const officeTimezone = process.env.OFFICE_TIMEZONE || 'Asia/Kolkata'

const isValidDate = (value) => datePattern.test(value || '')
	&& !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
	&& new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value

router.use(requireEmployee)

router.get('/counters', async (request, response) => {
	try {
		const { rows } = await pool.query(
			`SELECT c.counter_id, c.counter_name, c.counter_number, go.gov_name,
			        go.gov_name AS office_name
			 FROM counters c
			 JOIN employees e ON e.employee_id = c.employee_id
			 JOIN government_office go ON go.gov_id = e.gov_id
			 WHERE e.user_id = $1
			 ORDER BY c.counter_number, c.counter_name`,
			[request.employee.userId],
		)
		return response.json({ counters: rows, officeTimezone })
	} catch (error) {
		console.error('Unable to load employee counters:', error.message)
		return response.status(500).json({ message: 'Unable to load your counters.' })
	}
})

router.get('/queue', async (request, response) => {
	const counterId = Number(request.query.counterId)
	const date = request.query.date
	if (!Number.isSafeInteger(counterId) || counterId < 1 || !isValidDate(date)) {
		return response.status(400).json({ message: 'Choose a valid counter and service date.' })
	}

	try {
		const { rows } = await pool.query(
			`SELECT qm.member_id, qm.token_number, qm.q_position, qm.status,
			        qm."date"::text AS service_date, qm.joined_at, qm.arrived_at,
			        to_char(qm.time_given, 'FMHH12:MI AM') AS time_given,
			        u.user_name AS citizen_name, u.phone AS citizen_phone,
			        s.service_name, s.average_service_minutes, q.queue_id
			 FROM counters c
			 JOIN employees e ON e.employee_id = c.employee_id
			 JOIN queue q ON q.counter_id = c.counter_id AND q.queue_date = $3::date
			 JOIN queue_members qm ON qm.queue_id = q.queue_id
			 JOIN users u ON u.user_id = qm.user_id
			 JOIN services s ON s.service_id = qm.service_id
			 WHERE e.user_id = $1 AND c.counter_id = $2
			 ORDER BY qm.q_position`,
			[request.employee.userId, counterId, date],
		)
		return response.json({ items: rows, date, counterId })
	} catch (error) {
		console.error('Unable to load employee queue:', error.message)
		return response.status(500).json({ message: 'Unable to load this counter queue.' })
	}
})

router.post('/entries/:memberId/start', async (request, response) => {
	const memberId = Number(request.params.memberId)
	if (!Number.isSafeInteger(memberId) || memberId < 1) {
		return response.status(400).json({ message: 'Select a valid queue entry.' })
	}

	try {
		const { rows } = await pool.query(
			`UPDATE queue_members qm
			 SET status = 'serving', updated_at = now()
			 FROM queue q, counters c, employees e
			 WHERE qm.member_id = $1 AND qm.queue_id = q.queue_id
			   AND q.counter_id = c.counter_id AND c.employee_id = e.employee_id
			   AND e.user_id = $2 AND qm.status = 'arrived'
			 RETURNING qm.member_id, qm.status, qm.updated_at`,
			[memberId, request.employee.userId],
		)
		if (!rows.length) {
			return response.status(409).json({ message: 'Only an arrived customer assigned to your counter can be started.' })
		}
		return response.json({ entry: rows[0] })
	} catch (error) {
		console.error('Unable to start employee service:', error.message)
		return response.status(500).json({ message: 'Unable to start this service.' })
	}
})

router.post('/entries/:memberId/complete', async (request, response) => {
	const memberId = Number(request.params.memberId)
	if (!Number.isSafeInteger(memberId) || memberId < 1) {
		return response.status(400).json({ message: 'Select a valid queue entry.' })
	}

	const client = await pool.connect()
	let transactionStarted = false
	try {
		await client.query('BEGIN')
		transactionStarted = true
		const { rows } = await client.query(
			`SELECT qm.member_id, qm.queue_id, qm.user_id, qm.service_id,
			        qm.updated_at AS started_at, c.counter_id, e.employee_id
			 FROM queue_members qm
			 JOIN queue q ON q.queue_id = qm.queue_id
			 JOIN counters c ON c.counter_id = q.counter_id
			 JOIN employees e ON e.employee_id = c.employee_id
			 WHERE qm.member_id = $1 AND e.user_id = $2 AND qm.status = 'serving'
			 FOR UPDATE OF qm`,
			[memberId, request.employee.userId],
		)
		if (!rows.length) {
			await client.query('ROLLBACK')
			transactionStarted = false
			return response.status(409).json({ message: 'Only a service currently assigned to you can be completed.' })
		}

		const entry = rows[0]
		const { rows: orderRows } = await client.query(
			`SELECT COALESCE(MAX(execution_order), 0)::int + 1 AS execution_order
			 FROM completed_requests WHERE queue_id = $1`,
			[entry.queue_id],
		)
		await client.query(
			`UPDATE queue_members SET status = 'completed', updated_at = now()
			 WHERE member_id = $1`,
			[memberId],
		)
		await client.query(
			`INSERT INTO completed_requests
			 (member_id, queue_id, counter_id, service_id, user_id, employee_id,
			  execution_order, start_at, end_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`,
			[entry.member_id, entry.queue_id, entry.counter_id, entry.service_id,
				entry.user_id, entry.employee_id, orderRows[0].execution_order, entry.started_at],
		)
		await client.query('COMMIT')
		transactionStarted = false
		return response.json({ message: 'Service completed.', memberId })
	} catch (error) {
		if (transactionStarted) await client.query('ROLLBACK')
		console.error('Unable to complete employee service:', error.message)
		return response.status(500).json({ message: 'Unable to complete this service.' })
	} finally {
		client.release()
	}
})

module.exports = router