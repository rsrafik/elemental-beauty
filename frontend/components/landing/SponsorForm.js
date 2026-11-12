'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { sponsors as sponsorsApi } from '@/lib/api'
import { LIMITS, OFFERS, OFFER_LABELS, missingFrom, requestBody } from '@/lib/sponsors'
import { Arrow } from './Hero'
import { CLUB, SPONSORS } from './content'

// "Sponsor a batch": the form a company fills in to offer the club products,
// money or something else. What they send lands under pending on the
// sponsors page (/sponsors), for an admin to pick up. The server holds the
// same rules (src/routes/sponsorRoutes.js) and limits how often one address
// can send it.
//
// It opens over the page the way the people do (Team.js): the page behind
// holds still, escape closes it, the focus stays inside and goes back to the
// button after. Anyone who'd rather write can still email CLUB.sponsorEmail.

const CLOSE_MS = 450
const stillMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

const EMPTY = { companyName: '', contactName: '', contactInfo: '', offers: [], offerOther: '', details: '' }

// The button that opens it: `children` and the rest of the props are the
// button's own.
export default function SponsorForm({ children, ...button }) {
	// closed, open, or closing: the stylesheet moves it on this (app/landing.css)
	const [state, setState] = useState('closed')
	const [values, setValues] = useState(EMPTY)
	// whether they've tried to send it: what's missing is said from then on
	const [tried, setTried] = useState(false)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState(null)
	const [sent, setSent] = useState(false)
	const overlayRef = useRef(null)
	const openerRef = useRef(null)
	const closingRef = useRef(null)

	const set = (key, value) => setValues((was) => ({ ...was, [key]: value }))

	const open = useCallback((event) => {
		clearTimeout(closingRef.current)
		openerRef.current = event?.currentTarget ?? null
		// a form already sent starts again empty
		if (sent) {
			setValues(EMPTY)
			setTried(false)
			setSent(false)
		}
		setError(null)
		setState('open')
	}, [sent])

	const close = useCallback(() => {
		setState((was) => (was === 'open' ? 'closing' : was))
		clearTimeout(closingRef.current)
		closingRef.current = setTimeout(() => setState('closed'), stillMotion() ? 0 : CLOSE_MS)
		openerRef.current?.focus({ preventScroll: true })
	}, [])

	// while it is open: the page behind holds still, escape closes it, and
	// the focus stays inside
	useEffect(() => {
		if (state !== 'open') return
		const overlay = overlayRef.current
		const onKey = (event) => {
			if (event.key === 'Escape') close()
			if (event.key === 'Tab') {
				const stops = [...overlay.querySelectorAll('button, input, textarea, a[href]')].filter((stop) => !stop.disabled)
				if (!stops.length) return
				const at = stops.indexOf(document.activeElement)
				const next = at === -1 ? 0 : (at + (event.shiftKey ? -1 : 1) + stops.length) % stops.length
				if (at === -1 || (event.shiftKey ? at === 0 : at === stops.length - 1)) {
					event.preventDefault()
					stops[next].focus()
				}
			}
		}
		window.addEventListener('keydown', onKey)
		document.documentElement.style.overflow = 'hidden'
		overlay.querySelector('[data-first]')?.focus({ preventScroll: true })
		return () => {
			window.removeEventListener('keydown', onKey)
			document.documentElement.style.overflow = ''
		}
	}, [state, close, sent])

	useEffect(() => () => clearTimeout(closingRef.current), [])

	const missing = missingFrom(values, { form: true })

	const submit = async (event) => {
		event.preventDefault()
		setTried(true)
		if (missing || busy) return
		setBusy(true)
		setError(null)
		try {
			await sponsorsApi.request(requestBody(values))
			setSent(true)
		} catch (err) {
			setError(err.status === 0 ? 'We couldn’t reach the server. Try again in a moment.' : err.message)
		} finally {
			setBusy(false)
		}
	}

	const toggle = (offer) => set('offers', values.offers.includes(offer)
		? values.offers.filter((one) => one !== offer)
		: [...values.offers, offer])

	const note = error || (tried ? missing : null)

	return (
		<>
			<button type="button" aria-haspopup="dialog" {...button} onClick={open}>
				{children}
			</button>

			{/* drawn only while it's up, on the page's root: out from under the
			    sections' transforms (which would pin a fixed overlay to them),
			    and inside `.landing` for the fonts and app/landing.css */}
			{state !== 'closed' && createPortal(
			<div
				ref={overlayRef}
				data-state={state}
				inert={state !== 'open'}
				className="
					lp-ask
					fixed
					inset-0
					z-70
					flex
					items-end
					justify-center
					sm:items-center
					sm:p-[clamp(1rem,4vw,3rem)]
				"
			>
				<div
					aria-hidden="true"
					onClick={close}
					className="
						lp-ask-backdrop
						absolute
						inset-0
						bg-ink/55
					"
				/>
				<div
					role="dialog"
					aria-modal="true"
					aria-labelledby="sponsor-form-title"
					className="
						lp-ask-panel
						relative
						max-h-[92dvh]
						w-full
						max-w-[40rem]
						overflow-y-auto
						overscroll-contain
						rounded-t-[2rem]
						bg-cream
						px-[clamp(1.25rem,5vw,3rem)]
						py-[clamp(1.5rem,5vw,3rem)]
						text-ink
						shadow-soft
						sm:rounded-[2rem]
					"
				>
					<div className="
						flex
						items-start
						justify-between
						gap-4
					">
						<h2
							id="sponsor-form-title"
							className="
								type-serif
								text-h3
								italic
							"
						>
							{sent ? 'thank you' : SPONSORS.cta.toLowerCase()}
						</h2>
						<button
							type="button"
							onClick={close}
							className="
								lp-underline
								type-label
								mt-2
								shrink-0
								cursor-pointer
							"
						>
							close [ esc ]
						</button>
					</div>

					{sent ? (
						<div className="mt-6">
							<p className="
								type-serif
								max-w-[30ch]
								text-h4
							">
								We’ve got it, and someone from the club will be in touch.
							</p>
							<p className="
								type-label
								mt-6
								opacity-60
							">
								Questions in the meantime: {' '}
								<a href={`mailto:${CLUB.sponsorEmail}`} className="lp-underline">{CLUB.sponsorEmail}</a>
							</p>
							<button
								type="button"
								data-first
								onClick={close}
								className="
									mt-8
									rounded-full
									bg-ink
									px-[1.5em]
									py-[0.95em]
									text-small
									leading-none
									font-semibold
									text-cream
									cursor-pointer
									transition-transform
									duration-500
									ease-spring
									hover:-translate-y-1
								"
							>
								Back to the page
							</button>
						</div>
					) : (
						<form onSubmit={submit} noValidate className="mt-3">
							<p className="
								max-w-[48ch]
								text-small
								opacity-70
							">
								Tell us who you are and what you’d like to give, whether it’s products for a lab, money towards one, or something else. We’ll get back to you.
							</p>

							<div className="
								mt-8
								flex
								flex-col
								gap-5
							">
								<Field label="Company" required>
									<input
										data-first
										type="text"
										value={values.companyName}
										onChange={(event) => set('companyName', event.target.value)}
										maxLength={LIMITS.companyName}
										autoComplete="organization"
										required
										aria-invalid={tried && !values.companyName.trim() ? true : undefined}
										className={INPUT}
									/>
								</Field>
								<div className="
									grid
									gap-5
									sm:grid-cols-2
								">
									<Field label="Contact person" required>
										<input
											type="text"
											value={values.contactName}
											onChange={(event) => set('contactName', event.target.value)}
											maxLength={LIMITS.contactName}
											autoComplete="name"
											required
											aria-invalid={tried && !values.contactName.trim() ? true : undefined}
											className={INPUT}
										/>
									</Field>
									<Field label="Email or phone" required>
										<input
											type="text"
											inputMode="email"
											value={values.contactInfo}
											onChange={(event) => set('contactInfo', event.target.value)}
											maxLength={LIMITS.contactInfo}
											autoComplete="email"
											required
											className={INPUT}
										/>
									</Field>
								</div>

								<fieldset>
									<legend className="
										type-label
										mb-2
									">
										What you’re offering <span className="opacity-50">(pick any)</span>
									</legend>
									<div className="
										flex
										flex-wrap
										gap-2
									">
										{OFFERS.map((offer) => {
											const on = values.offers.includes(offer)
											return (
												<button
													key={offer}
													type="button"
													aria-pressed={on}
													onClick={() => toggle(offer)}
													className={`
														rounded-full
														border
														px-[1.2em]
														py-[0.7em]
														text-small
														leading-none
														cursor-pointer
														transition-colors
														duration-300
														${on ? 'border-ink bg-ink text-cream' : 'border-ink/25 bg-white/60 hover:border-ink'}
													`}
												>
													{OFFER_LABELS[offer]}
												</button>
											)
										})}
									</div>
								</fieldset>

								{values.offers.includes('other') && (
									<Field label="What else" required>
										<input
											type="text"
											value={values.offerOther}
											onChange={(event) => set('offerOther', event.target.value)}
											maxLength={LIMITS.offerOther}
											placeholder="A venue, a guest speaker, a lab tour…"
											required
											className={INPUT}
										/>
									</Field>
								)}

								<Field label="Anything else we should know">
									<textarea
										value={values.details}
										onChange={(event) => set('details', event.target.value)}
										maxLength={LIMITS.details}
										rows={4}
										className={`${INPUT} resize-y`}
									/>
								</Field>
							</div>

							<p
								role="status"
								className={`
									mt-5
									min-h-[1.5em]
									text-small
									${error ? 'text-salmon-dark' : 'opacity-70'}
								`}
							>
								{note}
							</p>

							<div className="
								mt-3
								flex
								flex-wrap
								items-center
								justify-between
								gap-gutter
							">
								<button
									type="submit"
									disabled={busy}
									className="
										group
										inline-flex
										items-center
										gap-[0.7em]
										rounded-full
										bg-ink
										py-[0.95em]
										pr-[0.6em]
										pl-[1.5em]
										text-small
										leading-none
										font-semibold
										text-cream
										cursor-pointer
										transition-transform
										duration-500
										ease-spring
										hover:-translate-y-1
										active:scale-95
										disabled:opacity-60
									"
								>
									{busy ? 'Sending…' : 'Send it'}
									<Arrow />
								</button>
								<p className="
									type-label
									opacity-60
								">
									or email <a href={`mailto:${CLUB.sponsorEmail}?subject=Sponsoring%20Elemental%20Beauty`} className="lp-underline">{CLUB.sponsorEmail}</a>
								</p>
							</div>
						</form>
					)}
				</div>
			</div>,
			document.querySelector('.landing') ?? document.body,
			)}
		</>
	)
}

const INPUT = `
	w-full
	rounded-[0.9rem]
	border
	border-ink/20
	bg-white/70
	px-4
	py-3
	text-small
	text-ink
	outline-none
	transition-colors
	duration-300
	focus:border-ink
	aria-invalid:border-salmon-dark
`

function Field({ label, required = false, children }) {
	return (
		<label className="block">
			<span className="
				type-label
				mb-2
				block
			">
				{label}
				{required ? null : <span className="opacity-50"> (optional)</span>}
			</span>
			{children}
		</label>
	)
}
