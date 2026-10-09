const configuredApiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '')
const apiUrl = configuredApiUrl || (import.meta.env.DEV ? 'http://localhost:5000' : '')

export const authenticateCitizen = async (mode, credentials) => {
	if (!apiUrl) {
		throw new Error('Frontend API URL is not configured. Set VITE_API_URL in Vercel and redeploy.')
	}

	const endpoint = mode === 'signup' ? 'register' : 'login'
	let response
	try {
		response = await fetch(`${apiUrl}/api/auth/${endpoint}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(credentials),
		})
	} catch {
		throw new Error('Could not reach the authentication server. Check your connection and try again.')
	}

	const contentType = response.headers.get('content-type') || ''
	if (!contentType.includes('application/json')) {
		throw new Error('The API URL did not return JSON. Verify VITE_API_URL in Vercel and redeploy.')
	}
	const result = await response.json()

	if (!response.ok) {
		throw new Error(result.message || 'Authentication failed. Please try again.')
	}
	if (!result.token || !result.user || result.user.role !== 'citizen') {
		throw new Error('The authentication server returned an invalid session. Check the deployed backend.')
	}

	return result
}