'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { offers, getToken } from '@/lib/api'

// Where the "Accept my spot" button in a waitlist offer email, and the
// "Confirm my spot" button in a confirmation email, land: /offer?token=…. It
// does it straight away — no login needed, the link is the proof — and says
// how it went. See src/offers.js.

function Offer() {
	const token = useSearchParams().get('token')
	// 'working' | { status, title, kind, id } | { error }
	const [result, setResult] = useState('working')

	useEffect(() => {
		let live = true
		const run = token
			? offers.accept(token).catch((err) => ({ error: err.message }))
			: Promise.resolve({ error: 'This link is missing its code — open the one in the email again' })
		run.then((outcome) => live && setResult(outcome))
		return () => { live = false }
	}, [token])

	const signedIn = Boolean(getToken())
	const what = result.title ?? 'it'

	// straight apostrophes in the headings: their font has no curly one
	let title = 'one moment…'
	let body = 'Just checking your link.'
	if (result !== 'working') {
		if (result.error) {
			title = "that didn't work"
			body = `${result.error}. If the spot's still yours, you can also do this from the club's site.`
		} else if (result.action === 'confirm') {
			if (result.status === 'confirmed') {
				title = "you're confirmed!"
				body = `Thanks — your spot in ${what} is locked in. See you there.`
			} else if (result.status === 'already') {
				title = 'already confirmed'
				body = `Your spot in ${what} was already confirmed. Nothing else to do.`
			} else {
				title = 'this spot has ended'
				body = `You're no longer signed up for ${what} — the spot may have gone to someone on the waitlist.`
			}
		} else if (result.status === 'accepted') {
			title = "you're in!"
			body = `Your spot in ${what} is confirmed — see you there.`
		} else if (result.status === 'already') {
			title = 'already yours'
			body = `You'd already accepted your spot in ${what}. Nothing else to do.`
		} else {
			title = 'this offer has ended'
			body = `The spot in ${what} isn't being held for you any more — it may have gone to the next person on the waitlist.`
		}
	}

	const href = result.kind === 'lab' && result.id ? `/labs/view?id=${result.id}` : result.kind === 'event' ? '/events' : '/dashboard'

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
						href={signedIn ? href : '/login'}
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
						{signedIn ? (result.kind === 'lab' ? 'go to the lab' : 'go to the site') : 'log in'}
					</Link>
				)}
			</div>
		</main>
	)
}

export default function AcceptOffer() {
	return (
		<Suspense fallback={<main className="min-h-screen w-full bg-cream" />}>
			<Offer />
		</Suspense>
	)
}
