import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../assets/citizen_css/dashboard.css'

const navigationItems = [
	{ id: 'overview', label: 'Overview', icon: 'fa-house' },
	{ id: 'visits', label: 'My visits', icon: 'fa-ticket' },
	{ id: 'services', label: 'Services', icon: 'fa-building-columns' },
	{ id: 'account', label: 'My account', icon: 'fa-user' },
]

const getStoredUser = () => {
	try {
		return JSON.parse(sessionStorage.getItem('qmate.auth') || 'null')?.user || null
	} catch {
		return null
	}
}

const CitizenDashboard = () => {
	const [activeView, setActiveView] = useState('overview')
	const user = getStoredUser()
	const navigate = useNavigate()
	const firstName = user?.name?.trim().split(/\s+/)[0] || 'there'
	const today = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())

	const signOut = () => {
		sessionStorage.removeItem('qmate.auth')
		navigate('/citizen/auth', { replace: true })
	}

	const selectView = (view) => {
		setActiveView(view)
		window.scrollTo({ top: 0, behavior: 'smooth' })
	}

	const currentNavigation = navigationItems.find((item) => item.id === activeView)

	return (
		<div className="citizen-dashboard">
			<header className="dashboard-header">
				<a className="dashboard-brand" href="/citizen/dashboard" aria-label="QMate dashboard">
					<span className="dashboard-brand-mark"><i className="fa-solid fa-ticket" aria-hidden="true" /></span>
					<span>QMate<span className="dashboard-brand-period">.</span></span>
				</a>

				<nav className="dashboard-nav dashboard-nav--desktop" aria-label="Main navigation">
					{navigationItems.map((item) => (
						<button className={activeView === item.id ? 'dashboard-nav-link is-active' : 'dashboard-nav-link'} type="button" key={item.id} onClick={() => selectView(item.id)}>
							<i className={`fa-solid ${item.icon}`} aria-hidden="true" />
							<span>{item.label}</span>
						</button>
					))}
				</nav>

				<div className="dashboard-header-actions">
					<span className="dashboard-user-chip"><span className="user-avatar">{firstName.slice(0, 1).toUpperCase()}</span><span>{firstName}</span></span>
					<button className="dashboard-signout" type="button" onClick={signOut} aria-label="Sign out" title="Sign out"><i className="fa-solid fa-arrow-right-from-bracket" aria-hidden="true" /></button>
				</div>
			</header>

			<main className="dashboard-main">
				<div className="dashboard-heading-row">
					<div>
						<p className="dashboard-eyebrow"><span /> CITIZEN PANEL</p>
						<h1>{activeView === 'overview' ? `Hello, ${firstName}.` : currentNavigation.label}</h1>
						<p className="dashboard-subtitle">{activeView === 'overview' ? 'Your public service visits, all in one place.' : viewDescription(activeView)}</p>
					</div>
					<div className="dashboard-date"><i className="fa-regular fa-calendar" aria-hidden="true" /><span>{today}</span></div>
				</div>

				{activeView === 'overview' && (
					<>
						<section className="dashboard-stat-grid" aria-label="Visit summary">
							<article className="dashboard-stat">
								<span className="stat-icon stat-icon--orange"><i className="fa-solid fa-ticket" aria-hidden="true" /></span>
								<div><span className="stat-label">Active visits</span><strong>0</strong></div>
								<span className="stat-footnote">Nothing in line right now</span>
							</article>
							<article className="dashboard-stat">
								<span className="stat-icon stat-icon--sage"><i className="fa-solid fa-circle-check" aria-hidden="true" /></span>
								<div><span className="stat-label">Completed</span><strong>0</strong></div>
								<span className="stat-footnote">Your visit history will show here</span>
							</article>
							<article className="dashboard-stat dashboard-stat--note">
								<span className="stat-icon stat-icon--sand"><i className="fa-solid fa-shield-halved" aria-hidden="true" /></span>
								<div><span className="stat-label">Account status</span><strong className="status-value"><span /> Active</strong></div>
								<span className="stat-footnote">Your citizen account is ready</span>
							</article>
						</section>

						<div className="dashboard-content-grid">
							<section className="dashboard-section visits-section">
								<div className="section-heading">
									<div><p className="dashboard-eyebrow">YOUR ACTIVITY</p><h2>Upcoming visits</h2></div>
									<button className="section-link" type="button" onClick={() => selectView('visits')}>View all <i className="fa-solid fa-arrow-right" aria-hidden="true" /></button>
								</div>
								<div className="empty-visits">
									<div className="empty-illustration"><span><i className="fa-regular fa-calendar-check" aria-hidden="true" /></span><i className="empty-spark empty-spark--one fa-solid fa-star" /><i className="empty-spark empty-spark--two fa-solid fa-circle" /></div>
									<h3>No visits booked yet</h3>
									<p>When you join a service queue, your visit details and live status will appear here.</p>
									<button className="outline-action" type="button" onClick={() => selectView('services')}><i className="fa-solid fa-magnifying-glass" aria-hidden="true" /> Explore services</button>
								</div>
							</section>

							<aside className="next-step-panel">
								<div className="next-step-art" aria-hidden="true"><span className="next-step-orbit" /><span className="next-step-center"><i className="fa-solid fa-location-dot" /></span></div>
								<p className="dashboard-eyebrow">A SMOOTHER VISIT</p>
								<h2>Plan before<br />you head out.</h2>
								<p>Check available services and keep your next visit organized.</p>
								<button className="primary-action" type="button" onClick={() => selectView('services')}>Browse services <i className="fa-solid fa-arrow-right" aria-hidden="true" /></button>
							</aside>
						</div>
					</>
				)}

				{activeView === 'visits' && <VisitsView onBrowse={() => selectView('services')} />}
				{activeView === 'services' && <ServicesView />}
				{activeView === 'account' && <AccountView user={user} onSignOut={signOut} />}
			</main>

			<footer className="dashboard-footer"><span>QMate citizen services</span><span><i className="fa-solid fa-shield-halved" aria-hidden="true" /> Your account is private</span></footer>

			<nav className="dashboard-nav dashboard-nav--mobile" aria-label="Main navigation">
				{navigationItems.map((item) => (
					<button className={activeView === item.id ? 'mobile-nav-link is-active' : 'mobile-nav-link'} type="button" key={item.id} onClick={() => selectView(item.id)} aria-current={activeView === item.id ? 'page' : undefined}>
						<i className={`fa-solid ${item.icon}`} aria-hidden="true" />
						<span>{item.label === 'Overview' ? 'Home' : item.label === 'My visits' ? 'Visits' : item.label === 'My account' ? 'Account' : item.label}</span>
					</button>
				))}
			</nav>
		</div>
	)
}

