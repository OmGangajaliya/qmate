import { useEffect, useRef, useState } from 'react'

let leafletLoader

const loadLeaflet = () => {
	if (window.L) return Promise.resolve(window.L)
	if (leafletLoader) return leafletLoader

	leafletLoader = new Promise((resolve, reject) => {
		if (!document.getElementById('qmate-leaflet-css')) {
			const stylesheet = document.createElement('link')
			stylesheet.id = 'qmate-leaflet-css'
			stylesheet.rel = 'stylesheet'
			stylesheet.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
			document.head.append(stylesheet)
		}
		const script = document.createElement('script')
		script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
		script.async = true
		script.onload = () => resolve(window.L)
		script.onerror = () => {
			leafletLoader = null
			reject(new Error('The map preview could not load. Check your internet connection.'))
		}
		document.head.append(script)
	})
	return leafletLoader
}

const GeofencePreviewMap = ({ points }) => {
	const containerRef = useRef(null)
	const mapRef = useRef(null)
	const [mapReady, setMapReady] = useState(false)
	const [error, setError] = useState('')

	useEffect(() => {
		let active = true
		loadLeaflet().then((L) => {
			if (!active || !containerRef.current) return
			const map = L.map(containerRef.current, { scrollWheelZoom: false })
			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				attribution: '&copy; OpenStreetMap contributors',
				maxZoom: 19,
			}).addTo(map)
			mapRef.current = map
			setMapReady(true)
			window.setTimeout(() => map.invalidateSize(), 0)
		}).catch((loadError) => {
			if (active) setError(loadError.message)
		})

		return () => {
			active = false
			mapRef.current?.remove()
			mapRef.current = null
		}
	}, [])

	useEffect(() => {
		const map = mapRef.current
		const L = window.L
		if (!mapReady || !map || !L || points.length !== 4) return

		const latLngs = points.map(([latitude, longitude]) => [latitude, longitude])
		L.polygon(latLngs, {
			color: '#347a4c',
			weight: 3,
			fillColor: '#69a778',
			fillOpacity: 0.2,
		}).addTo(map)

		points.forEach(([latitude, longitude], index) => {
			const pointIcon = L.divIcon({
				className: 'geofence-point-icon',
				html: `<span>P${index + 1}</span>`,
				iconSize: [34, 34],
				iconAnchor: [17, 17],
			})
			L.marker([latitude, longitude], { icon: pointIcon })
				.bindPopup(`P${index + 1}: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`)
				.addTo(map)
		})
		map.fitBounds(L.latLngBounds(latLngs), { padding: [32, 32], maxZoom: 18 })
	}, [mapReady, points])

	return <div className="admin-geofence-preview-wrap">
		<div className="admin-geofence-preview-map" ref={containerRef} role="application" aria-label="Map preview of the four captured geofence points" />
		{error && <p className="admin-feedback admin-feedback--error" role="alert">{error}</p>}
	</div>
}

export default GeofencePreviewMap
