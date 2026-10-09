import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../assets/citizen_css/dashboard.css'
import '../assets/employee_css/employee.css'
import { employeeApiRequest } from './employeeApi.js'

const officeToday = (timeZone = 'Asia/Kolkata') => {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
	}).formatToParts(new Date())
	const values = Object.fromEntries(parts.filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]))
	return `${values.year}-${values.month}-${values.day}`
}

const statusLabels = {
	'arrived': 'Arrived',
	'not arrived': 'Waiting for arrival',
	serving: 'In service',
	completed: 'Completed',
	late: 'Late',
	no_show: 'No show',
	cancelled: 'Cancelled',
}

const EmployeeDashboard = () => {
	const [session, setSession] = useState(() => {
		try { return JSON.parse(sessionStorage.getItem('qmate.employee.auth') || 'null') } catch { return null }
	})
	const [counters, setCounters] = useState([])
	const [isLoadingCounters, setIsLoadingCounters] = useState(true)
	const [counterId, setCounterId] = useState('')
	const [date, setDate] = useState(officeToday)
	const [items, setItems] = useState([])
	const [isLoading, setIsLoading] = useState(false)
	const [busyMemberId, setBusyMemberId] = useState(null)
	const [error, setError] = useState('')
	const [notice, setNotice] = useState('')
	const [refreshTick, setRefreshTick] = useState(0)
	const navigate = useNavigate()
	const user = session?.user
	const firstName = user?.name?.trim().split(/\s+/)[0] || 'there'
	const selectedCounter = counters.find((counter) => String(counter.counter_id) === String(counterId))
	const activeItems = items.filter(({ status }) => ['not arrived', 'arrived', 'serving', 'late'].includes(status))
	const arrivedCount = items.filter(({ status }) => status === 'arrived').length
	const servingCount = items.filter(({ status }) => status === 'serving').length
	const completedCount = items.filter(({ status }) => status === 'completed').length

	useEffect(() => {
		document.title = 'QMate | Employee desk'
		return () => { document.title = 'QMate | Citizen access' }
	}, [])

	useEffect(() => {
		let ignore = false
		const loadCounters = async () => {
			try {
				const result = await employeeApiRequest('/api/employee/counters')
				if (ignore) return
				setCounters(result.counters)
				setCounterId((current) => current || String(result.counters[0]?.counter_id || ''))
				setDate(officeToday(result.officeTimezone))
			} catch (requestError) {
				if (!ignore) setError(requestError.message)
			} finally {
				if (!ignore) setIsLoadingCounters(false)
			}
		}
		loadCounters()
		return () => { ignore = true }
	}, [])

	useEffect(() => {
		if (!counterId) return undefined
		let ignore = false
		const loadQueue = async () => {
			setIsLoading(true)
			try {
				const params = new URLSearchParams({ counterId, date })
				const result = await employeeApiRequest(`/api/employee/queue?${params}`)
				if (!ignore) {
					setItems(result.items)
					setError('')
				}
			} catch (requestError) {
				if (!ignore) setError(requestError.message)
			} finally {
				if (!ignore) setIsLoading(false)
			}
		}
		loadQueue()
		const interval = window.setInterval(loadQueue, 20000)
		return () => { ignore = true; window.clearInterval(interval) }
	}, [counterId, date, refreshTick])

	const handleEntryAction = async (item, action) => {
		setBusyMemberId(item.member_id)
		setError('')
		setNotice('')
		try {
			const result = await employeeApiRequest(`/api/employee/entries/${item.member_id}/${action}`, { method: 'POST' })
			setNotice(result.message || (action === 'start' ? 'Service started.' : 'Service completed.'))
			setRefreshTick((tick) => tick + 1)
		} catch (requestError) {
			setError(requestError.message)
		} finally {
			setBusyMemberId(null)
		}
	}

	const signOut = () => {
		sessionStorage.removeItem('qmate.employee.auth')
		setSession(null)
		navigate('/employee/auth', { replace: true })
	}

	return (
		<div className="citizen-dashboard employee-dashboard">
			<aside className="citizen-sidebar">
				<a className="dashboard-brand" href="/employee/dashboard" aria-label="QMate employee dashboard"><span className="dashboard-brand-mark"><i className="fa-solid fa-ticket" aria-hidden="true" /></span><span>QMate<span className="dashboard-brand-period">.</span></span></a>
				<nav className="citizen-side-nav" aria-label="Employee workspace navigation"><p className="sidebar-group-label">SERVICE DESK</p><a className="sidebar-link is-active" href="/employee/dashboard"><i className="fa-solid fa-list-check" aria-hidden="true" /><span>Live queue</span></a></nav>
				<div className="sidebar-bottom"><div className="sidebar-account"><span className="user-avatar">{firstName.slice(0, 1).toUpperCase()}</span><span><strong>{firstName}</strong><small>Employee account</small></span></div><button className="sidebar-link sidebar-logout" type="button" onClick={signOut}><i className="fa-solid fa-arrow-right-from-bracket" aria-hidden="true" /><span>Log out</span></button></div>
			</aside>
			<div className="dashboard-workspace">
				<header className="dashboard-mobile-header"><span>QMate employee desk</span><span className="user-avatar">{firstName.slice(0, 1).toUpperCase()}</span></header>
				<main className="dashboard-main">
					<div className="dashboard-heading-row employee-heading-row"><div><p className="dashboard-eyebrow"><span /> EMPLOYEE PANEL</p><h1>Good day, {firstName}.</h1><p className="dashboard-subtitle">Your assigned counter queue at a glance.</p></div><div className="dashboard-date"><i className="fa-regular fa-calendar" aria-hidden="true" /><span>{new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}</span></div></div>
					<section className="dashboard-stat-grid employee-stat-grid" aria-label="Queue summary">
						<article className="dashboard-stat"><span className="stat-icon stat-icon--orange"><i className="fa-solid fa-users" aria-hidden="true" /></span><div><span className="stat-label">Active queue</span><strong>{activeItems.length}</strong></div><span className="stat-footnote">Customers not yet completed</span></article>
						<article className="dashboard-stat"><span className="stat-icon stat-icon--sage"><i className="fa-solid fa-person-circle-check" aria-hidden="true" /></span><div><span className="stat-label">Ready to serve</span><strong>{arrivedCount}</strong></div><span className="stat-footnote">Arrived at your counter</span></article>
						<article className="dashboard-stat dashboard-stat--note"><span className="stat-icon stat-icon--sand"><i className="fa-solid fa-circle-check" aria-hidden="true" /></span><div><span className="stat-label">Completed today</span><strong>{completedCount}</strong></div><span className="stat-footnote">{servingCount} currently being served</span></article>
					</section>
					<section className="dashboard-section employee-queue-section">
						<div className="section-heading employee-queue-heading"><div><p className="dashboard-eyebrow">COUNTER OPERATIONS</p><h2>{selectedCounter?.counter_name || 'Assigned queue'}</h2><p className="employee-office-label">{selectedCounter?.office_name || user?.officeName || 'Your service counter'}</p></div><button className="employee-refresh" type="button" title="Refresh queue" aria-label="Refresh queue" onClick={() => setRefreshTick((tick) => tick + 1)} disabled={isLoading}><i className={`fa-solid fa-rotate${isLoading ? ' fa-spin' : ''}`} aria-hidden="true" /></button></div>
						<div className="employee-queue-controls"><label className="employee-control"><span>Counter</span><select value={counterId} onChange={(event) => setCounterId(event.target.value)} disabled={!counters.length}><option value="">No assigned counters</option>{counters.map((counter) => <option key={counter.counter_id} value={counter.counter_id}>Counter {counter.counter_number} · {counter.counter_name}</option>)}</select></label><label className="employee-control"><span>Queue date</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><span className="employee-live-indicator"><i /> Live refresh · 20 sec</span></div>
						{error && <p className="employee-feedback employee-feedback--error" role="alert"><i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />{error}</p>}
						{notice && <p className="employee-feedback employee-feedback--success" role="status"><i className="fa-solid fa-circle-check" aria-hidden="true" />{notice}</p>}
						{!isLoadingCounters && !counters.length ? <div className="employee-empty"><span><i className="fa-solid fa-building" aria-hidden="true" /></span><h3>No counter is assigned</h3><p>Your employee account is valid, but no service counter is currently assigned to it. Ask an administrator to assign a counter.</p></div> : (isLoadingCounters || isLoading) && !items.length ? <div className="employee-empty employee-empty--compact"><i className="fa-solid fa-circle-notch fa-spin" aria-hidden="true" /><p>Loading today’s queue…</p></div> : items.length ? <div className="employee-table-wrap"><table className="employee-queue-table"><thead><tr><th>Position</th><th>Customer</th><th>Service</th><th>Status</th><th>Est. time</th><th>Action</th></tr></thead><tbody>{items.map((item) => <tr key={item.member_id}><td><strong className="employee-token">{item.token_number}</strong><small>#{item.q_position}</small></td><td><strong>{item.citizen_name}</strong><small>{item.arrived_at ? `Arrived ${new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(item.arrived_at))}` : 'Arrival not recorded'}</small></td><td>{item.service_name}<small>{item.average_service_minutes} min service</small></td><td><span className={`employee-status employee-status--${item.status.replaceAll(' ', '-')}`}>{statusLabels[item.status] || item.status}</span></td><td>{item.time_given || '—'}</td><td>{item.status === 'arrived' ? <button className="employee-row-action" type="button" disabled={busyMemberId === item.member_id} onClick={() => handleEntryAction(item, 'start')}>{busyMemberId === item.member_id ? 'Working…' : 'Start service'}<i className="fa-solid fa-arrow-right" aria-hidden="true" /></button> : item.status === 'serving' ? <button className="employee-row-action employee-row-action--complete" type="button" disabled={busyMemberId === item.member_id} onClick={() => handleEntryAction(item, 'complete')}>{busyMemberId === item.member_id ? 'Working…' : 'Complete'}<i className="fa-solid fa-check" aria-hidden="true" /></button> : <span className="employee-no-action">{item.status === 'completed' ? 'Done' : '—'}</span>}</td></tr>)}</tbody></table></div> : <div className="employee-empty"><span><i className="fa-solid fa-ticket" aria-hidden="true" /></span><h3>No queue entries for this date</h3><p>When customers join this counter’s queue, they’ll appear here automatically.</p></div>}
					</section>
				</main>
				<footer className="dashboard-footer"><span>QMate employee desk</span><span><i className="fa-solid fa-shield-halved" aria-hidden="true" /> Employee workspace</span></footer>
			</div>
		</div>
	)
}

export default EmployeeDashboard