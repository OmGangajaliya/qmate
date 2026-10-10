import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { queueApiRequest } from '../queueApi.js'
import GeofenceMap from '../GeofenceMap.jsx'

const PAGE_SIZE = 10
const filters = [
	{ id: 'all', label: 'All visits' },
	{ id: 'active', label: 'Active' },
	{ id: 'completed', label: 'Completed' },
	{ id: 'cancelled', label: 'Cancelled' },
]

const statusLabels = {
	'not arrived': 'Booked',
	arrived: 'Arrived',
	serving: 'In service',
	completed: 'Completed',
	late: 'Late',
	no_show: 'Missed',
	cancelled: 'Cancelled',
}

const ServiceHistory = () => {
	const { geofenceMapData, selectedGeofenceId, setSelectedGeofenceId, refreshGeofenceVisits } = useOutletContext()
	const [filter, setFilter] = useState('all')
	const [page, setPage] = useState(0)
	const [historyResult, setHistoryResult] = useState({ key: '', items: [], total: 0, error: '' })
	const [reloadKey, setReloadKey] = useState(0)
	const requestKey = `${filter}:${page}:${reloadKey}`
	const loading = historyResult.key !== requestKey
	const items = loading ? [] : historyResult.items
	const total = loading ? 0 : historyResult.total
	const error = loading ? '' : historyResult.error

	useEffect(() => {
		let isCurrent = true
		const query = new URLSearchParams({ status: filter, limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) })
		queueApiRequest(`/api/queue/history?${query}`)
			.then((result) => {
				if (!isCurrent) return
				setHistoryResult({ key: requestKey, items: result.items, total: result.total, error: '' })
			})
			.catch((requestError) => {
				if (isCurrent) setHistoryResult({ key: requestKey, items: [], total: 0, error: requestError.message })
			})
		return () => { isCurrent = false }
	}, [filter, page, reloadKey, requestKey])

	const changeFilter = (nextFilter) => {
		setFilter(nextFilter)
		setPage(0)
	}

	const totalPages = Math.ceil(total / PAGE_SIZE)

	return (
		<>
			<div className="dashboard-heading-row history-heading">
				<div><p className="dashboard-eyebrow"><span /> SERVICES</p><h1>Service history</h1></div>
				<Link className="history-new-booking" to="/citizen/service/request"><i className="fa-solid fa-plus" aria-hidden="true" /> Request a service</Link>
			</div>
			{(geofenceMapData?.geofences?.length > 0 || geofenceMapData?.location) && <GeofenceMap
				location={geofenceMapData.location}
				geofences={geofenceMapData.geofences}
				selectedMemberId={selectedGeofenceId}
				onSelectGeofence={setSelectedGeofenceId}
			/>}

			<section className="history-section dashboard-section" aria-label="Service history">
				<div className="history-toolbar">
					<div className="history-filters" role="tablist" aria-label="Filter visits">
						{filters.map((option) => (
							<button className={filter === option.id ? 'history-filter is-active' : 'history-filter'} type="button" role="tab" aria-selected={filter === option.id} key={option.id} onClick={() => changeFilter(option.id)}>{option.label}</button>
						))}
					</div>
					<span className="history-count">{loading ? 'Loading visits…' : `${total} ${total === 1 ? 'visit' : 'visits'}`}</span>
				</div>

				{error ? (
					<div className="history-message history-error" role="alert">
						<span className="history-message-icon"><i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /></span>
						<h2>Couldn’t load your visits</h2>
						<p>{error}</p>
						<button className="outline-action" type="button" onClick={() => setReloadKey((key) => key + 1)}><i className="fa-solid fa-rotate-right" aria-hidden="true" /> Try again</button>
					</div>
				) : loading ? (
					<div className="history-loading" role="status"><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /><span>Loading your service history…</span></div>
				) : items.length === 0 ? (
					<div className="history-message history-empty">
						<div className="empty-illustration"><span><i className="fa-solid fa-ticket" aria-hidden="true" /></span><i className="empty-spark empty-spark--one fa-solid fa-star" /><i className="empty-spark empty-spark--two fa-solid fa-circle" /></div>
						<h2>{filter === 'all' ? 'No service visits yet' : `No ${filter} visits`}</h2>
						<p>{filter === 'all' ? 'When you join a queue, your booking and visit details will appear here.' : 'Try a different filter or request a service to get started.'}</p>
						{filter === 'all' && <Link className="outline-action" to="/citizen/service/request"><i className="fa-solid fa-magnifying-glass" aria-hidden="true" /> Browse services</Link>}
					</div>
				) : (
					<div className="history-list">
{items.map((item) => <HistoryItem item={item} key={item.member_id} onExited={() => { setReloadKey((key) => key + 1); refreshGeofenceVisits() }} />)}
					</div>
				)}

				{!loading && !error && totalPages > 1 && (
					<div className="history-pagination">
						<span>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}</span>
						<div><button type="button" className="page-button" onClick={() => setPage(page - 1)} disabled={page === 0} aria-label="Previous page"><i className="fa-solid fa-chevron-left" /></button><span>Page {page + 1} of {totalPages}</span><button type="button" className="page-button" onClick={() => setPage(page + 1)} disabled={page + 1 >= totalPages} aria-label="Next page"><i className="fa-solid fa-chevron-right" /></button></div>
					</div>
				)}
			</section>
		</>
	)
}

