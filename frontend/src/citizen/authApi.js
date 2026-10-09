const configuredApiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '')
const apiUrl = configuredApiUrl || (import.meta.env.DEV ? 'http://localhost:5000' : '')

export const authenticateCitizen = async (mode, credentials) => {
	const endpoint = mode === 'signup' ? 'register' : 'login'
	const response = await fetch(`${apiUrl}/api/auth/${endpoint}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(credentials),
	})
	const result = await response.json().catch(() => ({}))

	if (!response.ok) {
		throw new Error(result.message || 'Authentication failed. Please try again.')
	}

	return result
}