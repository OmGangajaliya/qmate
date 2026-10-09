const configuredApiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '')
const apiUrl = configuredApiUrl || (import.meta.env.DEV ? 'http://localhost:5000' : '')

export const authenticateEmployee = async (credentials) => {
	if (!apiUrl) throw new Error('Frontend API URL is not configured. Set VITE_API_URL in Vercel and redeploy.')

	let response
	try {
		response = await fetch(`${apiUrl}/api/auth/employee/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(credentials),
		})
	} catch {
		throw new Error('Could not reach the authentication server. Check your connection and try again.')
	}

	const contentType = response.headers.get('content-type') || ''
	if (!contentType.includes('application/json')) {
		throw new Error('The API URL did not return JSON. Verify VITE_API_URL and redeploy.')
	}
	const result = await response.json()
	if (!response.ok) throw new Error(result.message || 'Unable to sign in.')
	if (!result.token || result.user?.role !== 'employee') {
		throw new Error('The authentication server returned an invalid employee session.')
	}
	return result
}