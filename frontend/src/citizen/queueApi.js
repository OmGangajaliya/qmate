const configuredApiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '')
const apiUrl = configuredApiUrl || (import.meta.env.DEV ? 'http://localhost:5000' : '')

const getToken = () => {
	try {
		return JSON.parse(sessionStorage.getItem('qmate.auth') || 'null')?.token || ''
	} catch {
		return ''
	}
}

export const queueApiRequest = async (path, { method = 'GET', body } = {}) => {
	if (!apiUrl) {
		throw new Error('Frontend API URL is not configured. Set VITE_API_URL in Vercel and redeploy.')
	}

	const headers = { Authorization: `Bearer ${getToken()}` }
	if (body) headers['Content-Type'] = 'application/json'

	let response
	try {		response = await fetch(`${apiUrl}${path}`, {
			method,
			headers,
			...(body ? { body: JSON.stringify(body) } : {}),
		})
	} catch {
		throw new Error('Could not reach QMate. Check your connection and try again.')
	}

	const contentType = response.headers.get('content-type') || ''
	if (!contentType.includes('application/json')) {
		throw new Error('The API URL did not return JSON. Verify VITE_API_URL in Vercel and redeploy.')
	}
	const result = await response.json()
	if (!response.ok) throw new Error(result.message || 'The request could not be completed.')
	return result
}
