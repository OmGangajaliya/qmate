import { useEffect, useRef, useState } from 'react'
import '../assets/citizen_css/auth.css'

const CitizenAuth = () => {
	const [mode, setMode] = useState('signin')
	const [showPassword, setShowPassword] = useState(false)
	const [message, setMessage] = useState('')
	const panelRef = useRef(null)
	const isSignup = mode === 'signup'

	useEffect(() => {
		if (!window.gsap || !panelRef.current) return undefined

		const animation = window.gsap.context(() => {
			window.gsap.from('.welcome-copy > *, .auth-content > *', {
				opacity: 0,
				y: 18,
				duration: 0.8,
				stagger: 0.09,
				ease: 'power2.out',
			})
			window.gsap.to('.orbit-core', {
				y: -7,
				duration: 2.8,
				repeat: -1,
				yoyo: true,
				ease: 'sine.inOut',
			})
			window.gsap.to('.orbit-ring--outer', {
				rotate: 12,
				duration: 16,
				repeat: -1,
				yoyo: true,
				ease: 'sine.inOut',
			})
		}, panelRef)

		return () => animation.revert()
	}, [])

	const switchMode = (nextMode) => {
		setMode(nextMode)
		setMessage('')
		setShowPassword(false)
	}

	const handleSubmit = (event) => {
		event.preventDefault()
		const formData = new FormData(event.currentTarget)

		if (isSignup && formData.get('password') !== formData.get('confirmPassword')) {
			setMessage('Those passwords do not match. Please try again.')
			return
		}

		setMessage(
			isSignup
				? 'Your details look good. Account creation will be available when QMate authentication is connected.'
				: 'Your details look good. Sign-in will be available when QMate authentication is connected.',
		)
	}

	return (
		<main className="auth-shell" ref={panelRef}>
			<section className="welcome-panel" aria-label="About QMate">
				<a className="brand" href="#home" aria-label="QMate home">
					<span className="brand-mark"><i className="fa-solid fa-ticket" aria-hidden="true" /></span>
					<span>QMate<span className="brand-period">.</span></span>
					<span className="brand-tag">CITIZEN SERVICES</span>
				</a>

				<div className="welcome-art" aria-hidden="true">
					<div className="art-grid" />
					<div className="orbit-ring orbit-ring--outer" />
					<div className="orbit-ring orbit-ring--middle" />
					<div className="orbit-ring orbit-ring--inner" />
					<div className="orbit-core">
						<div className="core-icon"><i className="fa-solid fa-arrow-right-to-bracket" /></div>
						<span className="core-caption">YOUR PLACE, MADE SIMPLE</span>
					</div>
					<div className="art-note art-note--top">
						<span className="note-icon"><i className="fa-solid fa-clock" /></span>
						<span><small>Time well spent</small><strong>Skip the waiting room</strong></span>
					</div>
					<div className="art-note art-note--bottom">
						<span className="note-icon note-icon--green"><i className="fa-solid fa-location-dot" /></span>
						<span><small>Your next visit</small><strong>In one simple place</strong></span>
					</div>
					<span className="art-spark art-spark--one"><i className="fa-solid fa-sun" /></span>
					<span className="art-spark art-spark--two"><i className="fa-solid fa-star" /></span>
				</div>

				<div className="welcome-copy">
					<p className="eyebrow"><span /> PUBLIC SERVICES, SIMPLIFIED</p>
					<h1>Make your time<br />count for more.</h1>
					<p className="welcome-description">A calmer way to access local services. Find your place in line, plan your visit, and get on with your day.</p>
					<div className="trust-row">
						<span className="trust-icon"><i className="fa-solid fa-shield-halved" aria-hidden="true" /></span>
						<span>Designed around your time and privacy</span>
					</div>
				</div>
				<span className="panel-footnote">A LITTLE LESS WAITING. A LOT MORE LIVING.</span>
			</section>

			<section className="form-panel" aria-label={isSignup ? 'Create a citizen account' : 'Citizen sign in'}>
				<div className="form-topline">
					<span className="mobile-brand"><span className="brand-mark"><i className="fa-solid fa-ticket" aria-hidden="true" /></span>QMate<span className="brand-period">.</span></span>
					<span className="secure-label"><i className="fa-solid fa-lock" aria-hidden="true" /> SECURE CITIZEN ACCESS</span>
				</div>

				<div className="auth-content">
					<div className="form-heading">
						<p className="eyebrow">{isSignup ? 'GET STARTED' : 'WELCOME BACK'}</p>
						<h2>{isSignup ? 'Create your account' : 'Good to see you.'}</h2>
						<p>{isSignup ? 'A few details and you’re ready to go.' : 'Sign in to make your next visit a little easier.'}</p>
					</div>

					<div className="mode-switch" role="tablist" aria-label="Authentication type">
						<button className={isSignup ? '' : 'is-active'} type="button" role="tab" aria-selected={!isSignup} onClick={() => switchMode('signin')}>Sign in</button>
						<button className={isSignup ? 'is-active' : ''} type="button" role="tab" aria-selected={isSignup} onClick={() => switchMode('signup')}>Create account</button>
					</div>

					<form className="auth-form" onSubmit={handleSubmit} key={mode}>
						{isSignup && (
							<label className="field">
								<span>Full name</span>
								<span className="input-wrap">
									<i className="fa-regular fa-user field-icon" aria-hidden="true" />
									<input autoComplete="name" name="fullName" placeholder="e.g. Alex Morgan" required />
								</span>
							</label>
						)}

						<label className="field">
							<span>Phone number</span>
							<span className="input-wrap">
								<i className="fa-solid fa-phone field-icon" aria-hidden="true" />
								<input autoComplete="tel" inputMode="tel" name="phone" placeholder="Your phone number" type="tel" minLength="8" maxLength="16" required />
							</span>
						</label>

						<label className="field">
							<span>Password</span>
							<span className="input-wrap">
								<i className="fa-solid fa-lock field-icon" aria-hidden="true" />
								<input autoComplete={isSignup ? 'new-password' : 'current-password'} name="password" placeholder="At least 8 characters" type={showPassword ? 'text' : 'password'} minLength="8" required />
								<button className="visibility-button" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>
									<i className={`fa-regular ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true" />
								</button>
							</span>
						</label>

						{isSignup ? (
							<label className="field">
								<span>Confirm password</span>
								<span className="input-wrap">
									<i className="fa-solid fa-lock field-icon" aria-hidden="true" />
									<input autoComplete="new-password" name="confirmPassword" placeholder="Enter your password again" type={showPassword ? 'text' : 'password'} minLength="8" required />
								</span>
							</label>
						) : (
							<div className="form-options">
								<label className="check-label"><input type="checkbox" name="remember" /><span>Keep me signed in</span></label>
								<button className="text-button" type="button" onClick={() => setMessage('For help accessing your account, contact your local QMate service desk.')}>Forgot password?</button>
							</div>
						)}

						{isSignup && (
							<label className="check-label terms-label"><input type="checkbox" name="terms" required /><span>I agree to the <a href="#terms">terms of service</a> and <a href="#privacy">privacy notice</a>.</span></label>
						)}

						<button className="submit-button" type="submit">
							<span>{isSignup ? 'Create account' : 'Sign in'}</span>
							<i className={`fa-solid ${isSignup ? 'fa-arrow-right' : 'fa-arrow-right-to-bracket'}`} aria-hidden="true" />
						</button>

						<p className={`form-message${message ? ' is-visible' : ''}`} aria-live="polite">{message}</p>
					</form>

					<p className="form-footnote"><i className="fa-solid fa-shield-halved" aria-hidden="true" /> Your personal details stay private and protected.</p>
				</div>

				<div className="form-footer"><span>© 2026 QMate</span><span><i className="fa-solid fa-circle" aria-hidden="true" /> Citizen portal</span></div>
			</section>
		</main>
	)
}

export default CitizenAuth
