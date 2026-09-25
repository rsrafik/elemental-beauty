'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { auth, getToken } from '@/lib/api'
import { useSession } from '@/lib/session'

// Where the link in the sign-up email lands: /verify?token=…. It confirms the
// address straight away — no login needed, the token is the proof — and says
// what's left. If the waiver's already signed, that was the last step and the
// account is a member now.
//
// Whoever's signed in on this browser gets their session re-read, so their
// dashboard is up to date when they click through.

function Verify() {
	const token = useSearchParams().get('token')
	const { refresh } = useSession()
	// 'working' | { ok, promoted, message }
	const [result, setResult] = useState('working')

	useEffect(() => {
		let live = true
		const run = token
			? auth.verifyEmail(token).then(
				(reply) => ({ ok: true, promoted: reply.promoted, message: reply.message }),
				(err) => ({ ok: false, message: err.message })
			)
			: Promise.resolve({ ok: false, message: 'This link is missing its code — open the one in the email again.' })
		run.then(async (outcome) => {
			if (outcome.ok && getToken()) await refresh()
			if (live) setResult(outcome)
		})
		return () => { live = false }
	}, [token, refresh])

	const signedIn = Boolean(getToken())

	let title = 'confirming…'
	let body = 'One moment.'
	if (result !== 'working') {
		// straight apostrophes: the heading's font has no curly one
		title = result.ok ? (result.promoted ? "you're in!" : 'email confirmed') : "that didn't work"
		body = result.ok
			? result.promoted
				? 'Your email’s confirmed and the waiver’s signed — you’re an Elementist. Labs, events and the calendar are open.'
				: 'Thanks! One step left: sign the waiver from your dashboard and you’re a member.'
			: `${result.message}. You can send yourself a new link from your dashboard.`
	}

	return (
		<main className="
			min-h-screen
			w-full
			bg-cream
			flex
			items-center
			justify-center
			p-4
		">
			<div className="
				page-enter
				w-full
				max-w-[460px]
				rounded-[26px]
				bg-white
				p-8
				sm:p-10
				shadow-[0_0_20px_rgba(0,0,0,0.12)]
				text-center
			">
				<h1 className="
					font-beachday
					text-[34px]
					sm:text-[42px]
					leading-none
					text-black
				">
					{title}
				</h1>
				<p className="
					font-vietnam
					mt-4
					text-sm
					leading-relaxed
					text-black/60
				">
					{body}
				</p>
				{result !== 'working' && (
					<Link
						href={signedIn ? '/dashboard' : '/login'}
						className="
							mt-7
							inline-block
							rounded-full
							bg-black
							px-7
							py-3
							font-vietnam
							font-semibold
							text-sm
							text-cream
							transition-all
							duration-200
							ease-out
							hover:-translate-y-0.5
							hover:shadow-lg
							hover:shadow-black/25
						"
					>
						{signedIn ? 'go to your dashboard' : 'log in'}
					</Link>
				)}
			</div>
		</main>
	)
}

export default function VerifyEmail() {
	return (
		<Suspense fallback={<main className="min-h-screen w-full bg-cream" />}>
			<Verify />
		</Suspense>
	)
}
