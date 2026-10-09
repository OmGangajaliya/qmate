import { Link, useOutletContext } from 'react-router-dom'

const DashboardHome = () => {
	const { firstName } = useOutletContext()
	const today = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())

	return (
		<>
			<div className="dashboard-heading-row">
				<div><p className="dashboard-eyebrow"><span /> CITIZEN PANEL</p><h1>Hello, {firstName}.</h1><p className="dashboard-subtitle">Your public service visits, all in one place.</p></div>
				<div className="dashboard-date"><i className="fa-regular fa-calendar" aria-hidden="true" /><span>{today}</span></div>
			</div>
			<section className="dashboard-stat-grid" aria-label="Visit summary">
				<article className="dashboard-stat"><span className="stat-icon stat-icon--orange"><i className="fa-solid fa-ticket" aria-hidden="true" /></span><div><span className="stat-label">Active visits</span><strong>0</strong></div><span className="stat-footnote">Nothing in line right now</span></article>
				<article className="dashboard-stat"><span className="stat-icon stat-icon--sage"><i className="fa-solid fa-circle-check" aria-hidden="true" /></span><div><span className="stat-label">Completed</span><strong>0</strong></div><span className="stat-footnote">Your visit history will show here</span></article>
				<article className="dashboard-stat dashboard-stat--note"><span className="stat-icon stat-icon--sand"><i className="fa-solid fa-shield-halved" aria-hidden="true" /></span><div><span className="stat-label">Account status</span><strong className="status-value"><span /> Active</strong></div><span className="stat-footnote">Your citizen account is ready</span></article>
			</section>
			<div className="dashboard-content-grid">
				<section className="dashboard-section visits-section">
					<div className="section-heading"><div><p className="dashboard-eyebrow">YOUR ACTIVITY</p><h2>Upcoming visits</h2></div><Link className="section-link" to="/citizen/service/history">View all <i className="fa-solid fa-arrow-right" aria-hidden="true" /></Link></div>
					<div className="empty-visits"><div className="empty-illustration"><span><i className="fa-regular fa-calendar-check" aria-hidden="true" /></span><i className="empty-spark empty-spark--one fa-solid fa-star" /><i className="empty-spark empty-spark--two fa-solid fa-circle" /></div><h3>No visits booked yet</h3><p>When you join a service queue, your visit details and live status will appear here.</p><Link className="outline-action" to="/citizen/service/request"><i className="fa-solid fa-magnifying-glass" aria-hidden="true" /> Explore services</Link></div>
				</section>
				<aside className="next-step-panel"><div className="next-step-art" aria-hidden="true"><span className="next-step-orbit" /><span className="next-step-center"><i className="fa-solid fa-location-dot" /></span></div><p className="dashboard-eyebrow">A SMOOTHER VISIT</p><h2>Plan before<br />you head out.</h2><p>Check available services and keep your next visit organized.</p><Link className="primary-action" to="/citizen/service/request">Request a service <i className="fa-solid fa-arrow-right" aria-hidden="true" /></Link></aside>
			</div>
		</>
	)
}

export default DashboardHome