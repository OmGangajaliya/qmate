const express = require('express')
const { pool } = require('../db/connectdb')
const requireCitizen = require('../middlewares/citizen-auth.middleware')
const { isInsideCampus } = require('../utils/geofence')

const router = express.Router()
const terminalStatuses = ['completed', 'cancelled', 'no_show']
const cancellableStatuses = ['not arrived', 'arrived', 'late']
const officeTimezone = process.env.OFFICE_TIMEZONE || 'Asia/Kolkata'

const formatDate = (date) => date.toISOString().slice(0, 10)

const getOfficeDateParts = (date) => {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: officeTimezone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		calendar: 'iso8601',
	}).formatToParts(date)
	return Object.fromEntries(
		parts
			.filter((part) => part.type !== 'literal')
			.map((part) => [part.type, part.value]),
	)
}

const officeDateString = (date = new Date()) => {
	const parts = getOfficeDateParts(date)
	return `${parts.year}-${parts.month}-${parts.day}`
}

const todayUtc = () => officeDateString(new Date())

const maxBookingDate = () => {
	const now = new Date()
	const officeParts = getOfficeDateParts(now)
	const year = Number(officeParts.year)
	const monthZeroBased = Number(officeParts.month) - 1
	const day = Number(officeParts.day)
	const nextMonthFirst = new Date(Date.UTC(year, monthZeroBased + 1, 1))
	const lastDay = new Date(Date.UTC(nextMonthFirst.getUTCFullYear(), nextMonthFirst.getUTCMonth() + 1, 0)).getUTCDate()
	const cappedDay = Math.min(day, lastDay)
	return `${nextMonthFirst.getUTCFullYear()}-${String(nextMonthFirst.getUTCMonth() + 1).padStart(2, '0')}-${String(cappedDay).padStart(2, '0')}`
}

const isValidDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value)
	&& !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
	&& formatDate(new Date(`${value}T00:00:00Z`)) === value

const validateBookingDate = (value) => {
	if (!isValidDate(value)) return 'Select a valid service date.'
	if (value < todayUtc() || value > maxBookingDate()) return 'Choose a date from today through the next month.'
	return null
}

const getOfficeHours = async (client, date, openingTime, closingTime) => {
	const { rows } = await client.query(
		`SELECT (now() AT TIME ZONE $1)::date::text AS office_today,
		        (now() AT TIME ZONE $1)::time AS office_time`,
		[officeTimezone],
	)
	const officeToday = rows[0].office_today
	const opening = String(openingTime).slice(0, 5)
	const closing = String(closingTime).slice(0, 5)
	const currentTime = String(rows[0].office_time).slice(0, 5)
	const isToday = date === officeToday
	const withinHours = !isToday || (currentTime >= opening && currentTime < closing)

	return {
		isToday,
		withinHours,
		openingTime: opening,
		closingTime: closing,
		message: withinHours
			? null
			: `Same-day queue joining is available between ${opening} and ${closing} local time. Choose a specific date to book ahead.`,
	}
}

const minutesFromBuffer = (value) => {
	if (typeof value === 'number' || /^\d+(?:\.\d+)?$/.test(String(value))) {
		return Math.max(0, Number(value) || 0)
	}

	const interval = String(value).match(/^(?:(-?\d+)\s+days?\s+)?(-?)(\d+):(\d{2}):([\d.]+)$/)
	if (!interval) return 0
	const days = Number(interval[1] || 0)
	const sign = interval[2] === '-' || days < 0 ? -1 : 1
	return Math.max(0, sign * (Math.abs(days) * 1440 + Number(interval[3]) * 60 + Number(interval[4]) + Number(interval[5]) / 60))
}

