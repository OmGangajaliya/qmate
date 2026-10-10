const express = require('express')
const bcrypt = require('bcryptjs')
const { pool } = require('../db/connectdb')
const requireAdmin = require('../middlewares/admin-auth.middleware')

const router = express.Router()
const validPhone = (phone) => /^\+?\d{8,15}$/.test(phone)
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/
const officeTimezone = process.env.OFFICE_TIMEZONE || 'Asia/Kolkata'
const isValidDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '')
	&& !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
	&& new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value

const validateGeofence = (value) => {
	if (!Array.isArray(value) || value.length < 3) return false
	return value.every((point) => Array.isArray(point) && point.length >= 2
		&& typeof point[0] === 'number' && Number.isFinite(point[0]) && point[0] >= -90 && point[0] <= 90
		&& typeof point[1] === 'number' && Number.isFinite(point[1]) && point[1] >= -180 && point[1] <= 180)
}

const parseGeofence = (value) => {
	let geofence = value
	while (typeof geofence === 'string') {
		try { geofence = JSON.parse(geofence) } catch { return null }
	}
	let isGeoJson = false
	if (!Array.isArray(geofence) && geofence && typeof geofence === 'object') {
		if (geofence.type === 'Feature') geofence = geofence.geometry
		if (geofence?.type === 'Polygon') {
			geofence = geofence.coordinates?.[0]
			isGeoJson = true
		}
	}
	if (!Array.isArray(geofence)) return geofence
	if (geofence.length === 1 && Array.isArray(geofence[0]?.[0])) geofence = geofence[0]
	return geofence.map((point) => {
		if (point && !Array.isArray(point) && typeof point === 'object') {
			point = [point.latitude ?? point.lat, point.longitude ?? point.lng]
		}
		if (!Array.isArray(point)) return point
		const coordinates = point.slice(0, 2).map((coordinate) => {
			if (typeof coordinate !== 'string' || !coordinate.trim()) return coordinate
			const numericCoordinate = Number(coordinate)
			return Number.isFinite(numericCoordinate) ? numericCoordinate : coordinate
		})
		return isGeoJson ? [coordinates[1], coordinates[0]] : coordinates
	})
}

router.use(requireAdmin)

router.get('/offices', async (_request, response) => {
	try {
		const { rows } = await pool.query(
			`SELECT go.gov_id, go.gov_name, go.address, go.phone, go.geofence_point,
			        go.buffer_time_minutes, go.opening_time, go.closing_time,
			        COUNT(DISTINCT e.employee_id)::int AS employee_count,
			        COUNT(DISTINCT c.counter_id)::int AS counter_count
			 FROM government_office go
			 LEFT JOIN employees e ON e.gov_id = go.gov_id
			 LEFT JOIN counters c ON c.employee_id = e.employee_id
			 GROUP BY go.gov_id
			 ORDER BY go.gov_name`,
		)
		return response.json({ offices: rows })
	} catch (error) {
		console.error('Unable to load government offices:', error.message)
		if (error.code === '42703') {
			try {
				const { rows } = await pool.query(
					`SELECT go.gov_id, go.gov_name, go.address, go.phone, go.geofence_point,
					        go.buffer_time_minutes,
					        '09:00'::time AS opening_time, '17:00'::time AS closing_time,
					        COUNT(DISTINCT e.employee_id)::int AS employee_count,
					        COUNT(DISTINCT c.counter_id)::int AS counter_count
					 FROM government_office go
					 LEFT JOIN employees e ON e.gov_id = go.gov_id
					 LEFT JOIN counters c ON c.employee_id = e.employee_id
					 GROUP BY go.gov_id
					 ORDER BY go.gov_name`,
				)
				return response.json({ offices: rows, officeHoursConfigured: false })
			} catch (fallbackError) {
				console.error('Unable to load office details without hours:', fallbackError.message)
			}
		}
		return response.status(500).json({ message: 'Unable to load government offices.' })
	}
})