const HistoryItem = ({ item, onExited }) => {
	const [exiting, setExiting] = useState(false)
	const [exitError, setExitError] = useState('')
	const statusLabel = statusLabels[item.status] || item.status
	const date = new Date(`${item.service_date}T00:00:00`)
	const formattedDate = Number.isNaN(date.getTime()) ? item.service_date : new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(date)
	const formattedTimeGiven = item.time_given || 'Not scheduled'
	const completionStart = item.completed_start_at ? new Date(item.completed_start_at) : null
	const completionEnd = item.completed_end_at ? new Date(item.completed_end_at) : null
	const completionDuration = completionStart && completionEnd && !Number.isNaN(completionStart.getTime()) && !Number.isNaN(completionEnd.getTime())
		? Math.max(0, Math.round((completionEnd - completionStart) / 60000))
		: null
	const canExitQueue = ['not arrived', 'arrived', 'late'].includes(item.status)

	const handleExitQueue = async () => {
		if (!canExitQueue || exiting) return
		setExiting(true)
		setExitError('')
		try {
			await queueApiRequest(`/api/queue/entries/${item.member_id}`, { method: 'DELETE' })
			onExited?.()
		} catch (error) {
			setExitError(error.message || 'Could not exit this queue right now.')
		} finally {
			setExiting(false)
		}
	}

	return (
		<article className="history-card">
			<div className="history-card-leading"><span className="history-ticket-icon"><i className="fa-solid fa-ticket" aria-hidden="true" /></span><div className="history-card-main"><div className="history-card-title"><h2>{item.service_name}</h2><span className={`history-status status-${item.status.replace(/\s+/g, '-')}`}><span />{statusLabel}</span></div></div></div>
			<div className="history-card-details">
				<div><span>Visit date</span><strong><i className="fa-regular fa-calendar" aria-hidden="true" />{formattedDate}</strong></div>
				<div><span>Queue token</span><strong><i className="fa-solid fa-hashtag" aria-hidden="true" />{item.token_number}</strong></div>
				<div><span>Queue position</span><strong><i className="fa-solid fa-list-ol" aria-hidden="true" />{item.q_position}</strong></div>
				<div><span>Expected time</span><strong><i className="fa-regular fa-clock" aria-hidden="true" />{formattedTimeGiven}</strong></div>
				{completionDuration !== null && <div><span>Service time</span><strong><i className="fa-regular fa-clock" aria-hidden="true" />{completionDuration} min</strong></div>}
			</div>
			{canExitQueue && (
				<div className="history-card-actions">
					<button type="button" className="outline-action" onClick={handleExitQueue} disabled={exiting}>
						<i className="fa-solid fa-circle-xmark" aria-hidden="true" /> {exiting ? 'Exiting…' : 'Exit queue'}
					</button>
				</div>
			)}
			{exitError && <p className="history-status-note history-status-note--error">{exitError}</p>}
			{item.status === 'cancelled' || item.status === 'no_show' ? <p className="history-status-note">This booking is no longer active.</p> : null}
		</article>
	)
}

export default ServiceHistory