const getQueueEstimate = async (client, queueId, bufferTime, beforePosition = null) => {
	const { rows } = await client.query(
		`SELECT COUNT(*)::int AS people_waiting,
		        COALESCE(SUM(s.average_service_minutes), 0)::int AS raw_wait_minutes
		 FROM queue_members qm
		 JOIN services s ON s.service_id = qm.service_id
		 WHERE qm.queue_id = $1
		   AND qm.status <> ALL($2::varchar[])
		   AND ($3::int IS NULL OR qm.q_position < $3)`,
		[queueId, terminalStatuses, beforePosition],
	)
	const peopleWaiting = rows[0].people_waiting
	const rawWaitMinutes = rows[0].raw_wait_minutes
	return {
		peopleWaiting,
		rawWaitMinutes,
		bufferMinutes: minutesFromBuffer(bufferTime),
		estimatedWaitMinutes: Math.max(0, rawWaitMinutes - minutesFromBuffer(bufferTime)),
	}
}

const getCounterHoliday = async (client, counterId, date) => {
	const { rows } = await client.query(
		`SELECT h.holiday_id, h.remarks, h.day
		 FROM counters c
		 JOIN employees e ON e.employee_id = c.employee_id
		 JOIN holiday h ON h.user_id = e.user_id AND h."date" = $2::date
		 WHERE c.counter_id = $1
		 LIMIT 1`,
		[counterId, date],
	)
	return rows[0] || null
}

router.use(requireCitizen)

router.get('/counters', async (_request, response) => {
	try {
		const { rows } = await pool.query(
			`SELECT c.counter_id, c.counter_name, c.counter_number, go.gov_name
			 FROM counters c
			 JOIN employees e ON e.employee_id = c.employee_id
			 JOIN government_office go ON go.gov_id = e.gov_id
			 WHERE EXISTS (SELECT 1 FROM services s WHERE s.counter_id = c.counter_id)
			 ORDER BY go.gov_name, c.counter_number, c.counter_name`,
		)
		return response.json({ counters: rows })
	} catch (error) {
		console.error('Unable to load service counters:', error.message)
		return response.status(500).json({ message: 'Unable to load service counters.' })
	}
})

router.get('/counters/:counterId/services', async (request, response) => {
	const counterId = Number(request.params.counterId)
	if (!Number.isSafeInteger(counterId) || counterId < 1) {
		return response.status(400).json({ message: 'Select a valid service counter.' })
	}

	try {
		const { rows } = await pool.query(
			`SELECT service_id, service_name, average_service_minutes
			 FROM services
			 WHERE counter_id = $1
			 ORDER BY service_name`,
			[counterId],
		)
		return response.json({ services: rows })
	} catch (error) {
		console.error('Unable to load services:', error.message)
		return response.status(500).json({ message: 'Unable to load services.' })
	}
})

router.get('/history', async (request, response) => {
	const filter = typeof request.query.status === 'string' ? request.query.status : 'all'
	const statusesByFilter = {
		active: ['not arrived', 'arrived', 'serving', 'late'],
		completed: ['completed'],
		cancelled: ['cancelled', 'no_show'],
	}
	if (filter !== 'all' && !statusesByFilter[filter]) {
		return response.status(400).json({ message: 'Choose a valid service-history filter.' })
	}

	const requestedLimit = Number(request.query.limit || 50)
	const requestedOffset = Number(request.query.offset || 0)
	if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 100
		|| !Number.isInteger(requestedOffset) || requestedOffset < 0) {
		return response.status(400).json({ message: 'History page size or offset is invalid.' })
	}

	try {
		const statuses = filter === 'all' ? null : statusesByFilter[filter]
		const { rows } = await pool.query(
			`SELECT qm.member_id, qm.token_number, qm.q_position, qm.status,
			        qm."date"::text AS service_date, qm.joined_at, qm.arrived_at,
			        to_char(qm.time_given, 'FMHH12:MI AM') AS time_given,
			        q.queue_date::text AS queue_date,
			        s.service_name, s.average_service_minutes,
			        completion.start_at AS completed_start_at,
			        completion.end_at AS completed_end_at,
			        COUNT(*) OVER()::int AS total_count
			 FROM queue_members qm
			 JOIN queue q ON q.queue_id = qm.queue_id
			 JOIN services s ON s.service_id = qm.service_id
			 LEFT JOIN LATERAL (
			     SELECT start_at, end_at
			     FROM completed_requests
			     WHERE member_id = qm.member_id
			     ORDER BY end_at DESC
			     LIMIT 1
			 ) completion ON TRUE
			 WHERE qm.user_id = $1
			   AND ($2::varchar[] IS NULL OR qm.status = ANY($2::varchar[]))
			 ORDER BY qm."date" DESC, qm.joined_at DESC, qm.q_position DESC
			 LIMIT $3 OFFSET $4`,
			[request.citizen.userId, statuses, requestedLimit, requestedOffset],
		)
		return response.json({
			items: rows.map(({ total_count: _totalCount, ...item }) => item),
			total: rows[0]?.total_count || 0,
			limit: requestedLimit,
			offset: requestedOffset,
		})
	} catch (error) {
		console.error('Unable to load citizen service history:', error.message)
		return response.status(500).json({ message: 'Unable to load service history right now.' })
	}
})