router.post('/offices', async (request, response) => {
	const name = typeof request.body?.name === 'string' ? request.body.name.trim() : ''
	const address = typeof request.body?.address === 'string' ? request.body.address.trim() : ''
	const phone = typeof request.body?.phone === 'string' ? request.body.phone.trim().replace(/[\s()-]/g, '') : ''
	const openingTime = request.body?.openingTime
	const closingTime = request.body?.closingTime
	const bufferMinutes = Number(request.body?.bufferMinutes ?? 0)
	const geofence = parseGeofence(request.body?.geofencePoint)
	if (!name || name.length > 180 || !address || phone && !validPhone(phone)
		|| !timePattern.test(openingTime || '') || !timePattern.test(closingTime || '')
		|| openingTime >= closingTime || !Number.isInteger(bufferMinutes) || bufferMinutes < 0
		|| !validateGeofence(geofence)) {
		return response.status(400).json({ message: 'Enter a valid office name, address, opening hours, buffer, and geofence coordinates.' })
	}

	try {
		const { rows } = await pool.query(
			`INSERT INTO government_office
			 (gov_name, address, phone, geofence_point, buffer_time_minutes, opening_time, closing_time)
			 VALUES ($1, $2, $3, $4::jsonb, $5, $6::time, $7::time)
			 RETURNING gov_id, gov_name, address, phone, geofence_point,
			           buffer_time_minutes, opening_time, closing_time`,
			[name, address, phone || null, JSON.stringify(geofence), bufferMinutes, openingTime, closingTime],
		)
		return response.status(201).json({ office: rows[0], message: 'Government office created.' })
	} catch (error) {
		console.error('Unable to create government office:', error.message)
		if (error.code === '42703' || error.code === '42701') {
			return response.status(503).json({ message: 'Office hours are not installed in the database. Apply the government-office opening_time and closing_time migration first.' })
		}
		return response.status(500).json({ message: 'Unable to create this government office.' })
	}
})

router.put('/offices/:officeId', async (request, response) => {
	const officeId = Number(request.params.officeId)
	const name = typeof request.body?.name === 'string' ? request.body.name.trim() : ''
	const address = typeof request.body?.address === 'string' ? request.body.address.trim() : ''
	const phone = typeof request.body?.phone === 'string' ? request.body.phone.trim().replace(/[\s()-]/g, '') : ''
	const openingTime = request.body?.openingTime
	const closingTime = request.body?.closingTime
	const bufferMinutes = Number(request.body?.bufferMinutes ?? 0)
	const geofence = parseGeofence(request.body?.geofencePoint)
	const invalidFields = []
	if (!Number.isSafeInteger(officeId) || officeId < 1) invalidFields.push('office id')
	if (!name || name.length > 180) invalidFields.push('office name')
	if (!address) invalidFields.push('address')
	if (phone && !validPhone(phone)) invalidFields.push('contact phone')
	const hasValidOpeningTime = timePattern.test(openingTime || '')
	const hasValidClosingTime = timePattern.test(closingTime || '')
	if (!hasValidOpeningTime) invalidFields.push('opening time')
	if (!hasValidClosingTime) invalidFields.push('closing time')
	if (hasValidOpeningTime && hasValidClosingTime && openingTime >= closingTime) invalidFields.push('office hours order')
	if (!Number.isInteger(bufferMinutes) || bufferMinutes < 0) invalidFields.push('buffer minutes')
	if (!validateGeofence(geofence)) invalidFields.push('geofence coordinates')
	if (invalidFields.length) {
		return response.status(400).json({ message: `Invalid ${invalidFields.join(', ')}. Check the office details and try again.` })
	}

	try {
		const { rows } = await pool.query(
			`UPDATE government_office
			 SET gov_name = $2, address = $3, phone = $4, geofence_point = $5::jsonb,
			     buffer_time_minutes = $6, opening_time = $7::time, closing_time = $8::time
			 WHERE gov_id = $1
			 RETURNING gov_id, gov_name, address, phone, geofence_point,
			           buffer_time_minutes, opening_time, closing_time`,
			[officeId, name, address, phone || null, JSON.stringify(geofence), bufferMinutes, openingTime, closingTime],
		)
		if (!rows.length) return response.status(404).json({ message: 'Government office not found.' })
		return response.json({ office: rows[0], message: 'Government office updated.' })
	} catch (error) {
		console.error('Unable to update government office:', error.message)
		if (error.code === '42703') {
			return response.status(503).json({ message: 'Office hours are not installed in the database. Apply the government-office opening_time and closing_time migration first.' })
		}
		return response.status(500).json({ message: 'Unable to update this government office.' })
	}
})

