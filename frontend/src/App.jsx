import { Navigate, Route, Routes } from 'react-router-dom'
import CitizenAuth from './citizen/auth.jsx'

const App = () => (
	<Routes>
		<Route path="/citizen/auth" element={<CitizenAuth />} />
		<Route path="/" element={<Navigate to="/citizen/auth" replace />} />
		<Route path="*" element={<Navigate to="/citizen/auth" replace />} />
	</Routes>
)

export default App