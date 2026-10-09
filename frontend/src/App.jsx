import { Navigate, Route, Routes } from 'react-router-dom'
import CitizenAuth from './citizen/auth.jsx'
import CitizenDashboard from './citizen/dashboard.jsx'
import DashboardHome from './citizen/dashboard/dashboard-home.jsx'
import RequestService from './citizen/dashboard/request-service.jsx'
import ServiceHistory from './citizen/dashboard/service-history.jsx'
import CitizenProfile from './citizen/dashboard/profile.jsx'

const hasValidCitizenSession = () => {
	try {
		const session = JSON.parse(sessionStorage.getItem('qmate.auth') || 'null')
		if (!session?.token || session.user?.role !== 'citizen') return false

		const tokenPayload = session.token.split('.')[1]
		const claims = JSON.parse(atob(tokenPayload.replace(/-/g, '+').replace(/_/g, '/')))
		return typeof claims.exp === 'number' && claims.exp * 1000 > Date.now()
	} catch {
		return false
	}
}

const App = () => (
	<Routes>
		<Route path="/citizen/auth" element={<CitizenAuth />} />
		<Route path="/citizen" element={hasValidCitizenSession() ? <CitizenDashboard /> : <Navigate to="/citizen/auth" replace />}>
			<Route index element={<Navigate to="dashboard" replace />} />
			<Route path="dashboard" element={<DashboardHome />} />
			<Route path="service/request" element={<RequestService />} />
			<Route path="service/history" element={<ServiceHistory />} />
			<Route path="profile" element={<CitizenProfile />} />
		</Route>
		<Route path="/" element={<Navigate to="/citizen/auth" replace />} />
		<Route path="*" element={<Navigate to="/citizen/auth" replace />} />
	</Routes>
)

export default App