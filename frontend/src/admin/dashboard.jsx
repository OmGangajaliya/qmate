import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../assets/admin_css/admin.css'
import { adminApiRequest } from './adminApi.js'
import GeofencePreviewMap from './GeofencePreviewMap.jsx'

const todayString = () => {
	const now = new Date()
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const startOfMonth = () => `${todayString().slice(0, 7)}-01`

const emptyOffice = {
	name: '', address: '', phone: '', openingTime: '09:00', closingTime: '17:00', bufferMinutes: '0',
	geofenceText: '',
}

const navigation = [
	{ id: 'overview', label: 'Overview', icon: 'fa-chart-pie' },
	{ id: 'offices', label: 'Government offices', icon: 'fa-building-columns' },
	{ id: 'employees', label: 'Employees', icon: 'fa-users' },
	{ id: 'analytics', label: 'Analytics', icon: 'fa-chart-line' },
	{ id: 'reports', label: 'Employee report', icon: 'fa-file-lines' },
]

const AdminDashboard = () => {
	const [session] = useState(() => {
		try { return JSON.parse(sessionStorage.getItem('qmate.admin.auth') || 'null') } catch { return null }
	})
	const [section, setSection] = useState('overview')
	const [offices, setOffices] = useState([])
	const [officeHoursConfigured, setOfficeHoursConfigured] = useState(true)
	const [employees, setEmployees] = useState([])
	const [analytics, setAnalytics] = useState(null)
	const [employeeReport, setEmployeeReport] = useState([])
	const [range, setRange] = useState({ from: startOfMonth(), to: todayString() })
	const [officeForm, setOfficeForm] = useState(emptyOffice)
	const [editingOfficeId, setEditingOfficeId] = useState(null)
	const [geofenceCaptureEnabled, setGeofenceCaptureEnabled] = useState(false)
	const [capturedGeofencePoints, setCapturedGeofencePoints] = useState([])
	const [capturingPointIndex, setCapturingPointIndex] = useState(null)
	const [geofenceCaptureError, setGeofenceCaptureError] = useState('')
	const [employeeForm, setEmployeeForm] = useState({ name: '', phone: '', password: '', officeId: '', counterName: '', counterNumber: '' })
	const [isLoading, setIsLoading] = useState(true)
	const [isSaving, setIsSaving] = useState(false)
	const [error, setError] = useState('')
	const [notice, setNotice] = useState('')
	const [refreshTick, setRefreshTick] = useState(0)
	const navigate = useNavigate()
	const user = session?.user
	const firstName = user?.name?.trim().split(/\s+/)[0] || 'Admin'
	const activeQueues = analytics?.summary?.total_visits || 0
	const completionRate = analytics?.summary?.total_visits
		? Math.round((analytics.summary.completed_visits / analytics.summary.total_visits) * 100)
		: 0
	const maxDailyVisits = useMemo(() => Math.max(1, ...(analytics?.daily || []).map((item) => item.visits)), [analytics])

	useEffect(() => { document.title = 'QMate | Admin console'; return () => { document.title = 'QMate | Citizen access' } }, [])

	useEffect(() => {
		let ignore = false
		const loadAdminData = async () => {
			setIsLoading(true)
			setError('')
			try {
				const params = new URLSearchParams(range)
				const [officeResult, employeeResult, analyticsResult, reportResult] = await Promise.all([
					adminApiRequest('/api/admin/offices'),
					adminApiRequest('/api/admin/employees'),
					adminApiRequest(`/api/admin/analytics?${params}`),
					adminApiRequest(`/api/admin/reports/employees?${params}`),
				])
				if (ignore) return
				setOffices(officeResult.offices)
				setOfficeHoursConfigured(officeResult.officeHoursConfigured !== false)
				setEmployees(employeeResult.employees)
				setAnalytics(analyticsResult)
				setEmployeeReport(reportResult.employees)
				setEmployeeForm((current) => current.officeId ? current : { ...current, officeId: String(officeResult.offices[0]?.gov_id || '') })
			} catch (requestError) {
				if (!ignore) setError(requestError.message)
			} finally {
				if (!ignore) setIsLoading(false)
			}
		}
		loadAdminData()
		return () => { ignore = true }
	}, [range, refreshTick])

	const refresh = () => setRefreshTick((tick) => tick + 1)
	const signOut = () => {
		sessionStorage.removeItem('qmate.admin.auth')
		navigate('/admin/auth', { replace: true })
	}
	const updateRange = (key, value) => setRange((current) => ({ ...current, [key]: value }))

	const startEditingOffice = (office) => {
		setEditingOfficeId(office.gov_id)
		setGeofenceCaptureEnabled(false)
		setCapturedGeofencePoints([])
		setGeofenceCaptureError('')
		setOfficeForm({
			name: office.gov_name,
			address: office.address,
			phone: office.phone || '',
			openingTime: String(office.opening_time).slice(0, 5),
			closingTime: String(office.closing_time).slice(0, 5),
			bufferMinutes: String(office.buffer_time_minutes ?? 0),
			geofenceText: JSON.stringify(office.geofence_point, null, 2),
		})
		window.scrollTo({ top: 0, behavior: 'smooth' })
	}

	const captureGeofencePoint = (pointIndex) => {
		if (!navigator.geolocation) {
			setGeofenceCaptureError('Location is not available in this browser.')
			return
		}
		setCapturingPointIndex(pointIndex)
		setGeofenceCaptureError('')
		navigator.geolocation.getCurrentPosition((position) => {
			const point = [position.coords.latitude, position.coords.longitude]
			setCapturedGeofencePoints((current) => {
				const next = [...current]
				next[pointIndex] = point
				return next
			})
			setCapturingPointIndex(null)
		}, (locationError) => {
			const messages = {
				1: 'Location permission is blocked. Allow location access in your browser settings.',
				2: 'Your current location is unavailable. Move to an open area and try again.',
				3: 'Getting your location took too long. Try again.',
			}
			setGeofenceCaptureError(messages[locationError.code] || 'Could not get your current location.')
			setCapturingPointIndex(null)
		}, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 })
	}

	const saveOffice = async (event) => {
		event.preventDefault()
		setIsSaving(true)
		setError('')
		setNotice('')
		try {
			let geofencePoint
			if (geofenceCaptureEnabled) {
				if (capturedGeofencePoints.length !== 4 || capturedGeofencePoints.some((point) => !point)) {
					throw new Error('Capture all four boundary points before saving the office.')
				}
				geofencePoint = capturedGeofencePoints
			} else {
				try { geofencePoint = JSON.parse(officeForm.geofenceText) } catch { throw new Error('Geofence must be valid JSON coordinate pairs.') }
			}
			const body = {
				name: officeForm.name,
				address: officeForm.address,
				phone: officeForm.phone,
				openingTime: officeForm.openingTime,
				closingTime: officeForm.closingTime,
				bufferMinutes: Number(officeForm.bufferMinutes),
				geofencePoint,
			}
			const path = editingOfficeId ? `/api/admin/offices/${editingOfficeId}` : '/api/admin/offices'
			const result = await adminApiRequest(path, { method: editingOfficeId ? 'PUT' : 'POST', body })
			setNotice(result.message)
			setOfficeForm(emptyOffice)
			setEditingOfficeId(null)
			setGeofenceCaptureEnabled(false)
			setCapturedGeofencePoints([])
			setGeofenceCaptureError('')
			refresh()
		} catch (requestError) {
			setError(requestError.message)
		} finally {
			setIsSaving(false)
		}
	}

	const createEmployee = async (event) => {
		event.preventDefault()
		setIsSaving(true)
		setError('')
		setNotice('')
		try {
			const result = await adminApiRequest('/api/admin/employees', {
				method: 'POST',
				body: { ...employeeForm, officeId: Number(employeeForm.officeId), counterNumber: Number(employeeForm.counterNumber) },
			})
			setNotice(result.message)
			setEmployeeForm({ name: '', phone: '', password: '', officeId: employeeForm.officeId, counterName: '', counterNumber: '' })
			refresh()
		} catch (requestError) {
			setError(requestError.message)
		} finally {
			setIsSaving(false)
		}
	}

	const pageCopy = {
		overview: ['ADMIN OVERVIEW', 'Good day,', 'A clear view of the QMate service network.'],
		offices: ['OFFICE DIRECTORY', 'Government offices', 'Manage office identity, hours, service buffer, and arrival boundaries.'],
		employees: ['STAFF DIRECTORY', 'Employees', 'Create staff access and assign an office counter.'],
		analytics: ['OPERATIONS', 'Analytics', 'Compare visits and completions across your selected date range.'],
		reports: ['PERFORMANCE', 'Employee report', 'Review completed visits and average handling time by employee.'],
	}[section]

	return (
		<div className="admin-app">
			<aside className="admin-sidebar">
				<a className="admin-brand" href="/admin/dashboard" aria-label="QMate admin console"><span className="admin-brand-mark"><i className="fa-solid fa-ticket" aria-hidden="true" /></span><span>QMate<span className="admin-brand-period">.</span></span></a>
				<p className="admin-nav-label">ADMINISTRATION</p>
				<nav className="admin-navigation" aria-label="Admin sections">{navigation.map((item) => <button key={item.id} className={`admin-nav-link${section === item.id ? ' is-active' : ''}`} type="button" title={item.label} onClick={() => { setSection(item.id); setError(''); setNotice('') }}><i className={`fa-solid ${item.icon}`} aria-hidden="true" /><span>{item.label}</span></button>)}</nav>
				<div className="admin-sidebar-bottom"><div className="admin-user"><span className="admin-user-avatar">{firstName.slice(0, 1).toUpperCase()}</span><span><strong>{user?.name || 'Administrator'}</strong><small>System administrator</small></span></div><button className="admin-signout" type="button" onClick={signOut}><i className="fa-solid fa-arrow-right-from-bracket" aria-hidden="true" /><span>Sign out</span></button></div>
			</aside>

			<div className="admin-workspace">
				<header className="admin-topbar"><div><span className="admin-topbar-label">Q MATE / ADMIN</span><strong>{user?.name || 'Administrator'} · Operations console</strong></div><div className="admin-topbar-actions"><span className="admin-topbar-date">{new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date())}</span><span className="admin-user-avatar">{firstName.slice(0, 1).toUpperCase()}</span></div></header>
				<main className="admin-main">
					<section className="admin-page-heading"><div><p className="admin-eyebrow">{pageCopy[0]}</p><h1>{section === 'overview' ? `${pageCopy[1]} ${firstName}.` : pageCopy[1]}</h1><p>{pageCopy[2]}</p></div>{section === 'offices' && <button className="admin-primary-button" type="button" onClick={() => { setEditingOfficeId(null); setOfficeForm(emptyOffice); setGeofenceCaptureEnabled(false); setCapturedGeofencePoints([]); setGeofenceCaptureError('') }}><i className="fa-solid fa-plus" aria-hidden="true" /> New office</button>}{section === 'employees' && <button className="admin-primary-button" type="button" onClick={() => document.getElementById('admin-employee-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}><i className="fa-solid fa-user-plus" aria-hidden="true" /> Add employee</button>}</section>
					{error && <p className="admin-feedback admin-feedback--error" role="alert"><i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />{error}</p>}
					{notice && <p className="admin-feedback admin-feedback--success" role="status"><i className="fa-solid fa-circle-check" aria-hidden="true" />{notice}</p>}
					{(section === 'analytics' || section === 'reports') && <div className="admin-toolbar"><label className="admin-field">From<input type="date" value={range.from} max={range.to} onChange={(event) => updateRange('from', event.target.value)} /></label><label className="admin-field">To<input type="date" value={range.to} min={range.from} max={todayString()} onChange={(event) => updateRange('to', event.target.value)} /></label><button className="admin-primary-button" type="button" onClick={refresh} disabled={isLoading}><i className="fa-solid fa-filter" aria-hidden="true" /> Apply range</button></div>}
					{isLoading && !analytics ? <div className="admin-panel admin-loading"><i className="fa-solid fa-circle-notch fa-spin" aria-hidden="true" />Loading administration data…</div> : <>
						{section === 'overview' && <>
							<section className="admin-metric-grid" aria-label="Administration summary"><article className="admin-metric"><span className="admin-metric-icon"><i className="fa-solid fa-building-columns" aria-hidden="true" /></span><div><span>Government offices</span><strong>{offices.length}</strong><small>Configured service locations</small></div></article><article className="admin-metric"><span className="admin-metric-icon"><i className="fa-solid fa-users" aria-hidden="true" /></span><div><span>Employees</span><strong>{employees.length}</strong><small>Provisioned staff accounts</small></div></article><article className="admin-metric"><span className="admin-metric-icon"><i className="fa-solid fa-ticket" aria-hidden="true" /></span><div><span>Queue visits</span><strong>{activeQueues}</strong><small>{range.from} through {range.to}</small></div></article><article className="admin-metric"><span className="admin-metric-icon"><i className="fa-solid fa-circle-check" aria-hidden="true" /></span><div><span>Completion rate</span><strong>{completionRate}%</strong><small>Completed queue visits</small></div></article></section>
							<div className="admin-content-grid"><section className="admin-panel"><header className="admin-panel-header"><div><h2>Daily service volume</h2><p>{range.from} to {range.to}</p></div><i className="fa-solid fa-chart-column" aria-hidden="true" /></header><div className="admin-panel-body">{analytics?.daily?.length ? <div className="admin-chart">{analytics.daily.map((item) => <div className="admin-bar-item" key={item.date} title={`${item.date}: ${item.visits} visits`}><div className="admin-bar-track"><span className="admin-bar" style={{ height: `${Math.max(4, (item.visits / maxDailyVisits) * 100)}%` }} /></div><small>{item.date.slice(5)}</small></div>)}</div> : <div className="admin-empty"><i className="fa-solid fa-chart-column" /><p>No queue activity in this range.</p></div>}</div></section><section className="admin-panel"><header className="admin-panel-header"><div><h2>Office activity</h2><p>Visits during the selected period</p></div></header><div className="admin-panel-body"><div className="admin-list">{analytics?.offices?.length ? analytics.offices.map((office) => <div className="admin-list-row" key={office.office_name}><strong>{office.office_name}</strong><span>{office.completed}/{office.visits} completed</span></div>) : <div className="admin-empty"><i className="fa-solid fa-building" /><p>No office activity yet.</p></div>}</div></div></section></div>
						</>}
						{section === 'offices' && <div className="admin-section-stack">
							{!officeHoursConfigured && <p className="admin-feedback admin-feedback--warning" role="status"><i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />The database has no office-hours columns yet. The office list remains available, but saving office hours requires the SQL migration documented in README.md.</p>}
							<section className="admin-panel">
								<header className="admin-panel-header"><div><h2>{editingOfficeId ? 'Edit government office' : 'Register government office'}</h2><p>Office hours and geofence are used by citizen bookings and arrival checks.</p></div></header>
								<form className="admin-panel-body" onSubmit={saveOffice}>
									<div className="admin-form-grid">
										<label className="admin-field">Office name<input required maxLength="180" value={officeForm.name} onChange={(event) => setOfficeForm({ ...officeForm, name: event.target.value })} /></label>
										<label className="admin-field">Contact phone<input inputMode="tel" value={officeForm.phone} onChange={(event) => setOfficeForm({ ...officeForm, phone: event.target.value })} /></label>
										<label className="admin-field admin-field--wide">Address<input required value={officeForm.address} onChange={(event) => setOfficeForm({ ...officeForm, address: event.target.value })} /></label>
										<label className="admin-field">Opening time<input type="time" required value={officeForm.openingTime} onChange={(event) => setOfficeForm({ ...officeForm, openingTime: event.target.value })} /></label>
										<label className="admin-field">Closing time<input type="time" required value={officeForm.closingTime} onChange={(event) => setOfficeForm({ ...officeForm, closingTime: event.target.value })} /></label>
										<label className="admin-field">Buffer (minutes)<input type="number" min="0" step="1" required value={officeForm.bufferMinutes} onChange={(event) => setOfficeForm({ ...officeForm, bufferMinutes: event.target.value })} /></label>
										<div className="admin-field admin-field--wide admin-geofence-editor">
											<div className="admin-geofence-editor-heading"><span>Office geofence</span><button className="admin-table-action" type="button" onClick={() => { setGeofenceCaptureEnabled((enabled) => !enabled); setCapturedGeofencePoints([]); setGeofenceCaptureError('') }}>{geofenceCaptureEnabled ? 'Use JSON editor' : 'Update geofence'}</button></div>
											{geofenceCaptureEnabled ? <div className="admin-geofence-capture">
												<div className="admin-geofence-progress" aria-label={`Captured ${capturedGeofencePoints.length} of 4 boundary points`}>
													{Array.from({ length: 4 }, (_, pointIndex) => <span key={pointIndex} className={pointIndex < capturedGeofencePoints.length ? 'is-done' : pointIndex === capturedGeofencePoints.length ? 'is-current' : ''}>P{pointIndex + 1}</span>)}
												</div>
												{capturedGeofencePoints.length < 4 ? <div className="admin-geofence-current-step" aria-live="polite">
													<p className="admin-geofence-step-kicker">BOUNDARY POINT {capturedGeofencePoints.length + 1} OF 4</p>
													<h3>Go to point {capturedGeofencePoints.length + 1}</h3>
													<p>Stand at the exact boundary corner for P{capturedGeofencePoints.length + 1}, then save your current GPS location. Walk clockwise around the boundary.</p>
													<button className="admin-primary-button" type="button" disabled={capturingPointIndex !== null} onClick={() => captureGeofencePoint(capturedGeofencePoints.length)}><i className={`fa-solid ${capturingPointIndex !== null ? 'fa-location-crosshairs fa-spin' : 'fa-location-dot'}`} aria-hidden="true" />{capturingPointIndex !== null ? 'Reading current location…' : `Save P${capturedGeofencePoints.length + 1} coordinates`}</button>
													{capturedGeofencePoints.length > 0 && <p className="admin-geofence-saved-point" role="status"><i className="fa-solid fa-circle-check" aria-hidden="true" />P{capturedGeofencePoints.length} saved: {capturedGeofencePoints.at(-1)[0].toFixed(6)}, {capturedGeofencePoints.at(-1)[1].toFixed(6)}</p>}
													{geofenceCaptureError && <p className="admin-feedback admin-feedback--error" role="alert">{geofenceCaptureError}</p>}
												</div> : <div className="admin-geofence-final" aria-live="polite">
													<p className="admin-feedback admin-feedback--success" role="status"><i className="fa-solid fa-circle-check" aria-hidden="true" />Fence captured. Points connect P1 → P2 → P3 → P4 → P1.</p>
													<GeofencePreviewMap points={capturedGeofencePoints} />
													<button className="admin-table-action" type="button" onClick={() => { setCapturedGeofencePoints([]); setGeofenceCaptureError('') }}>Start point capture again</button>
													<ol className="admin-geofence-coordinates">{capturedGeofencePoints.map((point, pointIndex) => <li key={pointIndex}><strong>P{pointIndex + 1}</strong><span>{point[0].toFixed(6)}, {point[1].toFixed(6)}</span></li>)}</ol>
												</div>}
											</div> : <>
												<textarea required placeholder={'[[12.9716, 77.5946], [12.9720, 77.5950], [12.9712, 77.5954]]'} value={officeForm.geofenceText} onChange={(event) => setOfficeForm({ ...officeForm, geofenceText: event.target.value })} />
												<span className="admin-inline-help">Enter at least 3 actual boundary points in [latitude, longitude] order.</span>
											</>}
										</div>
									</div>
									<div style={{ display: 'flex', gap: 8, marginTop: 14 }}><button className="admin-primary-button" type="submit" disabled={isSaving || !officeHoursConfigured || (geofenceCaptureEnabled && capturedGeofencePoints.length !== 4)}><i className={`fa-solid ${isSaving ? 'fa-circle-notch fa-spin' : 'fa-floppy-disk'}`} aria-hidden="true" />{isSaving ? 'Saving…' : editingOfficeId ? 'Save office changes' : 'Create office'}</button>{editingOfficeId && <button className="admin-table-action" type="button" onClick={() => { setEditingOfficeId(null); setOfficeForm(emptyOffice); setGeofenceCaptureEnabled(false); setCapturedGeofencePoints([]) }}>Cancel edit</button>}</div>
								</form>
							</section>
							<section className="admin-panel"><header className="admin-panel-header"><div><h2>Registered offices</h2><p>{offices.length} service locations configured</p></div></header>{offices.length ? <div className="admin-office-cards">{offices.map((office) => <article className="admin-office-card" key={office.gov_id}><header><div><h3>{office.gov_name}</h3><p>{office.address}</p></div><button className="admin-table-action" type="button" onClick={() => startEditingOffice(office)}>Edit</button></header><div className="admin-office-meta"><span><i className="fa-regular fa-clock" />{String(office.opening_time).slice(0, 5)}–{String(office.closing_time).slice(0, 5)}</span><span><i className="fa-solid fa-users" />{office.employee_count} employees</span><span><i className="fa-solid fa-list-ol" />{office.counter_count} counters</span><span><i className="fa-solid fa-location-dot" />{office.geofence_point?.length || 0} boundary points</span></div></article>)}</div> : <div className="admin-empty"><i className="fa-solid fa-building-columns" /><p>No government offices have been registered.</p></div>}</section>
						</div>}
						{section === 'employees' && <div className="admin-section-stack"><section className="admin-panel" id="admin-employee-form"><header className="admin-panel-header"><div><h2>Create employee access</h2><p>Creates a staff login and assigns one counter in the selected office.</p></div></header><form className="admin-panel-body" onSubmit={createEmployee}><div className="admin-form-grid"><label className="admin-field">Full name<input required maxLength="160" value={employeeForm.name} onChange={(event) => setEmployeeForm({ ...employeeForm, name: event.target.value })} /></label><label className="admin-field">Phone number<input required inputMode="tel" minLength="8" maxLength="16" value={employeeForm.phone} onChange={(event) => setEmployeeForm({ ...employeeForm, phone: event.target.value })} /></label><label className="admin-field">Initial password<input required type="password" minLength="8" maxLength="72" autoComplete="new-password" value={employeeForm.password} onChange={(event) => setEmployeeForm({ ...employeeForm, password: event.target.value })} /></label><label className="admin-field">Government office<select required value={employeeForm.officeId} onChange={(event) => setEmployeeForm({ ...employeeForm, officeId: event.target.value })}><option value="">Select an office</option>{offices.map((office) => <option value={office.gov_id} key={office.gov_id}>{office.gov_name}</option>)}</select></label><label className="admin-field">Counter name<input required maxLength="120" value={employeeForm.counterName} onChange={(event) => setEmployeeForm({ ...employeeForm, counterName: event.target.value })} /></label><label className="admin-field">Counter number<input required type="number" min="1" step="1" value={employeeForm.counterNumber} onChange={(event) => setEmployeeForm({ ...employeeForm, counterNumber: event.target.value })} /></label></div><button className="admin-primary-button" type="submit" disabled={isSaving || !offices.length} style={{ marginTop: 14 }}><i className="fa-solid fa-user-plus" aria-hidden="true" />{isSaving ? 'Creating…' : 'Create employee and counter'}</button></form></section><section className="admin-panel"><header className="admin-panel-header"><div><h2>Employee directory</h2><p>{employees.length} accounts across {offices.length} offices</p></div></header><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Employee</th><th>Office</th><th>Assigned counters</th><th>Phone</th></tr></thead><tbody>{employees.map((employee) => <tr key={employee.employee_id}><td><strong>{employee.user_name}</strong><small>Employee #{employee.employee_id}</small></td><td>{employee.gov_name}</td><td>{employee.counters.map((counter) => `#${counter.counterNumber} ${counter.counterName}`).join(', ') || '—'}</td><td>{employee.phone}</td></tr>)}</tbody></table>{!employees.length && <div className="admin-empty"><i className="fa-solid fa-users" /><p>No employee accounts yet.</p></div>}</div></section></div>}
						{section === 'analytics' && <div className="admin-section-stack"><section className="admin-metric-grid"><article className="admin-metric"><span className="admin-metric-icon"><i className="fa-solid fa-ticket" /></span><div><span>Total visits</span><strong>{analytics?.summary?.total_visits || 0}</strong><small>Selected date range</small></div></article><article className="admin-metric"><span className="admin-metric-icon"><i className="fa-solid fa-circle-check" /></span><div><span>Completed</span><strong>{analytics?.summary?.completed_visits || 0}</strong><small>{completionRate}% completion</small></div></article><article className="admin-metric"><span className="admin-metric-icon"><i className="fa-solid fa-ban" /></span><div><span>Cancelled / no-show</span><strong>{analytics?.summary?.cancelled_visits || 0}</strong><small>Terminal non-completions</small></div></article><article className="admin-metric"><span className="admin-metric-icon"><i className="fa-solid fa-user-group" /></span><div><span>Unique citizens</span><strong>{analytics?.summary?.unique_citizens || 0}</strong><small>Served or queued</small></div></article></section><div className="admin-content-grid"><section className="admin-panel"><header className="admin-panel-header"><div><h2>Visits by day</h2><p>Completed visits are shown in the detail tooltip.</p></div></header><div className="admin-panel-body">{analytics?.daily?.length ? <div className="admin-chart">{analytics.daily.map((item) => <div className="admin-bar-item" title={`${item.date}: ${item.visits} visits, ${item.completed} completed`} key={item.date}><div className="admin-bar-track"><span className="admin-bar" style={{ height: `${Math.max(4, (item.visits / maxDailyVisits) * 100)}%` }} /></div><small>{item.date.slice(5)}</small></div>)}</div> : <div className="admin-empty"><i className="fa-solid fa-chart-column" /><p>No queue activity in this range.</p></div>}</div></section><section className="admin-panel"><header className="admin-panel-header"><div><h2>Office comparison</h2><p>Queue volume and completions</p></div></header><div className="admin-panel-body"><div className="admin-list">{analytics?.offices?.map((office) => <div className="admin-list-row" key={office.office_name}><strong>{office.office_name}</strong><span>{office.completed}/{office.visits} visits</span></div>)}</div></div></section></div></div>}
						{section === 'reports' && <section className="admin-panel"><header className="admin-panel-header"><div><h2>Employee service report</h2><p>Completed service records between {range.from} and {range.to}.</p></div></header><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Employee</th><th>Office</th><th>Completed visits</th><th>Average service</th><th>Last completion</th></tr></thead><tbody>{employeeReport.map((employee) => <tr key={employee.employee_id}><td><strong>{employee.employee_name}</strong><small>{employee.phone}</small></td><td>{employee.office_name}</td><td><span className="admin-status">{employee.completed_visits}</span></td><td>{employee.average_service_minutes ? `${employee.average_service_minutes} min` : '—'}</td><td>{employee.last_completion ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(employee.last_completion)) : '—'}</td></tr>)}</tbody></table>{!employeeReport.length && <div className="admin-empty"><i className="fa-solid fa-file-lines" /><p>No employees match this report range.</p></div>}</div></section>}
					</>}
					<footer className="admin-footer"><span>QMate administration console</span><span><i className="fa-solid fa-shield-halved" aria-hidden="true" /> Restricted administrator workspace</span></footer>
				</main>
			</div>
		</div>
	)
}

export default AdminDashboard