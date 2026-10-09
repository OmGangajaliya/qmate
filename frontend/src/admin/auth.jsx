import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import '../assets/citizen_css/auth.css'
import '../assets/admin_css/admin.css'
import { authenticateAdmin } from './adminApi.js'

const AdminAuth = () => {
	const [showPassword, setShowPassword] = useState(false)
	const [message, setMessage] = useState('')
	const [isSubmitting, setIsSubmitting] = useState(false)
	const panelRef = useRef(null)

	useEffect(() => {
		document.title = 'QMate | Administrator access'
		if (!window.gsap || !panelRef.current) return () => { document.title = 'QMate | Citizen access' }
		const animation = window.gsap.context(() => {
			window.gsap.from('.welcome-copy > *, .auth-content > *', { opacity: 0, y: 18, duration: 0.7, stagger: 0.08, ease: 'power2.out' })
			window.gsap.to('.orbit-core', { y: -7, duration: 2.8, repeat: -1, yoyo: true, ease: 'sine.inOut' })
		}, panelRef)
		return () => { animation.revert(); document.title = 'QMate | Citizen access' }
	}, [])

	const handleSubmit = async (event) => {
		event.preventDefault()
		const formData = new FormData(event.currentTarget)
		setIsSubmitting(true)
		setMessage('')
		try {
			const result = await authenticateAdmin({ phone: formData.get('phone'), password: formData.get('password') })
			sessionStorage.setItem('qmate.admin.auth', JSON.stringify(result))
			window.location.replace('/admin/dashboard')
		} catch (error) {
			setMessage(error.message || 'Unable to sign in. Check your credentials and try again.')
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<main className="auth-shell admin-auth-shell" ref={panelRef}>
			<section className="welcome-panel" aria-label="QMate administration">
				<Link className="brand" to="/admin/auth" aria-label="QMate admin access"><span className="brand-mark"><i className="fa-solid fa-ticket" aria-hidden="true" /></span><span>QMate<span className="brand-period">.</span></span><span className="brand-tag">ADMIN CONSOLE</span></Link>
				<div className="welcome-art" aria-hidden="true"><div className="art-grid" /><div className="orbit-ring orbit-ring--outer" /><div className="orbit-ring orbit-ring--middle" /><div className="orbit-ring orbit-ring--inner" /><div className="orbit-core"><div className="orbit-core-content"><div className="core-icon"><i className="fa-solid fa-sliders" /></div><span className="core-caption">SYSTEM CONTROL</span></div></div><div className="art-note art-note--top"><span className="note-icon"><i className="fa-solid fa-building" /></span><span><small>Connected services</small><strong>One central workspace</strong></span></div><div className="art-note art-note--bottom"><span className="note-icon note-icon--green"><i className="fa-solid fa-chart-line" /></span><span><small>Operational insight</small><strong>Decisions in view</strong></span></div><span className="art-spark art-spark--one"><i className="fa-solid fa-sun" /></span><span className="art-spark art-spark--two"><i className="fa-solid fa-star" /></span></div>
				<div className="welcome-copy"><p className="eyebrow"><span /> Q MATE ADMINISTRATION</p><h1>Every service,<br />in good hands.</h1><p className="welcome-description">Manage public offices, employee access, and service performance from a single administration console.</p><div className="trust-row"><span className="trust-icon"><i className="fa-solid fa-shield-halved" aria-hidden="true" /></span><span>Restricted to authorized administrators</span></div></div>
				<span className="panel-footnote">PUBLIC SERVICE, WELL RUN</span>
			</section>
			<section className="form-panel" aria-label="Administrator sign in">
				<div className="form-topline"><span className="mobile-brand"><span className="brand-mark"><i className="fa-solid fa-ticket" aria-hidden="true" /></span>QMate<span className="brand-period">.</span></span><span className="secure-label"><i className="fa-solid fa-lock" aria-hidden="true" /> ADMINISTRATOR ACCESS</span></div>
				<div className="auth-content"><div className="form-heading"><p className="eyebrow">ADMIN CONSOLE</p><h2>Sign in to manage.</h2><p>Use your administrator account to continue.</p></div>
					<form className="auth-form" onSubmit={handleSubmit}>
						<label className="field"><span>Admin phone number</span><span className="input-wrap"><i className="fa-solid fa-phone field-icon" aria-hidden="true" /><input autoComplete="username" inputMode="tel" name="phone" placeholder="Your administrator phone" type="tel" minLength="8" maxLength="16" required /></span></label>
						<label className="field"><span>Password</span><span className="input-wrap"><i className="fa-solid fa-lock field-icon" aria-hidden="true" /><input autoComplete="current-password" name="password" placeholder="Enter your password" type={showPassword ? 'text' : 'password'} required /><button className="visibility-button" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}><i className={`fa-regular ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true" /></button></span></label>
						<button className="submit-button" type="submit" disabled={isSubmitting}><span>{isSubmitting ? 'Signing in…' : 'Open admin console'}</span><i className="fa-solid fa-arrow-right-to-bracket" aria-hidden="true" /></button>
						<p className={`form-message${message ? ' is-visible' : ''}`} role="alert">{message}</p>
					</form>
					<p className="panel-switch-link">Citizen or staff access? <Link to="/citizen/auth">Go to QMate sign in</Link></p>
				</div>
				<div className="form-footer"><span>QMate administration</span><span><i className="fa-solid fa-circle" aria-hidden="true" /> Restricted access</span></div>
			</section>
		</main>
	)
}

export default AdminAuth