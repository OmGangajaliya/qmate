import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import '../assets/citizen_css/dashboard.css'
import { queueApiRequest } from './queueApi.js'
import GeofenceMap from './GeofenceMap.jsx'

const getStoredUser = () => {
	try {
		return JSON.parse(sessionStorage.getItem('qmate.auth') || 'null')?.user || null
	} catch {
		return null
	}
}

const getLocalDate = () => {
	const now = new Date()
	const month = String(now.getMonth() + 1).padStart(2, '0')
	const day = String(now.getDate()).padStart(2, '0')
	return `${now.getFullYear()}-${month}-${day}`
}

const getSavedGeofenceDate = () => {
	try {
		return sessionStorage.getItem('qmate.geofence.date')
	} catch {
		return null
	}
}

const CitizenDashboard = () => {
	const [servicesOpen, setServicesOpen] = useState(false)
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
	const [trackingDate, setTrackingDate] = useState(getSavedGeofenceDate)
	const [geofenceState, setGeofenceState] = useState(() => {
		const savedDate = getSavedGeofenceDate()
		if (savedDate === getLocalDate() && !navigator.geolocation) return { mode: 'error', message: 'Location is not available in this browser.' }
		if (savedDate === getLocalDate()) return { mode: 'tracking', message: 'Campus arrival checks are enabled for today’s visits.' }
		if (savedDate && savedDate > getLocalDate()) return { mode: 'scheduled', message: `Campus arrival checks are scheduled for ${savedDate}.` }
		return { mode: 'idle', message: '' }
	})
	const [gpsMapData, setGpsMapData] = useState({ location: null, geofences: [] })
	const [selectedGeofenceId, setSelectedGeofenceId] = useState('')
	const [boundaryLoad, setBoundaryLoad] = useState({ loading: true, error: '' })
	const user = getStoredUser()
	const navigate = useNavigate()
	const location = useLocation()
	const watchIdRef = useRef(null)
	const lastFixAtRef = useRef(0)
	const requestInFlightRef = useRef(false)
	const firstName = user?.name?.trim().split(/\s+/)[0] || 'there'
	const isServiceRoute = location.pathname.startsWith('/citizen/service/')

	useEffect(() => {
		let active = true
		const today = getLocalDate()
		const boundaryParams = new URLSearchParams({ date: today })
		queueApiRequest(`/api/queue/geofence/active?${boundaryParams}`)
			.then((result) => {
				if (!active) return
				const geofences = result.geofences || []
				setGpsMapData((current) => ({ ...current, geofences }))
				setSelectedGeofenceId((current) => geofences.some((item) => String(item.memberId) === current)
					? current
					: String(geofences[0]?.memberId || ''))
				setBoundaryLoad({ loading: false, error: '' })
				if (geofences.length) {
					sessionStorage.setItem('qmate.geofence.date', today)
					setTrackingDate(today)
					setGeofenceState(navigator.geolocation
						? { mode: 'tracking', message: 'Today’s queue visits found. Checking your location against each office boundary.' }
						: { mode: 'error', message: 'Location is not available in this browser. The office boundaries are shown on the map.' })
				} else if (trackingDate === today) {
					sessionStorage.removeItem('qmate.geofence.date')
					setTrackingDate(null)
					setGeofenceState({ mode: 'idle', message: 'No active queue visits found for today.' })
				}
			})
			.catch((error) => {
				if (active) {
					setBoundaryLoad({ loading: false, error: error.message })
					setGeofenceState({ mode: 'error', message: error.message })
				}
			})
		return () => { active = false }
	}, [trackingDate])

	useEffect(() => {
		if (trackingDate !== getLocalDate()) return undefined
		if (!navigator.geolocation) return undefined

		watchIdRef.current = navigator.geolocation.watchPosition(async (position) => {
			const currentLocation = {
				latitude: position.coords.latitude,
				longitude: position.coords.longitude,
				accuracyMeters: position.coords.accuracy,
			}
			setGpsMapData((current) => ({ ...current, location: currentLocation }))
			const now = Date.now()
			if (requestInFlightRef.current || now - lastFixAtRef.current < 8000) return
			lastFixAtRef.current = now
			requestInFlightRef.current = true

			try {
				const result = await queueApiRequest('/api/queue/geofence/location', {
					method: 'POST',
					body: {
						latitude: position.coords.latitude,
						longitude: position.coords.longitude,
						accuracyMeters: position.coords.accuracy,
						date: trackingDate,
					},
				})
				if (!result.tracking) {
					sessionStorage.removeItem('qmate.geofence.date')
					setTrackingDate(null)
					setGpsMapData({ location: null, geofences: [] })
					setSelectedGeofenceId('')
					setGeofenceState({ mode: 'idle', message: result.message })
					return
				}
				const geofences = result.geofences || []
				setGpsMapData((current) => ({ location: result.location || currentLocation, geofences: geofences.length ? geofences : current.geofences }))
				setSelectedGeofenceId((current) => geofences.some((item) => String(item.memberId) === current)
					? current
					: String(geofences[0]?.memberId || ''))
				const insideCount = geofences.filter((item) => item.inside).length
				const message = geofences.length === 1
					? insideCount ? 'You’re inside the campus boundary. Your arrival is confirmed.' : 'You’re outside the campus boundary. Your visit is marked not arrived.'
					: insideCount ? `You’re inside ${insideCount} of ${geofences.length} active campus boundaries.` : 'You’re outside the active campus boundaries.'
				setGeofenceState({ mode: 'tracking', message })
			} catch (error) {
				if (error.message.includes('accuracy is too low')) {
					setGeofenceState({ mode: 'tracking', message: 'GPS accuracy is over 50 m. Waiting for a clearer reading.' })
				} else {
					setGeofenceState({ mode: 'error', message: error.message })
				}
			} finally {
				requestInFlightRef.current = false
			}
		}, (error) => {
			const messages = {
				1: 'Location permission is blocked. Allow location access in Brave site settings.',
				2: 'Your location is temporarily unavailable. Keep this page open and try again.',
				3: 'Getting your location took too long. Keep this page open and try again.',
			}
			setGeofenceState({ mode: 'error', message: messages[error.code] || 'Could not read your location.' })
		}, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 })

		return () => {
			if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current)
			watchIdRef.current = null
		}
	}, [trackingDate])

	const startGeofenceTracking = (date = getLocalDate()) => {
		if (!navigator.geolocation) {
			setGeofenceState({ mode: 'error', message: 'Location is not available in this browser.' })
			return
		}
		try {
			sessionStorage.setItem('qmate.geofence.date', date)
		} catch {
			setGeofenceState({ mode: 'error', message: 'Could not save the tracking session in this browser.' })
			return
		}
		setGeofenceState(date === getLocalDate()
			? { mode: 'tracking', message: 'Requesting location permission for today’s campus visits.' }
			: { mode: 'scheduled', message: `Campus arrival checks are scheduled for ${date}.` })
		setBoundaryLoad({ loading: true, error: '' })
		setTrackingDate(date)
	}

	const signOut = () => {
		sessionStorage.removeItem('qmate.auth')
		sessionStorage.removeItem('qmate.geofence.date')
		navigate('/citizen/auth', { replace: true })
	}

	const closeMobileMenu = () => setMobileMenuOpen(false)

	return (
		<div className="citizen-dashboard">
			<aside className={mobileMenuOpen ? 'citizen-sidebar is-open' : 'citizen-sidebar'}>
				<a className="dashboard-brand" href="/citizen/service/request" aria-label="QMate citizen services" onClick={closeMobileMenu}>
					<span className="dashboard-brand-mark"><i className="fa-solid fa-ticket" aria-hidden="true" /></span>
					<span>QMate<span className="dashboard-brand-period">.</span></span>
				</a>

				<nav className="citizen-side-nav" aria-label="Citizen panel navigation">
					<p className="sidebar-group-label">WORKSPACE</p>
					<button className={`sidebar-link sidebar-service-toggle${isServiceRoute ? ' is-active' : ''}`} type="button" aria-expanded={servicesOpen || isServiceRoute} onClick={() => setServicesOpen(!servicesOpen)}>
						<i className="fa-solid fa-building-columns" aria-hidden="true" /><span>Services</span><i className={`fa-solid fa-chevron-down sidebar-chevron${servicesOpen || isServiceRoute ? ' is-open' : ''}`} aria-hidden="true" />
					</button>
					{(servicesOpen || isServiceRoute) && (
						<div className="sidebar-subnav">
							<NavLink to="/citizen/service/request" className={({ isActive }) => `sidebar-sublink${isActive ? ' is-active' : ''}`} onClick={closeMobileMenu}>Request service</NavLink>
							<NavLink to="/citizen/service/history" className={({ isActive }) => `sidebar-sublink${isActive ? ' is-active' : ''}`} onClick={closeMobileMenu}>Service history</NavLink>
						</div>
					)}
					<NavLink to="/citizen/profile" className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`} onClick={closeMobileMenu}>
						<i className="fa-regular fa-user" aria-hidden="true" /><span>Profile</span>
					</NavLink>
				</nav>

				<div className="sidebar-bottom">
					<div className="sidebar-account"><span className="user-avatar">{firstName.slice(0, 1).toUpperCase()}</span><span><strong>{firstName}</strong><small>Citizen account</small></span></div>
					<button className="sidebar-link sidebar-logout" type="button" onClick={signOut}><i className="fa-solid fa-arrow-right-from-bracket" aria-hidden="true" /><span>Log out</span></button>
				</div>
			</aside>

			{mobileMenuOpen && <button className="sidebar-backdrop" type="button" aria-label="Close navigation menu" onClick={closeMobileMenu} />}

			<div className="dashboard-workspace">
				<header className="dashboard-mobile-header">
					<button className="mobile-menu-button" type="button" aria-label="Open navigation menu" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(true)}><i className="fa-solid fa-bars" aria-hidden="true" /></button>
					<span>{firstName ? `Hello, ${firstName}` : 'Citizen panel'}</span>
					<span className="user-avatar">{firstName.slice(0, 1).toUpperCase()}</span>
				</header>
				{geofenceState.message && <div className={`geofence-banner geofence-banner--${geofenceState.mode}`} role="status"><i className={`fa-solid ${geofenceState.mode === 'error' ? 'fa-triangle-exclamation' : geofenceState.mode === 'tracking' ? 'fa-location-dot' : 'fa-circle-info'}`} aria-hidden="true" /><span>{geofenceState.message}</span>{geofenceState.mode === 'error' && trackingDate && <button type="button" onClick={() => { setTrackingDate(null); window.setTimeout(() => startGeofenceTracking(trackingDate), 0) }}>Retry</button>}</div>}
				{gpsMapData.geofences.length > 0 && trackingDate === getLocalDate() && <GeofenceMap location={gpsMapData.location} geofences={gpsMapData.geofences} selectedMemberId={selectedGeofenceId} onSelectGeofence={setSelectedGeofenceId} boundaryLoading={boundaryLoad.loading} boundaryError={boundaryLoad.error} />}
				<main className="dashboard-main"><Outlet context={{ user, firstName, startGeofenceTracking, trackingActive: Boolean(trackingDate) }} /></main>
				<footer className="dashboard-footer"><span>QMate citizen services</span><span><i className="fa-solid fa-shield-halved" aria-hidden="true" /> Your account is private</span></footer>
			</div>
		</div>
	)
}

export default CitizenDashboard