router.delete('/entries/:memberId', async (request, response) => {
	const memberId = Number(request.params.memberId)
	if (!Number.isSafeInteger(memberId) || memberId < 1) {
		return response.status(400).json({ message: 'Select a valid queue entry.' })
	}

	const client = await pool.connect()
	let transactionStarted = false
	try {
		await client.query('BEGIN')
		transactionStarted = true
		const { rows: eligibleRows } = await client.query(
			`SELECT member_id
			 FROM queue_members
			 WHERE member_id = $1 AND user_id = $2 AND status = ANY($3::varchar[])
			 FOR UPDATE`,
			[memberId, request.citizen.userId, cancellableStatuses],
		)

		if (!eligibleRows.length) {
			await client.query('ROLLBACK')
			transactionStarted = false
			return response.status(409).json({ message: 'This queue entry cannot be exited right now.' })
		}

		await client.query('DELETE FROM citizen_locations WHERE member_id = $1', [memberId])
		await client.query('UPDATE notifications SET members_id = NULL WHERE members_id = $1', [memberId])
		const { rows } = await client.query(
			`DELETE FROM queue_members
			 WHERE member_id = $1 AND user_id = $2 AND status = ANY($3::varchar[])
			 RETURNING member_id, token_number`,
			[memberId, request.citizen.userId, cancellableStatuses],
		)
		await client.query('COMMIT')
		transactionStarted = false

		return response.json({
			message: 'You have exited the queue.',
			entry: rows[0],
		})
	} catch (error) {
		if (transactionStarted) await client.query('ROLLBACK')
		console.error('Unable to exit queue membership:', error.message)
		return response.status(500).json({ message: 'Unable to exit the queue right now.' })
	} finally {
		client.release()
	}
})

