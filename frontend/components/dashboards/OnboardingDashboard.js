'use client'

import { useEffect, useState } from 'react'
import Sidebar from '@/components/dashboards/Sidebar'
import WaiverPopup from '@/components/dashboards/WaiverPopup'
import { useRole, useSession, useSignOut } from '@/lib/session'
import { navFor, showInstagramFor } from '@/lib/nav'
import { auth } from '@/lib/api'

// Shown to a user (role = 'user') — an account with no membership behind it.
// The menu is the dashboard and nothing else: labs, events and the calendar are
// the club's, and you join before you get to see them.
//
// Two things make you a member, in either order:
//
//   confirm your email   the link mailed at sign-up (/verify). "resend" mails
//                        a fresh one; it's held for a minute after each send.
//   sign the waiver      opens the PDF; it has to be scrolled to the end
//                        before the name boxes and "sign" unlock.
//
// Whichever finishes second creates the member row, and refreshing the session
// re-renders the app one rank up — the menu fills in and this page becomes the
// member dashboard. The link usually gets clicked in another tab, so the
// session is re-read every few seconds (and when the tab comes back into
// focus) while the email is still unconfirmed.

const POLL_MS = 5_000
const RESEND_WAIT = 60

function Tick({ className }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
			<path d="M6 12.5l4 4 8-9" />
		</svg>
	)
}

// One of the two steps: its number (a tick once done), what it is, and
// whatever it needs doing — or that it's done.
function Step({ number, done, title, children }) {
	return (
		<div className="
			flex
			gap-4
			rounded-[16px]
			border
			border-black/10
			p-4
			sm:p-5
		">
			<span className={`
				w-8
				h-8
				shrink-0
				rounded-full
				flex
				items-center
				justify-center
				font-vietnam
				font-semibold
				text-sm
				${done ? 'bg-green text-green-dark' : 'bg-yellow-light text-black'}
			`}>
				{done ? <Tick className="w-4 h-4" /> : number}
			</span>
			<div className="min-w-0 flex-1">
				<p className="
					font-vietnam
					font-semibold
					text-[15px]
					text-black
				">
					{title}
				</p>
				<div className="
					mt-1
					font-vietnam
					text-sm
					leading-relaxed
					text-black/60
				">
					{children}
				</div>
			</div>
		</div>
	)
}

const ACTION = `
	mt-3
	rounded-full
	px-5
	py-2
	font-vietnam
	font-semibold
	text-sm
	transition-all
	duration-200
	ease-out
`
const ACTION_ON = `
	bg-black
	text-cream
	cursor-pointer
	hover:-translate-y-0.5
	hover:shadow-lg
	hover:shadow-black/25
	active:translate-y-0
	active:shadow-none
`
const ACTION_OFF = 'bg-black/10 text-black/35 cursor-not-allowed'

