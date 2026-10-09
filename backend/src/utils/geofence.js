const booleanPointInPolygonModule = require('@turf/boolean-point-in-polygon')
const booleanPointInPolygon = booleanPointInPolygonModule.default || booleanPointInPolygonModule

const normalizeCampusPolygon = (value) => {
	let points = value
	if (typeof points === 'string') {
		try {
			points = JSON.parse(points)
		} catch {
			return null
		}
	}
	if (!Array.isArray(points) || points.length < 3) return null

	const coordinates = points.map((point) => {
		if (!Array.isArray(point) || point.length < 2) return null
		const latitude = Number(point[0])
		const longitude = Number(point[1])
		if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
			|| latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null
		return [longitude, latitude]
	})
	if (coordinates.some((point) => point === null)) return null

	const first = coordinates[0]
	const last = coordinates[coordinates.length - 1]
	if (first[0] !== last[0] || first[1] !== last[1]) coordinates.push([...first])
	return coordinates.length >= 4 ? coordinates : null
}

const isInsideCampus = (latitude, longitude, geofencePoint) => {
	const ring = normalizeCampusPolygon(geofencePoint)
	if (!ring) return null

	try {
		return booleanPointInPolygon(
			{ type: 'Point', coordinates: [longitude, latitude] },
			{ type: 'Polygon', coordinates: [ring] },
			{ ignoreBoundary: false },
		)
	} catch {
		return null
	}
}

module.exports = { isInsideCampus, normalizeCampusPolygon }