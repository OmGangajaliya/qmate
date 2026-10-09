const configuredApiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '')
const apiUrl = configuredApiUrl || (import.meta.env.DEV ? 'http://localhost:5000' : '')

export const adminApiRequest = async (path, { method = 'GET', body } = {}) => {
	if (!apiUrl) throw new Error('Frontend API URL is not configured. Set VITE_API_URL and redeploy.')
	const token = (() => {
		try { return JSON.parse(sessionStorage.getItem('qmate.admin.auth') || 'null')?.token || '' } catch { return '' }
	})()
	const headers = { Authorization: `Bearer ${token}` }
	if (body) headers['Content-Type'] = 'application/json'

	let response
	try {
		response = await fetch(`${apiUrl}${path}`, {
			method,
			headers,
			...(body ? { body: JSON.stringify(body) } : {}),
		})
	} catch {
		throw new Error('Could not reach QMate. Check your connection and try again.')
	}
	const contentType = response.headers.get('content-type') || ''
	if (!contentType.includes('application/json')) throw new Error('The API URL did not return JSON.')
	const result = await response.json()
	if (!response.ok) throw new Error(result.message || 'The request could not be completed.')
	return result
}

export const authenticateAdmin = async (credentials) => {
	const configuredApiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '')
	const apiUrl = configuredApiUrl || (import.meta.env.DEV ? 'http://localhost:5000' : '')
	if (!apiUrl) throw new Error('Frontend API URL is not configured. Set VITE_API_URL and redeploy.')
	let response
	try {
		response = await fetch(`${apiUrl}/api/auth/admin/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(credentials),
		})
	} catch {
		throw new Error('Could not reach the authentication server. Check your connection and try again.')
	}
	const contentType = response.headers.get('content-type') || ''
	if (!contentType.includes('application/json')) throw new Error('The API URL did not return JSON.')
	const result = await response.json()
	if (!response.ok) throw new Error(result.message || 'Unable to sign in.')
	if (!result.token || result.user?.role !== 'admin') throw new Error('The server did not return a valid administrator session.')
	return result
}