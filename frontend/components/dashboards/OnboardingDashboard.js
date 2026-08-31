'use client'

import { useState } from 'react'
import Sidebar from '@/components/dashboards/Sidebar'
import { useRole, useSession, useSignOut } from '@/lib/session'
import { navFor, showInstagramFor } from '@/lib/nav'
import { auth } from '@/lib/api'

// Shown to a user (role = 'user') — an account with no membership behind it.
// The menu is the dashboard and nothing else: labs, events and the calendar are
// the club's, and you join before you get to see them.
//
// Signing the waiver is what joins. With email verification switched off it's
// the only gate left, so this button is the whole of the onboarding: it creates
// the member row, and refreshing the session re-renders the app one rank up —
// the menu fills in and this page becomes the member dashboard.
export default function OnboardingDashboard() {
	const role = useRole()
	const signOut = useSignOut()
	const { user, refresh } = useSession()

	const [signing, setSigning] = useState(false)
	const [error, setError] = useState(null)

	const sign = async () => {
		setSigning(true)
		setError(null)
		try {
			await auth.signWaiver()
			await refresh()
		} catch (err) {
			setError(err.message)
			setSigning(false)
		}
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
						one thing left
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
						Sign the waiver and you&rsquo;re an Elementist: labs, events and the
						calendar open up, and your points start counting from your first
						check-in.
					</p>

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

					<button
						type="button"
						onClick={sign}
						disabled={signing}
						className={`
							mt-7
							w-full
							rounded-full
							px-7
							py-3
							font-vietnam
							font-semibold
							text-sm
							transition-all
							duration-200
							ease-out
							${signing
								? 'bg-black/10 text-black/35 cursor-not-allowed'
								: `bg-black
								   text-cream
								   cursor-pointer
								   hover:-translate-y-0.5
								   hover:shadow-lg
								   hover:shadow-black/25
								   active:translate-y-0
								   active:shadow-none`}
						`}
					>
						{signing ? 'signing…' : 'sign the waiver'}
					</button>
				</div>
			</section>
		</main>
	)
}
