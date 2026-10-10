import { Navigate, Route, Routes } from 'react-router-dom'
import CitizenAuth from './citizen/auth.jsx'
import CitizenDashboard from './citizen/dashboard.jsx'
import RequestService from './citizen/dashboard/request-service.jsx'
import ServiceHistory from './citizen/dashboard/service-history.jsx'
import CitizenProfile from './citizen/dashboard/profile.jsx'
import EmployeeAuth from './employee/auth.jsx'
import EmployeeDashboard from './employee/dashboard.jsx'
import AdminAuth from './admin/auth.jsx'
import AdminDashboard from './admin/dashboard.jsx'

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

const hasValidEmployeeSession = () => {
	try {
		const session = JSON.parse(sessionStorage.getItem('qmate.employee.auth') || 'null')
		if (!session?.token || session.user?.role !== 'employee') return false

		const tokenPayload = session.token.split('.')[1]
		const claims = JSON.parse(atob(tokenPayload.replace(/-/g, '+').replace(/_/g, '/')))
		return claims.aud === 'qmate-employee' && claims.role === 'employee'
			&& typeof claims.exp === 'number' && claims.exp * 1000 > Date.now()
	} catch {
		return false
	}
}

const hasValidAdminSession = () => {
	try {
		const session = JSON.parse(sessionStorage.getItem('qmate.admin.auth') || 'null')
		if (!session?.token || session.user?.role !== 'admin') return false

		const tokenPayload = session.token.split('.')[1]
		const claims = JSON.parse(atob(tokenPayload.replace(/-/g, '+').replace(/_/g, '/')))
		return claims.aud === 'qmate-admin' && claims.role === 'admin'
			&& typeof claims.exp === 'number' && claims.exp * 1000 > Date.now()
	} catch {
		return false
	}
}

const App = () => (
	<Routes>
		<Route path="/citizen/auth" element={<CitizenAuth />} />
		<Route path="/employee/auth" element={<EmployeeAuth />} />
		<Route path="/employee" element={<Navigate to={hasValidEmployeeSession() ? '/employee/dashboard' : '/employee/auth'} replace />} />
		<Route path="/employee/dashboard" element={hasValidEmployeeSession() ? <EmployeeDashboard /> : <Navigate to="/employee/auth" replace />} />
		<Route path="/admin/auth" element={<AdminAuth />} />
		<Route path="/admin" element={<Navigate to={hasValidAdminSession() ? '/admin/dashboard' : '/admin/auth'} replace />} />
		<Route path="/admin/dashboard" element={hasValidAdminSession() ? <AdminDashboard /> : <Navigate to="/admin/auth" replace />} />
		<Route path="/admin/offices" element={hasValidAdminSession() ? <AdminDashboard /> : <Navigate to="/admin/auth" replace />} />
		<Route path="/admin/employees" element={hasValidAdminSession() ? <AdminDashboard /> : <Navigate to="/admin/auth" replace />} />
		<Route path="/admin/analytics" element={hasValidAdminSession() ? <AdminDashboard /> : <Navigate to="/admin/auth" replace />} />
		<Route path="/admin/reports" element={hasValidAdminSession() ? <AdminDashboard /> : <Navigate to="/admin/auth" replace />} />
		<Route path="/citizen" element={hasValidCitizenSession() ? <CitizenDashboard /> : <Navigate to="/citizen/auth" replace />}>
			<Route index element={<Navigate to="service/request" replace />} />
			<Route path="dashboard" element={<Navigate to="/citizen/service/request" replace />} />
			<Route path="service/request" element={<RequestService />} />
			<Route path="service/history" element={<ServiceHistory />} />
			<Route path="profile" element={<CitizenProfile />} />
		</Route>
		<Route path="/" element={<Navigate to="/citizen/auth" replace />} />
		<Route path="*" element={<Navigate to="/citizen/auth" replace />} />
	</Routes>
)

export default App