const ServiceHistory = () => (
	<>
		<div className="dashboard-heading-row">
			<div><p className="dashboard-eyebrow"><span /> SERVICES</p><h1>Service history</h1><p className="dashboard-subtitle">Your past and current service requests.</p></div>
	</div>
	<section className="dashboard-section full-width-section">
		<div className="empty-visits empty-visits--large">
			<div className="empty-illustration"><span><i className="fa-solid fa-ticket" aria-hidden="true" /></span><i className="empty-spark empty-spark--one fa-solid fa-star" /><i className="empty-spark empty-spark--two fa-solid fa-circle" /></div>
			<h3>Your service history will appear here</h3>
			<p>There are no service requests linked to your account yet.</p>
		</div>
	</section>
	</>
)

export default ServiceHistory