import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import '../assets/citizen_css/dashboard.css'

const getStoredUser = () => {
	try {
		return JSON.parse(sessionStorage.getItem('qmate.auth') || 'null')?.user || null
	} catch {
		return null
	}
}

const CitizenDashboard = () => {
	const [servicesOpen, setServicesOpen] = useState(false)
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
	const user = getStoredUser()
	const navigate = useNavigate()
	const location = useLocation()
	const firstName = user?.name?.trim().split(/\s+/)[0] || 'there'
	const isServiceRoute = location.pathname.startsWith('/citizen/service/')

	const signOut = () => {
		sessionStorage.removeItem('qmate.auth')
		navigate('/citizen/auth', { replace: true })
	}

	const closeMobileMenu = () => setMobileMenuOpen(false)

	return (
		<div className="citizen-dashboard">
			<aside className={mobileMenuOpen ? 'citizen-sidebar is-open' : 'citizen-sidebar'}>
				<a className="dashboard-brand" href="/citizen/dashboard" aria-label="QMate dashboard" onClick={closeMobileMenu}>
					<span className="dashboard-brand-mark"><i className="fa-solid fa-ticket" aria-hidden="true" /></span>
					<span>QMate<span className="dashboard-brand-period">.</span></span>
				</a>

				<nav className="citizen-side-nav" aria-label="Citizen panel navigation">
					<p className="sidebar-group-label">WORKSPACE</p>
					<NavLink to="/citizen/dashboard" end className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`} onClick={closeMobileMenu}>
						<i className="fa-solid fa-house" aria-hidden="true" /><span>Dashboard</span>
					</NavLink>
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
				<main className="dashboard-main"><Outlet context={{ user, firstName }} /></main>
				<footer className="dashboard-footer"><span>QMate citizen services</span><span><i className="fa-solid fa-shield-halved" aria-hidden="true" /> Your account is private</span></footer>
			</div>
		</div>
	)
}

export default CitizenDashboard