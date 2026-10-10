import { useEffect, useRef, useState } from 'react'
import '../assets/citizen_css/geofence-map.css'

let leafletPromise

const loadLeaflet = () => {
	if (window.L) return Promise.resolve(window.L)
	if (leafletPromise) return leafletPromise

	leafletPromise = new Promise((resolve, reject) => {
		const stylesheetId = 'qmate-leaflet-stylesheet'
		if (!document.getElementById(stylesheetId)) {
			const stylesheet = document.createElement('link')
			stylesheet.id = stylesheetId
			stylesheet.rel = 'stylesheet'
			stylesheet.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
			document.head.append(stylesheet)
		}

		const script = document.createElement('script')
		script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
		script.async = true
		script.onload = () => resolve(window.L)
		script.onerror = () => {
			leafletPromise = null
			reject(new Error('Map tiles could not be loaded. Check your connection and retry.'))
		}
		document.head.append(script)
	})

	return leafletPromise
}

const GeofenceMap = ({ location, geofences, selectedMemberId, onSelectGeofence, boundaryLoading, boundaryError }) => {
	const mapElementRef = useRef(null)
	const mapRef = useRef(null)
	const layersRef = useRef(null)
	const [mapError, setMapError] = useState('')
	const [mapReady, setMapReady] = useState(false)
	const selectedGeofence = geofences.find((item) => String(item.memberId) === String(selectedMemberId)) || geofences[0]

	useEffect(() => {
		let active = true
		loadLeaflet().then((L) => {
			if (!active || !mapElementRef.current) return
			const map = L.map(mapElementRef.current, { scrollWheelZoom: false, zoomControl: true })
			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				attribution: '&copy; OpenStreetMap contributors',
				maxZoom: 19,
			}).addTo(map)
			mapRef.current = map
			layersRef.current = L.layerGroup().addTo(map)
			map.setView([20, 0], 2)
			setMapReady(true)
			window.setTimeout(() => map.invalidateSize(), 0)
		}).catch((error) => {
			if (active) setMapError(error.message)
		})

		return () => {
			active = false
			if (mapRef.current) mapRef.current.remove()
			mapRef.current = null
			layersRef.current = null
			setMapReady(false)
		}
	}, [])

	useEffect(() => {
		const map = mapRef.current
		const layers = layersRef.current
		const L = window.L
		if (!map || !layers || !L) return

		layers.clearLayers()
		const bounds = []
		if (selectedGeofence?.boundary?.length) {
			const color = selectedGeofence.inside === false ? '#c85e45' : '#31816a'
			const polygon = L.polygon(selectedGeofence.boundary, {
				color,
				weight: 3,
				fillColor: selectedGeofence.inside === false ? '#e08263' : '#61a58a',
				fillOpacity: 0.2,
			}).bindPopup(`${selectedGeofence.officeName} campus boundary`)
			polygon.addTo(layers)
			bounds.push(...selectedGeofence.boundary)
		}

		if (location) {
			const point = [location.latitude, location.longitude]
			L.circleMarker(point, {
				radius: 8,
				color: '#ffffff',
				weight: 3,
				fillColor: selectedGeofence?.inside === false ? '#c85e45' : '#31816a',
				fillOpacity: 1,
			}).bindPopup('Your current location').addTo(layers)
			if (!selectedGeofence?.boundary?.length) bounds.push(point)
		}

		if (selectedGeofence?.boundary?.length) map.fitBounds(L.latLngBounds(bounds), { padding: [36, 36], maxZoom: 18 })
		else if (location) map.setView([location.latitude, location.longitude], 16)
		else map.setView([20, 0], 2)
	}, [location, selectedGeofence, mapReady])

	return (
		<section className="geofence-map-panel" aria-label="Campus location map">
			<header className="geofence-map-header">
				<div>
					<p className="dashboard-eyebrow"><span /> LIVE LOCATION</p>
					<h2>{selectedGeofence?.officeName || 'Campus boundary'}</h2>
				</div>
				{geofences.length > 1 && <label className="geofence-map-select-label">Visit
					<select value={selectedGeofence?.memberId || ''} onChange={(event) => onSelectGeofence(event.target.value)}>
						{geofences.map((geofence) => <option key={geofence.memberId} value={geofence.memberId}>{geofence.officeName}</option>)}
					</select>
				</label>}
			</header>
			<div className="geofence-map-legend" aria-live="polite">
				<span className={selectedGeofence?.inside === true ? 'geofence-map-status is-inside' : selectedGeofence?.inside === false ? 'geofence-map-status is-outside' : 'geofence-map-status'}>
					<i className="fa-solid fa-location-dot" aria-hidden="true" />
					{selectedGeofence?.inside === true ? 'Inside the boundary' : selectedGeofence?.inside === false ? 'Outside the boundary' : 'Boundary status pending'}
				</span>
				<span><i className="geofence-legend-boundary" /> Office boundary</span>
			</div>
			<div className="geofence-map-canvas" ref={mapElementRef} role="application" aria-label="Map showing your location and the office geofence" />
			{boundaryLoading && <p className="geofence-map-message" role="status">Loading the office boundary…</p>}
			{boundaryError && <p className="geofence-map-error" role="alert">{boundaryError}</p>}
			{mapError && <p className="geofence-map-error" role="alert">{mapError}</p>}
		</section>
	)
}

export default GeofenceMap