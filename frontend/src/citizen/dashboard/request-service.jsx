import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { queueApiRequest } from '../queueApi.js'

const toLocalDateString = (date) => {
	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	return `${year}-${month}-${day}`
}

const addOneMonth = (date) => {
	const next = new Date(date.getFullYear(), date.getMonth() + 1, 1)
	const finalDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
	return new Date(next.getFullYear(), next.getMonth(), Math.min(date.getDate(), finalDay))
}

const RequestService = () => {
	const { startGeofenceTracking, trackingActive } = useOutletContext()
	const today = useMemo(() => new Date(), [])
	const todayValue = toLocalDateString(today)
	const maximumDate = toLocalDateString(addOneMonth(today))
	const [counters, setCounters] = useState([])
	const [services, setServices] = useState([])
	const [counterId, setCounterId] = useState('')
	const [serviceId, setServiceId] = useState('')
	const [dateChoice, setDateChoice] = useState('today')
	const [selectedDate, setSelectedDate] = useState(todayValue)
	const [calendarMonth, setCalendarMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
	const [holidays, setHolidays] = useState([])
	const [availability, setAvailability] = useState(null)
	const [booking, setBooking] = useState(null)
	const [error, setError] = useState('')
	const [loadingCounters, setLoadingCounters] = useState(true)
	const [loadingServices, setLoadingServices] = useState(false)
	const [loadingAvailability, setLoadingAvailability] = useState(false)
	const [joining, setJoining] = useState(false)

	useEffect(() => {
		let isMounted = true
		queueApiRequest('/api/queue/counters')
			.then((result) => { if (isMounted) setCounters(result.counters) })
			.catch((requestError) => { if (isMounted) setError(requestError.message) })
			.finally(() => { if (isMounted) setLoadingCounters(false) })
		return () => { isMounted = false }
	}, [])

	useEffect(() => {
		if (!counterId) return undefined

		let isMounted = true
		const query = new URLSearchParams({ counterId, from: todayValue, to: maximumDate })
		queueApiRequest(`/api/queue/holidays?${query}`)
			.then((result) => { if (isMounted) setHolidays(result.holidays) })
			.catch((requestError) => { if (isMounted) setError(requestError.message) })
		return () => { isMounted = false }
	}, [counterId, maximumDate, todayValue])

	const handleCounterChange = async (event) => {
		const nextCounterId = event.target.value
		setCounterId(nextCounterId)
		setServices([])
		setServiceId('')
		setAvailability(null)
		setBooking(null)
		if (!nextCounterId) setHolidays([])
		setError('')
		if (!nextCounterId) return

		setLoadingServices(true)
		try {
			const result = await queueApiRequest(`/api/queue/counters/${nextCounterId}/services`)
			setServices(result.services)
		} catch (requestError) {
			setError(requestError.message)
		} finally {
			setLoadingServices(false)
		}
	}

	const holidayByDate = useMemo(() => new Map(holidays.map((holiday) => [holiday.date, holiday])), [holidays])
	const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1)
	const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate()
	const calendarCells = [
		...Array(monthStart.getDay()).fill(null),
		...Array.from({ length: daysInMonth }, (_, index) => new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), index + 1)),
	]
	const visibleMonthValue = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}`
	const firstAllowedMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
	const lastAllowedDate = addOneMonth(today)
	const lastAllowedMonth = `${lastAllowedDate.getFullYear()}-${String(lastAllowedDate.getMonth() + 1).padStart(2, '0')}`
	const selectedHoliday = holidayByDate.get(dateChoice === 'today' ? todayValue : selectedDate)
	const effectiveDate = dateChoice === 'today' ? todayValue : selectedDate
	const changeDateChoice = (choice) => {
		setDateChoice(choice)
		setSelectedDate(todayValue)
		setAvailability(null)
		setBooking(null)
		setError('')
	}

	const searchQueue = async () => {
		setError('')
		setAvailability(null)
		setBooking(null)
		if (selectedHoliday) {
			setError(`This counter is closed for a holiday${selectedHoliday.remarks ? `: ${selectedHoliday.remarks}` : '.'}`)
			return
		}
		setLoadingAvailability(true)
		try {
			const query = new URLSearchParams({ counterId, serviceId, date: effectiveDate })
			const result = await queueApiRequest(`/api/queue/availability?${query}`)
			if (!result.available) {
				setError(result.message)
				return
			}
			setAvailability(result)
		} catch (requestError) {
			setError(requestError.message)
		} finally {
			setLoadingAvailability(false)
		}
	}

	const joinQueue = async () => {
		setJoining(true)
		setError('')
		try {
			const result = await queueApiRequest('/api/queue/join', {
				method: 'POST',
				body: { counterId: Number(counterId), serviceId: Number(serviceId), date: effectiveDate },
			})
			setBooking(result)
			setAvailability(null)
			startGeofenceTracking(effectiveDate)
		} catch (requestError) {
			setError(requestError.message)
		} finally {
			setJoining(false)
		}
	}

	const shiftMonth = (increment) => {
		const next = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + increment, 1)
		const nextValue = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
		if (nextValue >= firstAllowedMonth && nextValue <= lastAllowedMonth) setCalendarMonth(next)
	}

	return (
		<>
			<div className="dashboard-heading-row request-heading">
				<div><p className="dashboard-eyebrow"><span /> SERVICES</p><h1>Request a service</h1><p className="dashboard-subtitle">Choose a counter and service to find your place in line.</p></div>
			</div>

			{booking ? (
				<section className="dashboard-section request-result booking-confirmation" role="status">
					<span className="booking-success-icon"><i className="fa-solid fa-check" aria-hidden="true" /></span>
					<p className="dashboard-eyebrow">BOOKING CONFIRMED</p>
					<h2>You’re in the queue</h2>
					<p>{booking.service.name} at {booking.counter.name} on {booking.date}.</p>
					<div className="booking-token"><span>Your token</span><strong>{booking.booking.token_number}</strong><span>Position {booking.booking.q_position}</span></div>
					<p className="booking-wait">There {booking.peopleAhead === 1 ? 'is' : 'are'} <strong>{booking.peopleAhead}</strong> {booking.peopleAhead === 1 ? 'person' : 'people'} ahead. Estimated wait: <strong>{formatWait(booking.estimatedWaitMinutes)}</strong>.</p>
					<p className="booking-geofence-note"><i className={`fa-solid ${trackingActive ? 'fa-location-dot' : 'fa-location-crosshairs'}`} aria-hidden="true" />{trackingActive ? 'Campus arrival tracking is enabled for this visit.' : 'Starting campus arrival tracking. Keep this page open for location updates.'}</p>
				</section>
			) : (
				<div className="request-layout">
					<section className="dashboard-section request-form-section">
						<div className="request-section-title"><span className="request-step">01</span><div><h2>Choose a service</h2><p>Start by selecting a counter and service.</p></div></div>
						<div className="request-fields">
							<label className="request-field"><span>Service counter</span><span className="request-select-wrap"><i className="fa-solid fa-building-columns" aria-hidden="true" /><select value={counterId} onChange={handleCounterChange} disabled={loadingCounters}><option value="">{loadingCounters ? 'Loading counters…' : 'Choose a counter'}</option>{counters.map((counter) => <option key={counter.counter_id} value={counter.counter_id}>{counter.counter_name}{counter.gov_name ? ` · ${counter.gov_name}` : ''}</option>)}</select><i className="fa-solid fa-chevron-down select-chevron" aria-hidden="true" /></span></label>
							<label className="request-field"><span>Service</span><span className="request-select-wrap"><i className="fa-solid fa-file-lines" aria-hidden="true" /><select value={serviceId} onChange={(event) => { setServiceId(event.target.value); setAvailability(null); setBooking(null); setError('') }} disabled={!counterId || loadingServices}><option value="">{loadingServices ? 'Loading services…' : counterId ? 'Choose a service' : 'Select a counter first'}</option>{services.map((service) => <option key={service.service_id} value={service.service_id}>{service.service_name} · {service.average_service_minutes} min</option>)}</select><i className="fa-solid fa-chevron-down select-chevron" aria-hidden="true" /></span></label>
						</div>

						<div className="request-divider" />
						<div className="request-section-title"><span className="request-step">02</span><div><h2>When would you like to join?</h2><p>Choose today or a date within the next month.</p></div></div>
						<div className="date-choice" role="group" aria-label="Queue date choice">
							<button type="button" className={dateChoice === 'today' ? 'date-choice-button is-active' : 'date-choice-button'} onClick={() => changeDateChoice('today')}><i className="fa-solid fa-sun" aria-hidden="true" /><span>Today</span></button>
							<button type="button" className={dateChoice === 'specific' ? 'date-choice-button is-active' : 'date-choice-button'} onClick={() => changeDateChoice('specific')}><i className="fa-regular fa-calendar" aria-hidden="true" /><span>Specific date</span></button>
						</div>

						{dateChoice === 'specific' && (
							<div className="date-calendar" aria-label="Choose a date">
								<div className="calendar-heading"><button type="button" className="calendar-month-button" onClick={() => shiftMonth(-1)} disabled={visibleMonthValue <= firstAllowedMonth} aria-label="Previous month"><i className="fa-solid fa-chevron-left" /></button><strong>{new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(calendarMonth)}</strong><button type="button" className="calendar-month-button" onClick={() => shiftMonth(1)} disabled={visibleMonthValue >= lastAllowedMonth} aria-label="Next month"><i className="fa-solid fa-chevron-right" /></button></div>
								<div className="calendar-grid calendar-weekdays">{['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((weekday) => <span key={weekday}>{weekday}</span>)}</div>
								<div className="calendar-grid">{calendarCells.map((date, index) => {
									if (!date) return <span className="calendar-blank" key={`blank-${index}`} />
									const dateValue = toLocalDateString(date)
									const holiday = holidayByDate.get(dateValue)
									const inRange = dateValue >= todayValue && dateValue <= maximumDate
									const isSelected = dateValue === selectedDate
									return <button className={`calendar-day${isSelected ? ' is-selected' : ''}${holiday ? ' is-holiday' : ''}`} type="button" key={dateValue} disabled={!inRange || Boolean(holiday)} aria-label={`${dateValue}${holiday ? `, holiday${holiday.remarks ? `: ${holiday.remarks}` : ''}` : ''}`} onClick={() => { setSelectedDate(dateValue); setAvailability(null); setBooking(null); setError('') }}><span>{date.getDate()}</span>{holiday && <small>Holiday</small>}</button>
								})}</div>
								<p className="calendar-note"><span className="holiday-key" /> Holiday, counter closed</p>
							</div>
						)}
						{dateChoice === 'today' && selectedHoliday && <div className="selected-holiday-note"><i className="fa-solid fa-calendar-xmark" aria-hidden="true" /><span>Today is marked as a holiday{selectedHoliday.remarks ? `: ${selectedHoliday.remarks}` : ''}.</span></div>}

						{error && <p className="request-error" role="alert"><i className="fa-solid fa-circle-exclamation" aria-hidden="true" />{error}</p>}
						<button className="request-search-button" type="button" onClick={searchQueue} disabled={!counterId || !serviceId || loadingAvailability || joining || Boolean(selectedHoliday) || (dateChoice === 'specific' && (!selectedDate || selectedDate > maximumDate))}><span>{loadingAvailability ? 'Checking the queue…' : 'Search queue'}</span><i className={`fa-solid ${loadingAvailability ? 'fa-spinner fa-spin' : 'fa-magnifying-glass'}`} aria-hidden="true" /></button>
					</section>

					<aside className="request-side-note">
						<span className="request-note-icon"><i className="fa-solid fa-hourglass-half" aria-hidden="true" /></span>
						<p className="dashboard-eyebrow">PLAN AHEAD</p>
						<h2>Less waiting.<br />More certainty.</h2>
						<p>Check the live queue estimate before you decide to join. Bookings are available up to one month ahead.</p>
						<div className="privacy-note"><i className="fa-solid fa-shield-halved" aria-hidden="true" /><span>Your place is linked securely to your citizen account.</span></div>
					</aside>
				</div>
			)}

			{availability && !booking && (
				<section className="dashboard-section request-result" aria-live="polite">
					<div className="result-title"><span className="result-icon"><i className="fa-solid fa-people-group" aria-hidden="true" /></span><div><p className="dashboard-eyebrow">QUEUE ESTIMATE</p><h2>{availability.counter.name}</h2><p>{availability.service.name} · {availability.date}</p></div></div>
					<div className="result-stats"><div><strong>{availability.peopleWaiting}</strong><span>{availability.peopleWaiting === 1 ? 'person' : 'people'} currently waiting</span></div><div><strong>{formatWait(availability.estimatedWaitMinutes)}</strong><span>estimated time until your turn</span></div></div>
					<p className="buffer-explanation">Estimate accounts for the service times ahead and the counter’s scheduling buffer.</p>
					<button className="request-search-button join-queue-button" type="button" onClick={joinQueue} disabled={joining}><span>{joining ? 'Joining queue…' : 'Join this queue'}</span><i className={`fa-solid ${joining ? 'fa-spinner fa-spin' : 'fa-arrow-right'}`} aria-hidden="true" /></button>
				</section>
			)}
		</>
	)
}

const formatWait = (minutes) => {
	if (minutes < 60) return `${minutes} min`
	const hours = Math.floor(minutes / 60)
	const remainingMinutes = minutes % 60
	return remainingMinutes ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`
}

export default RequestService