router.get('/employees', async (_request, response) => {
	try {
		const { rows } = await pool.query(
			`SELECT e.employee_id, u.user_id, u.user_name, u.phone, u.created_at,
			        go.gov_id, go.gov_name,
			        COALESCE(json_agg(json_build_object(
			            'counterId', c.counter_id,
			            'counterName', c.counter_name,
			            'counterNumber', c.counter_number
			        )) FILTER (WHERE c.counter_id IS NOT NULL), '[]'::json) AS counters
			 FROM employees e
			 JOIN users u ON u.user_id = e.user_id
			 JOIN government_office go ON go.gov_id = e.gov_id
			 LEFT JOIN counters c ON c.employee_id = e.employee_id
			 GROUP BY e.employee_id, u.user_id, go.gov_id
			 ORDER BY u.user_name`,
		)
		return response.json({ employees: rows })
	} catch (error) {
		console.error('Unable to load employees:', error.message)
		return response.status(500).json({ message: 'Unable to load employees.' })
	}
})

router.post('/employees', async (request, response) => {
	const name = typeof request.body?.name === 'string' ? request.body.name.trim() : ''
	const phone = typeof request.body?.phone === 'string' ? request.body.phone.trim().replace(/[\s()-]/g, '') : ''
	const password = typeof request.body?.password === 'string' ? request.body.password : ''
	const officeId = Number(request.body?.officeId)
	const counterName = typeof request.body?.counterName === 'string' ? request.body.counterName.trim() : ''
	const counterNumber = Number(request.body?.counterNumber)
	if (!name || name.length > 160 || !validPhone(phone) || Buffer.byteLength(password, 'utf8') < 8
		|| Buffer.byteLength(password, 'utf8') > 72 || !Number.isSafeInteger(officeId) || officeId < 1
		|| !counterName || counterName.length > 120 || !Number.isSafeInteger(counterNumber) || counterNumber < 1) {
		return response.status(400).json({ message: 'Provide a valid name, phone, password, office, and counter assignment.' })
	}

	const client = await pool.connect()
	let transactionStarted = false
	try {
		await client.query('BEGIN')
		transactionStarted = true
		const officeResult = await client.query('SELECT gov_id FROM government_office WHERE gov_id = $1', [officeId])
		if (!officeResult.rows.length) {
			await client.query('ROLLBACK')
			transactionStarted = false
			return response.status(404).json({ message: 'Select an existing government office.' })
		}
		const passwordHash = await bcrypt.hash(password, 12)
		const { rows: userRows } = await client.query(
			`INSERT INTO users (user_name, phone, password_hash, role)
			 VALUES ($1, $2, $3, 'employee')
			 RETURNING user_id, user_name, phone`,
			[name, phone, passwordHash],
		)
		const { rows: employeeRows } = await client.query(
			`INSERT INTO employees (user_id, gov_id) VALUES ($1, $2)
			 RETURNING employee_id, gov_id`,
			[userRows[0].user_id, officeId],
		)
		const { rows: counterRows } = await client.query(
			`INSERT INTO counters (counter_number, employee_id, counter_name)
			 VALUES ($1, $2, $3)
			 RETURNING counter_id, counter_number, counter_name`,
			[counterNumber, employeeRows[0].employee_id, counterName],
		)
		await client.query('COMMIT')
		transactionStarted = false
		return response.status(201).json({
			message: 'Employee created and assigned to a counter.',
			employee: { ...userRows[0], employee_id: employeeRows[0].employee_id, gov_id: officeId, counter: counterRows[0] },
		})
	} catch (error) {
		if (transactionStarted) await client.query('ROLLBACK')
		if (error.code === '23505') return response.status(409).json({ message: 'That phone number or counter assignment already exists.' })
		console.error('Unable to create employee:', error.message)
		return response.status(500).json({ message: 'Unable to create this employee.' })
	} finally {
		client.release()
	}
})