router.post('/geofence/location', async (request, response) => {
	const latitude = Number(request.body?.latitude)
	const longitude = Number(request.body?.longitude)
	const accuracyMeters = Number(request.body?.accuracyMeters)
	const queueDate = request.body?.date

	if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
		|| !Number.isFinite(longitude) || longitude < -180 || longitude > 180
		|| !Number.isFinite(accuracyMeters) || accuracyMeters < 0) {
		return response.status(400).json({ message: 'A valid GPS location and accuracy are required.' })
	}
	if (accuracyMeters > 50) {
		return response.status(422).json({ message: 'GPS accuracy is too low. Move to an open area and try again.', retryable: true })
	}
	if (!isValidDate(queueDate)) {
		return response.status(400).json({ message: 'A valid local queue date is required.' })
	}

	const client = await pool.connect()
	let transactionStarted = false
	try {
		await client.query('BEGIN')
		transactionStarted = true
		const { rows: bookings } = await client.query(
			`SELECT qm.member_id, qm.status, go.gov_id, go.geofence_point
			 FROM queue_members qm
			 JOIN queue q ON q.queue_id = qm.queue_id
			 JOIN counters c ON c.counter_id = q.counter_id
			 JOIN employees e ON e.employee_id = c.employee_id
			 JOIN government_office go ON go.gov_id = e.gov_id
			 WHERE qm.user_id = $1
			   AND qm."date" = $2::date
			   AND qm.status IN ('not arrived', 'arrived')
			 FOR UPDATE OF qm`,
			[request.citizen.userId, queueDate],
		)

		if (bookings.length === 0) {
			await client.query('COMMIT')
			transactionStarted = false
			return response.json({ tracking: false, transitions: [], message: 'No active queue visits need location tracking today.' })
		}

		const transitions = []
		for (const booking of bookings) {
			const insideCampus = isInsideCampus(latitude, longitude, booking.geofence_point)
			if (insideCampus === null) {
				throw new Error(`Government office ${booking.gov_id} has an invalid campus geofence polygon.`)
			}

			const nextStatus = insideCampus ? 'arrived' : 'not arrived'
			if (booking.status === nextStatus) continue

			await client.query(
				`UPDATE queue_members
				 SET status = $1,
				     "isArrived" = $2,
				     arrived_at = CASE WHEN $2 THEN now() ELSE NULL END,
				     updated_at = now()
				 WHERE member_id = $3 AND user_id = $4`,
				[nextStatus, insideCampus, booking.member_id, request.citizen.userId],
			)
			await client.query(
				`INSERT INTO citizen_locations (member_id, latitude, longitude, accuracy_meters)
				 VALUES ($1, $2, $3, $4)`,
				[booking.member_id, latitude, longitude, accuracyMeters],
			)
			transitions.push({ memberId: booking.member_id, status: nextStatus })
		}

		await client.query('COMMIT')
		transactionStarted = false
		return response.json({ tracking: true, transitions })
	} catch (error) {
		if (transactionStarted) await client.query('ROLLBACK')
		console.error('Unable to evaluate citizen campus geofence:', error.message)
		return response.status(500).json({ message: 'Unable to check campus arrival right now.' })
	} finally {
		client.release()
	}
})

router.get('/holidays', async (request, response) => {
	const counterId = Number(request.query.counterId)
	const from = request.query.from
	const to = request.query.to
	if (!Number.isSafeInteger(counterId) || counterId < 1 || !isValidDate(from) || !isValidDate(to) || from > to || to > maxBookingDate()) {
		return response.status(400).json({ message: 'Select a valid counter and date range within the next month.' })
	}

	try {
		const { rows } = await pool.query(
			`SELECT h."date"::text AS date, h.day, h.remarks
			 FROM counters c
			 JOIN employees e ON e.employee_id = c.employee_id
			 JOIN holiday h ON h.user_id = e.user_id
			 WHERE c.counter_id = $1 AND h."date" BETWEEN $2::date AND $3::date
			 ORDER BY h."date"`,
			[counterId, from, to],
		)
		return response.json({ holidays: rows, maxBookingDate: maxBookingDate() })
	} catch (error) {
		console.error('Unable to load holidays:', error.message)
		return response.status(500).json({ message: 'Unable to load holidays for this counter.' })
	}
})

