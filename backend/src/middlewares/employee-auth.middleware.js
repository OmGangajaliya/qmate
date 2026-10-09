const jwt = require('jsonwebtoken')

const requireEmployee = (request, response, next) => {
	const token = request.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
	if (!token || !process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
		return response.status(401).json({ message: 'Sign in as an employee to continue.' })
	}

	try {
		const claims = jwt.verify(token, process.env.JWT_SECRET, {
			issuer: 'qmate-api',
			audience: 'qmate-employee',
		})
		if (claims.role !== 'employee' || !/^\d+$/.test(claims.sub || '')) {
			return response.status(403).json({ message: 'Employee access is required.' })
		}
		request.employee = { userId: claims.sub }
		return next()
	} catch {
		return response.status(401).json({ message: 'Your session has expired. Sign in again.' })
	}
}

module.exports = requireEmployee