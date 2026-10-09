import { useOutletContext } from 'react-router-dom'

const CitizenProfile = () => {
	const { user } = useOutletContext()

	return (
		<>
			<div className="dashboard-heading-row"><div><p className="dashboard-eyebrow"><span /> ACCOUNT</p><h1>Profile</h1><p className="dashboard-subtitle">Your citizen account details.</p></div></div>
			<section className="dashboard-section account-section">
				<div className="section-heading"><div><p className="dashboard-eyebrow">PERSONAL DETAILS</p><h2>Account information</h2></div></div>
				<div className="account-details">
					<div className="account-avatar">{user?.name?.trim().charAt(0).toUpperCase() || 'C'}</div>
					<div className="account-detail-row"><span>Full name</span><strong>{user?.name || 'Citizen'}</strong></div>
					<div className="account-detail-row"><span>Phone number</span><strong>{user?.phone || 'Not available'}</strong></div>
					<div className="account-detail-row"><span>Account type</span><strong>Citizen</strong></div>
				</div>
			</section>
		</>
	)
}

export default CitizenProfile