router.get('/availability', async (request, response) => {
	const counterId = Number(request.query.counterId)
	const date = request.query.date
	const serviceId = request.query.serviceId ? Number(request.query.serviceId) : null
	const dateError = validateBookingDate(date)
	if (!Number.isSafeInteger(counterId) || counterId < 1
		|| (serviceId !== null && (!Number.isSafeInteger(serviceId) || serviceId < 1))
		|| dateError) {
		return response.status(400).json({ message: dateError || 'Select a valid counter and service.' })
	}

	const client = await pool.connect()
	try {
		const { rows: counterRows } = await client.query(
			`SELECT c.counter_id, c.counter_name, go.gov_id, go.buffer_time_minutes,
			        go.opening_time, go.closing_time
			 FROM counters c
			 JOIN employees e ON e.employee_id = c.employee_id
			 JOIN government_office go ON go.gov_id = e.gov_id
			 WHERE c.counter_id = $1`,
			[counterId],
		)
		if (!counterRows.length) return response.status(404).json({ message: 'That service counter is not available.' })
		const counter = counterRows[0]
		const officeHours = await getOfficeHours(client, date, counter.opening_time, counter.closing_time)
		const officeHoursResult = {
			canJoin: officeHours.withinHours,
			officeHours: { opening: officeHours.openingTime, closing: officeHours.closingTime, timezone: officeTimezone },
			message: officeHours.message,
		}

		if (serviceId === null) {
			return response.json({ available: true, date, counter: { id: counter.counter_id, name: counter.counter_name }, ...officeHoursResult })
		}

		const { rows: serviceRows } = await client.query(
			`SELECT service_id, service_name
			 FROM services
			 WHERE counter_id = $1 AND service_id = $2`,
			[counterId, serviceId],
		)
		if (!serviceRows.length) return response.status(404).json({ message: 'That service is not available at this counter.' })

		const holiday = await getCounterHoliday(client, counterId, date)
		if (holiday) {
			return response.status(200).json({
				available: false,
				date,
				holiday: { day: holiday.day, remarks: holiday.remarks },
				message: 'This counter is closed for a holiday on the selected date.',
			})
		}

		const { rows: queueRows } = await client.query(
			' SELECT queue_id FROM queue WHERE counter_id = $1 AND queue_date = $2::date ORDER BY queue_id LIMIT 1',
			[counterId, date],
		)
		const estimate = queueRows.length
			? await getQueueEstimate(client, queueRows[0].queue_id, counter.buffer_time_minutes)
			: { peopleWaiting: 0, rawWaitMinutes: 0, bufferMinutes: minutesFromBuffer(counter.buffer_time_minutes), estimatedWaitMinutes: 0 }

		return response.json({
			available: true,
			date,
			counter: { id: counter.counter_id, name: counter.counter_name },
			service: { id: serviceRows[0].service_id, name: serviceRows[0].service_name },
			...officeHoursResult,
			...estimate,
		})
	} catch (error) {
		console.error('Unable to check queue availability:', error.message)
		return response.status(500).json({ message: 'Unable to check queue availability.' })
	} finally {
		client.release()
	}
})