router.get('/analytics', async (request, response) => {
	const from = request.query.from
	const to = request.query.to
	if (!isValidDate(from) || !isValidDate(to) || from > to) {
		return response.status(400).json({ message: 'Choose a valid analytics date range.' })
	}

	try {
		const [summary, daily, byOffice] = await Promise.all([
			pool.query(
				`SELECT COUNT(*)::int AS total_visits,
				        COUNT(*) FILTER (WHERE qm.status = 'completed')::int AS completed_visits,
				        COUNT(*) FILTER (WHERE qm.status IN ('cancelled', 'no_show'))::int AS cancelled_visits,
				        COUNT(DISTINCT qm.user_id)::int AS unique_citizens,
				        COUNT(DISTINCT e.employee_id)::int AS active_employees
				 FROM queue_members qm
				 JOIN queue q ON q.queue_id = qm.queue_id
				 JOIN counters c ON c.counter_id = q.counter_id
				 JOIN employees e ON e.employee_id = c.employee_id
				 WHERE q.queue_date BETWEEN $1::date AND $2::date`,
				[from, to],
			),
			pool.query(
				`SELECT q.queue_date::text AS date,
				        COUNT(qm.member_id)::int AS visits,
				        COUNT(qm.member_id) FILTER (WHERE qm.status = 'completed')::int AS completed
				 FROM queue q
				 JOIN counters c ON c.counter_id = q.counter_id
				 LEFT JOIN queue_members qm ON qm.queue_id = q.queue_id
				 WHERE q.queue_date BETWEEN $1::date AND $2::date
				 GROUP BY q.queue_date ORDER BY q.queue_date`,
				[from, to],
			),
			pool.query(
				`SELECT go.gov_name AS office_name, COUNT(qm.member_id)::int AS visits,
				        COUNT(qm.member_id) FILTER (WHERE qm.status = 'completed')::int AS completed
				 FROM government_office go
				 JOIN employees e ON e.gov_id = go.gov_id
				 JOIN counters c ON c.employee_id = e.employee_id
				 JOIN queue q ON q.counter_id = c.counter_id
				 LEFT JOIN queue_members qm ON qm.queue_id = q.queue_id
				 WHERE q.queue_date BETWEEN $1::date AND $2::date
				 GROUP BY go.gov_id ORDER BY visits DESC, go.gov_name`,
				[from, to],
			),
		])
		return response.json({ summary: summary.rows[0], daily: daily.rows, offices: byOffice.rows, from, to })
	} catch (error) {
		console.error('Unable to load admin analytics:', error.message)
		return response.status(500).json({ message: 'Unable to load analytics.' })
	}
})

router.get('/reports/employees', async (request, response) => {
	const from = request.query.from
	const to = request.query.to
	if (!isValidDate(from) || !isValidDate(to) || from > to) {
		return response.status(400).json({ message: 'Choose a valid employee report date range.' })
	}

	try {
		const { rows } = await pool.query(
			`SELECT e.employee_id, u.user_name AS employee_name, u.phone,
			        go.gov_name AS office_name, COUNT(cr.com_req_id)::int AS completed_visits,
			        ROUND(AVG(EXTRACT(EPOCH FROM (cr.end_at - cr.start_at)) / 60)::numeric, 1) AS average_service_minutes,
			        MIN(cr.end_at)::text AS first_completion,
			        MAX(cr.end_at)::text AS last_completion
			 FROM employees e
			 JOIN users u ON u.user_id = e.user_id
			 JOIN government_office go ON go.gov_id = e.gov_id
			 LEFT JOIN completed_requests cr ON cr.employee_id = e.employee_id
			     AND cr.end_at >= $1::date AND cr.end_at < ($2::date + INTERVAL '1 day')
			 GROUP BY e.employee_id, u.user_name, u.phone, go.gov_name
			 ORDER BY completed_visits DESC, u.user_name`,
			[from, to],
		)
		return response.json({ employees: rows, from, to })
	} catch (error) {
		console.error('Unable to load employee report:', error.message)
		return response.status(500).json({ message: 'Unable to load employee report.' })
	}
})

router.get('/config', (_request, response) => response.json({ officeTimezone }))

module.exports = router