const viewDescription = (view) => ({
	visits: 'Keep track of your queues and service visits.',
	services: 'Find the public services available through QMate.',
	account: 'Your citizen profile and sign-in details.',
}[view] || '')

const VisitsView = ({ onBrowse }) => (
	<section className="dashboard-section full-width-section">
		<div className="section-heading"><div><p className="dashboard-eyebrow">VISIT HISTORY</p><h2>Your visits</h2></div></div>
		<div className="empty-visits empty-visits--large">
			<div className="empty-illustration"><span><i className="fa-solid fa-ticket" aria-hidden="true" /></span><i className="empty-spark empty-spark--one fa-solid fa-star" /><i className="empty-spark empty-spark--two fa-solid fa-circle" /></div>
			<h3>Your queue visits will appear here</h3>
			<p>There are no visits linked to your account yet. Once you join a service queue, you can follow your position and status here.</p>
			<button className="outline-action" type="button" onClick={onBrowse}><i className="fa-solid fa-magnifying-glass" aria-hidden="true" /> Explore services</button>
		</div>
	</section>
)

const ServicesView = () => (
	<section className="dashboard-section full-width-section services-section">
		<div className="section-heading"><div><p className="dashboard-eyebrow">LOCAL SERVICES</p><h2>Find what you need</h2></div></div>
		<div className="services-empty">
			<span className="services-empty-icon"><i className="fa-solid fa-building-columns" aria-hidden="true" /></span>
			<div><h3>Service directory is getting ready</h3><p>Services from participating government offices will appear here when the local directory is connected.</p></div>
		</div>
		<div className="service-category-list" aria-label="Service categories">
			<div className="service-category"><span><i className="fa-regular fa-id-card" aria-hidden="true" /></span><div><strong>Identity &amp; documents</strong><small>Identity cards, records and documentation</small></div><i className="fa-solid fa-chevron-right" aria-hidden="true" /></div>
			<div className="service-category"><span><i className="fa-solid fa-file-lines" aria-hidden="true" /></span><div><strong>Certificates &amp; records</strong><small>Official certificates and public records</small></div><i className="fa-solid fa-chevron-right" aria-hidden="true" /></div>
			<div className="service-category"><span><i className="fa-solid fa-ellipsis" aria-hidden="true" /></span><div><strong>Other public services</strong><small>More services from your local office</small></div><i className="fa-solid fa-chevron-right" aria-hidden="true" /></div>
		</div>
	</section>
)

const AccountView = ({ user, onSignOut }) => (
	<section className="dashboard-section account-section">
		<div className="section-heading"><div><p className="dashboard-eyebrow">PROFILE</p><h2>Account details</h2></div></div>
		<div className="account-details">
			<div className="account-avatar">{user?.name?.trim().charAt(0).toUpperCase() || 'C'}</div>
			<div className="account-detail-row"><span>Full name</span><strong>{user?.name || 'Citizen'}</strong></div>
			<div className="account-detail-row"><span>Phone number</span><strong>{user?.phone || 'Not available'}</strong></div>
			<div className="account-detail-row"><span>Account type</span><strong>Citizen</strong></div>
			<button className="account-signout" type="button" onClick={onSignOut}><i className="fa-solid fa-arrow-right-from-bracket" aria-hidden="true" /> Sign out</button>
		</div>
	</section>
)

export default CitizenDashboard