export default function OnboardingDashboard() {
	const role = useRole()
	const signOut = useSignOut()
	const { user, refresh } = useSession()

	const verified = Boolean(user?.emailVerified)
	const signed = Boolean(user?.waiverSigned)
	const left = (verified ? 0 : 1) + (signed ? 0 : 1)

	const [waiverOpen, setWaiverOpen] = useState(false)
	const [error, setError] = useState(null)
	const [sending, setSending] = useState(false)
	const [sent, setSent] = useState(false)
	// seconds until "resend" can be pressed again
	const [wait, setWait] = useState(0)

	// Catch the link being clicked in another tab. A quiet read rather than
	// `refresh`: that one treats any failure as signed out, and a blip here
	// shouldn't bounce anyone to the login page. The session is only re-read
	// once the answer has actually changed.
	useEffect(() => {
		if (verified) return
		const check = () =>
			auth.me()
				.then((me) => {
					if (me.emailVerified || me.role !== 'user') refresh()
				})
				.catch(() => {})
		const timer = setInterval(check, POLL_MS)
		window.addEventListener('focus', check)
		return () => {
			clearInterval(timer)
			window.removeEventListener('focus', check)
		}
	}, [verified, refresh])

	useEffect(() => {
		if (wait <= 0) return
		const timer = setTimeout(() => setWait((w) => w - 1), 1000)
		return () => clearTimeout(timer)
	}, [wait])

	const resend = async () => {
		if (sending || wait > 0) return
		setSending(true)
		setError(null)
		try {
			await auth.resendVerification()
			setSent(true)
			setWait(RESEND_WAIT)
		} catch (err) {
			setError(err.message)
		} finally {
			setSending(false)
		}
	}

	// the popup shows its own errors (a name that doesn't match); this only
	// runs once it's gone through
	const sign = async (name) => {
		await auth.signWaiver(name)
		await refresh()
	}

	return (
		<main className="
			bg-cream
			w-full
			min-h-screen
			overflow-x-clip
			p-4
			sm:p-6
			lg:p-8
			flex
			flex-col
			lg:flex-row
			gap-4
			lg:gap-6
		">
			<Sidebar
				items={navFor(role)}
				showInstagram={showInstagramFor(role)}
				onLogout={signOut}
			/>

			<section className="
				page-enter
				page-stagger
				flex-1
				min-w-0
				flex
				items-center
				justify-center
			">
				<div className="
					w-full
					max-w-[560px]
					rounded-[26px]
					bg-white
					p-8
					sm:p-10
					shadow-[0_0_20px_rgba(0,0,0,0.12)]
				">
					<p className="
						font-vietnam
						text-[11px]
						uppercase
						tracking-[0.14em]
						text-black/45
					">
						welcome{user?.firstName ? `, ${user.firstName}` : ''}
					</p>
					<h1 className="
						font-beachday
						mt-2
						text-[34px]
						sm:text-[44px]
						leading-none
						text-black
					">
						{left === 1 ? 'one thing left' : 'two things left'}
					</h1>
					<p className="
						font-handrawn
						mt-4
						text-2xl
						leading-tight
						text-black
					">
						You&rsquo;ve got an account. You don&rsquo;t have a membership yet!
					</p>
					<p className="
						font-vietnam
						mt-3
						text-sm
						leading-relaxed
						text-black/60
					">
						Confirm your email and sign the waiver and you&rsquo;re an
						Elementist: labs, events and the calendar open up, and your points
						start counting from your first check-in.
					</p>

					<div className="
						mt-6
						flex
						flex-col
						gap-3
					">
						<Step number={1} done={verified} title="confirm your email">
							{verified ? (
								<>Confirmed — {user?.email}.</>
							) : (
								<>
									We sent a link to{' '}
									<span className="font-semibold text-black">{user?.email}</span>.
									Open it to confirm — check your spam folder if it isn&rsquo;t there.
									<div>
										<button
											type="button"
											onClick={resend}
											disabled={sending || wait > 0}
											className={`${ACTION} ${sending || wait > 0 ? ACTION_OFF : ACTION_ON}`}
										>
											{sending
												? 'sending…'
												: wait > 0
													? `sent! resend in ${wait}s`
													: sent ? 'resend again' : 'resend link'}
										</button>
									</div>
								</>
							)}
						</Step>

						<Step number={2} done={signed} title="sign the waiver">
							{signed ? (
								<>Signed{user?.waiverName ? ` by ${user.waiverName}` : ''}.</>
							) : (
								<>
									Read it through to the end, then sign with your first and last
									name.
									<div>
										<button
											type="button"
											onClick={() => setWaiverOpen(true)}
											className={`${ACTION} ${ACTION_ON}`}
										>
											read &amp; sign the waiver
										</button>
									</div>
								</>
							)}
						</Step>
					</div>

					{error && (
						<p className="
							font-vietnam
							mt-5
							rounded-[12px]
							bg-salmon-lightest
							px-4
							py-3
							text-sm
							text-salmon-dark
						">
							{error}
						</p>
					)}
				</div>
			</section>

			{waiverOpen && (
				<WaiverPopup
					onClose={() => setWaiverOpen(false)}
					onSign={sign}
				/>
			)}
		</main>
	)
}
