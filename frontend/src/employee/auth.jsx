import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import '../assets/citizen_css/auth.css'
import '../assets/employee_css/employee.css'
import { authenticateEmployee } from './authApi.js'

const EmployeeAuth = () => {
	const [showPassword, setShowPassword] = useState(false)
	const [message, setMessage] = useState('')
	const [isSubmitting, setIsSubmitting] = useState(false)
	const panelRef = useRef(null)

	useEffect(() => {
		document.title = 'QMate | Employee access'
		if (!window.gsap || !panelRef.current) return undefined
		const animation = window.gsap.context(() => {
			window.gsap.from('.welcome-copy > *, .auth-content > *', {
				opacity: 0,
				y: 18,
				duration: 0.7,
				stagger: 0.08,
				ease: 'power2.out',
			})
			window.gsap.to('.orbit-core', {
				y: -7,
				duration: 2.8,
				repeat: -1,
				yoyo: true,
				ease: 'sine.inOut',
			})
		}, panelRef)
		return () => {
			animation.revert()
			document.title = 'QMate | Citizen access'
		}
	}, [])

	const handleSubmit = async (event) => {
		event.preventDefault()
		const formData = new FormData(event.currentTarget)
		setIsSubmitting(true)
		setMessage('')
		try {
			const result = await authenticateEmployee({
				phone: formData.get('phone'),
				password: formData.get('password'),
			})
			sessionStorage.setItem('qmate.employee.auth', JSON.stringify(result))
			window.location.replace('/employee/dashboard')
		} catch (error) {
			setMessage(error.message || 'Unable to sign in. Check your connection and try again.')
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<main className="auth-shell employee-auth-shell" ref={panelRef}>
			<section className="welcome-panel" aria-label="QMate employee workspace">
				<Link className="brand" to="/employee/auth" aria-label="QMate employee access">
					<span className="brand-mark"><i className="fa-solid fa-ticket" aria-hidden="true" /></span>
					<span>QMate<span className="brand-period">.</span></span>
					<span className="brand-tag">EMPLOYEE DESK</span>
				</Link>
				<div className="welcome-art" aria-hidden="true">
					<div className="art-grid" />
					<div className="orbit-ring orbit-ring--outer" />
					<div className="orbit-ring orbit-ring--middle" />
					<div className="orbit-ring orbit-ring--inner" />
					<div className="orbit-core"><div className="orbit-core-content"><div className="core-icon"><i className="fa-solid fa-headset" /></div><span className="core-caption">YOUR SERVICE DESK</span></div></div>
					<div className="art-note art-note--top"><span className="note-icon"><i className="fa-solid fa-list-check" /></span><span><small>One clear view</small><strong>Keep your queue moving</strong></span></div>
					<div className="art-note art-note--bottom"><span className="note-icon note-icon--green"><i className="fa-solid fa-circle-check" /></span><span><small>At your counter</small><strong>Serve with confidence</strong></span></div>
					<span className="art-spark art-spark--one"><i className="fa-solid fa-sun" /></span>
					<span className="art-spark art-spark--two"><i className="fa-solid fa-star" /></span>
				</div>
				<div className="welcome-copy">
					<p className="eyebrow"><span /> THE SERVICE COUNTER</p>
					<h1>Good service<br />starts in sync.</h1>
					<p className="welcome-description">Keep track of arrivals, manage your live queue, and record each completed visit from one focused workspace.</p>
					<div className="trust-row"><span className="trust-icon"><i className="fa-solid fa-shield-halved" aria-hidden="true" /></span><span>Secure access for authorized staff</span></div>
				</div>
				<span className="panel-footnote">A CLEARER DAY AT THE COUNTER</span>
			</section>

			<section className="form-panel" aria-label="Employee sign in">
				<div className="form-topline">
					<span className="mobile-brand"><span className="brand-mark"><i className="fa-solid fa-ticket" aria-hidden="true" /></span>QMate<span className="brand-period">.</span></span>
					<span className="secure-label"><i className="fa-solid fa-lock" aria-hidden="true" /> EMPLOYEE ACCESS</span>
				</div>
				<div className="auth-content">
					<div className="form-heading"><p className="eyebrow">STAFF WORKSPACE</p><h2>Welcome back.</h2><p>Sign in with your employee account to open your service desk.</p></div>
					<form className="auth-form" onSubmit={handleSubmit}>
						<label className="field"><span>Phone number</span><span className="input-wrap"><i className="fa-solid fa-phone field-icon" aria-hidden="true" /><input autoComplete="username" inputMode="tel" name="phone" placeholder="Your employee phone number" type="tel" minLength="8" maxLength="16" required /></span></label>
						<label className="field"><span>Password</span><span className="input-wrap"><i className="fa-solid fa-lock field-icon" aria-hidden="true" /><input autoComplete="current-password" name="password" placeholder="Enter your password" type={showPassword ? 'text' : 'password'} required /><button className="visibility-button" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}><i className={`fa-regular ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true" /></button></span></label>
						<button className="submit-button" type="submit" disabled={isSubmitting}><span>{isSubmitting ? 'Signing in…' : 'Sign in to employee desk'}</span><i className="fa-solid fa-arrow-right-to-bracket" aria-hidden="true" /></button>
						<p className={`form-message${message ? ' is-visible' : ''}`} role="alert">{message}</p>
					</form>
					<p className="panel-switch-link">Using citizen services? <Link to="/citizen/auth">Citizen sign in</Link></p>
				</div>
				<div className="form-footer"><span>QMate employee desk</span><span><i className="fa-solid fa-circle" aria-hidden="true" /> Authorized staff</span></div>
			</section>
		</main>
	)
}

export default EmployeeAuth