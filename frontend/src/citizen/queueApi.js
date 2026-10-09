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

	const result = await response.json().catch(() => ({}))
	if (!response.ok) throw new Error(result.message || 'The request could not be completed.')
	return result
}
