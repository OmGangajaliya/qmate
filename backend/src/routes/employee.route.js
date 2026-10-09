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
			        qm."isArrived" AS is_arrived,
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
			 ORDER BY CASE qm.status
			            WHEN 'serving' THEN 0
			            WHEN 'arrived' THEN 1
			            WHEN 'not arrived' THEN 2
			            WHEN 'late' THEN 3
			            ELSE 4
			          END,
			          qm.q_position`,
			[request.employee.userId, counterId, date],
		)
		return response.json({ items: rows, date, counterId })
	} catch (error) {
		console.error('Unable to load employee queue:', error.message)
		return response.status(500).json({ message: 'Unable to load this counter queue.' })
	}
})

router.post('/queue/next', async (request, response) => {
	const counterId = Number(request.body?.counterId)
	const date = request.body?.date
	if (!Number.isSafeInteger(counterId) || counterId < 1 || !isValidDate(date)) {
		return response.status(400).json({ message: 'Choose a valid counter and service date.' })
	}

	const client = await pool.connect()
	let transactionStarted = false
	try {
		await client.query('BEGIN')
		transactionStarted = true
		const { rows: queueRows } = await client.query(
			`SELECT q.queue_id
			 FROM queue q
			 JOIN counters c ON c.counter_id = q.counter_id
			 JOIN employees e ON e.employee_id = c.employee_id
			 WHERE e.user_id = $1 AND c.counter_id = $2 AND q.queue_date = $3::date
			 FOR UPDATE OF q`,
			[request.employee.userId, counterId, date],
		)
		if (!queueRows.length) {
			await client.query('COMMIT')
			transactionStarted = false
			return response.json({ entry: null, postponed: [], message: 'There are no queue entries for this counter and date.' })
		}

		const queueId = queueRows[0].queue_id
		await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [queueId])
		const { rows: servingRows } = await client.query(
			`SELECT member_id FROM queue_members
			 WHERE queue_id = $1 AND status = 'serving'
			 LIMIT 1 FOR UPDATE`,
			[queueId],
		)
		if (servingRows.length) {
			await client.query('ROLLBACK')
			transactionStarted = false
			return response.status(409).json({ message: 'Complete the current service before calling the next customer.' })
		}

		const { rows: activeRows } = await client.query(
			`SELECT member_id, q_position, status, "isArrived" AS is_arrived
			 FROM queue_members
			 WHERE queue_id = $1 AND status = ANY($2::varchar[])
			 ORDER BY q_position
			 FOR UPDATE`,
			[queueId, ['arrived', 'not arrived', 'late']],
		)
		if (!activeRows.some((entry) => entry.status === 'arrived' && entry.is_arrived)) {
			await client.query('COMMIT')
			transactionStarted = false
			return response.json({ entry: null, postponed: [], message: 'No customers have arrived yet.' })
		}

		const postponed = []
		const { rows: positionRows } = await client.query(
			'SELECT COALESCE(MAX(q_position), 0)::int AS max_position FROM queue_members WHERE queue_id = $1',
			[queueId],
		)
		let nextPosition = positionRows[0].max_position
		while (activeRows[0] && !(activeRows[0].status === 'arrived' && activeRows[0].is_arrived)) {
			const skipped = activeRows.shift()
			nextPosition += 1
			await client.query(
				`UPDATE queue_members
				 SET q_position = $1, status = 'not arrived', "isArrived" = FALSE,
				     arrived_at = NULL, updated_at = now()
				 WHERE member_id = $2 AND queue_id = $3`,
				[nextPosition, skipped.member_id, queueId],
			)
			postponed.push({ memberId: skipped.member_id, previousPosition: skipped.q_position, qPosition: nextPosition })
		}

		const nextEntry = activeRows[0]
		const { rows: startedRows } = await client.query(
			`UPDATE queue_members
			 SET status = 'serving', updated_at = now()
			 WHERE member_id = $1 AND queue_id = $2 AND status = 'arrived' AND "isArrived" = TRUE
			 RETURNING member_id, token_number, q_position, status`,
			[nextEntry.member_id, queueId],
		)
		if (!startedRows.length) {
			await client.query('ROLLBACK')
			transactionStarted = false
			return response.status(409).json({ message: 'The selected customer is no longer marked as arrived. Refresh the queue.' })
		}

		await client.query('COMMIT')
		transactionStarted = false
		return response.json({ entry: startedRows[0], postponed, message: `Now serving ${startedRows[0].token_number}.` })
	} catch (error) {
		if (transactionStarted) await client.query('ROLLBACK')
		console.error('Unable to call the next employee queue member:', error.message)
		return response.status(500).json({ message: 'Unable to call the next customer.' })
	} finally {
		client.release()
	}
})

router.post('/entries/:memberId/start', async (request, response) => {
	const memberId = Number(request.params.memberId)
	if (!Number.isSafeInteger(memberId) || memberId < 1) {
		return response.status(400).json({ message: 'Select a valid queue entry.' })
	}

	const client = await pool.connect()
	let transactionStarted = false
	try {
		await client.query('BEGIN')
		transactionStarted = true
		const { rows: targetRows } = await client.query(
			`SELECT qm.queue_id
			 FROM queue_members qm
			 JOIN queue q ON q.queue_id = qm.queue_id
			 JOIN counters c ON c.counter_id = q.counter_id
			 JOIN employees e ON e.employee_id = c.employee_id
			 WHERE qm.member_id = $1 AND e.user_id = $2
			 FOR UPDATE OF qm`,
			[memberId, request.employee.userId],
		)
		if (!targetRows.length) {
			await client.query('ROLLBACK')
			transactionStarted = false
			return response.status(409).json({ message: 'Only an arrived customer assigned to your counter can be started.' })
		}

		const queueId = targetRows[0].queue_id
		await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [queueId])
		const { rows: servingRows } = await client.query(
			`SELECT member_id FROM queue_members
			 WHERE queue_id = $1 AND status = 'serving'
			 LIMIT 1 FOR UPDATE`,
			[queueId],
		)
		if (servingRows.length) {
			await client.query('ROLLBACK')
			transactionStarted = false
			return response.status(409).json({ message: 'Complete the current service before serving another customer.' })
		}

		const { rows } = await client.query(
			`UPDATE queue_members
			 SET status = 'serving', updated_at = now()
			 WHERE member_id = $1 AND queue_id = $2 AND status = 'arrived' AND "isArrived" = TRUE
			 RETURNING member_id, status, updated_at`,
			[memberId, queueId],
		)
		if (!rows.length) {
			await client.query('ROLLBACK')
			transactionStarted = false
			return response.status(409).json({ message: 'Only a customer marked as arrived can be served.' })
		}
		await client.query('COMMIT')
		transactionStarted = false
		return response.json({ entry: rows[0] })
	} catch (error) {
		if (transactionStarted) await client.query('ROLLBACK')
		console.error('Unable to start employee service:', error.message)
		return response.status(500).json({ message: 'Unable to start this service.' })
	} finally {
		client.release()
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