router.post('/join', async (request, response) => {
	const counterId = Number(request.body?.counterId)
	const serviceId = Number(request.body?.serviceId)
	const date = request.body?.date
	const dateError = validateBookingDate(date)
	if (!Number.isSafeInteger(counterId) || counterId < 1 || !Number.isSafeInteger(serviceId) || serviceId < 1 || dateError) {
		return response.status(400).json({ message: dateError || 'Select a valid counter and service.' })
	}

	const client = await pool.connect()
	try {
		await client.query('BEGIN')
		await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`${counterId}:${date}`])

		const { rows: selectedRows } = await client.query(
			`SELECT c.counter_id, c.counter_name, go.buffer_time_minutes,
			        go.opening_time, go.closing_time, s.service_id, s.service_name
			 FROM counters c
			 JOIN employees e ON e.employee_id = c.employee_id
			 JOIN government_office go ON go.gov_id = e.gov_id
			 JOIN services s ON s.counter_id = c.counter_id
			 WHERE c.counter_id = $1 AND s.service_id = $2`,
			[counterId, serviceId],
		)
		if (!selectedRows.length) {
			await client.query('ROLLBACK')
			return response.status(404).json({ message: 'That service is not available at this counter.' })
		}
		const officeHours = await getOfficeHours(client, date, selectedRows[0].opening_time, selectedRows[0].closing_time)
		if (!officeHours.withinHours) {
			await client.query('ROLLBACK')
			return response.status(409).json({ message: officeHours.message, officeHours: { opening: officeHours.openingTime, closing: officeHours.closingTime, timezone: officeTimezone } })
		}

		const holiday = await getCounterHoliday(client, counterId, date)
		if (holiday) {
			await client.query('ROLLBACK')
			return response.status(409).json({ available: false, message: 'This counter is closed for a holiday on the selected date.' })
		}

		let { rows: queueRows } = await client.query(
			'SELECT queue_id FROM queue WHERE counter_id = $1 AND queue_date = $2::date ORDER BY queue_id LIMIT 1 FOR UPDATE',
			[counterId, date],
		)
		if (!queueRows.length) {
			queueRows = (await client.query(
				'INSERT INTO queue (counter_id, queue_date) VALUES ($1, $2::date) RETURNING queue_id',
				[counterId, date],
			)).rows
		}
		const queueId = queueRows[0].queue_id

		const { rows: existingRows } = await client.query(
			`SELECT member_id FROM queue_members
			 WHERE queue_id = $1 AND user_id = $2 AND service_id = $3
			   AND status <> ALL($4::varchar[])
			 LIMIT 1`,
			[queueId, request.citizen.userId, serviceId, terminalStatuses],
		)
		if (existingRows.length) {
			await client.query('ROLLBACK')
			return response.status(409).json({ message: 'You already have an active place in this queue for that service.' })
		}

		const { rows: positionRows } = await client.query(
			'SELECT COALESCE(MAX(q_position), 0)::int + 1 AS next_position FROM queue_members WHERE queue_id = $1',
			[queueId],
		)
		const position = positionRows[0].next_position
		const tokenNumber = `C${counterId}-${position}`
		const { rows: memberRows } = await client.query(
			`INSERT INTO queue_members (queue_id, user_id, service_id, token_number, q_position, status, "date", time_given)
			 SELECT $1, $2, $3, $4, $5, 'not arrived', $6::date,
			        COALESCE(
			            (
			                SELECT qm.time_given
			                FROM queue_members qm
			                WHERE qm.queue_id = $1
			                  AND qm.status NOT IN ('serving', 'completed')
			                ORDER BY qm.q_position
			                LIMIT 1
			            ),
			            ($6::date + go.opening_time)
			        ) + make_interval(mins => COALESCE(
			            (
			                SELECT SUM(s.average_service_minutes)::int
			                FROM queue_members qm
			                JOIN services s ON s.service_id = qm.service_id
			                WHERE qm.queue_id = $1
			                  AND qm.status NOT IN ('serving', 'completed')
			            ),
			            0
			        ))
			 FROM counters c
			 JOIN employees e ON e.employee_id = c.employee_id
			 JOIN government_office go ON go.gov_id = e.gov_id
			 WHERE c.counter_id = $7
			 RETURNING member_id, token_number, q_position, status, time_given`,
			[queueId, request.citizen.userId, serviceId, tokenNumber, position, date, counterId],
		)
		const estimate = await getQueueEstimate(client, queueId, selectedRows[0].buffer_time_minutes, position)
		await client.query('COMMIT')

		return response.status(201).json({
			message: 'You joined the queue successfully.',
			date,
			counter: { id: selectedRows[0].counter_id, name: selectedRows[0].counter_name },
			service: { id: selectedRows[0].service_id, name: selectedRows[0].service_name },
			booking: memberRows[0],
			peopleAhead: estimate.peopleWaiting,
			estimatedWaitMinutes: estimate.estimatedWaitMinutes,
		})
	} catch (error) {
		await client.query('ROLLBACK')
		console.error('Unable to join queue:', error.message)
		return response.status(500).json({ message: 'Unable to join the queue right now.' })
	} finally {
		client.release()
	}
})

module.exports = router