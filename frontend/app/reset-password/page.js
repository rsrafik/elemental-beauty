'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'

// Where the emailed link lands. The token in the query string is the whole of
// the proof — it's signed with the user's current password hash, so it stops
// working the moment the password changes, which makes it single-use without
// anything being stored.
//
// Same visual language as the log-in panel it came from: cream card on the
// bamboo cream, beachday labels, the pill that presses flat.

const LABEL = `
	font-beachday
	text-[21px]
	leading-none
	text-black
`

const FIELD = `
	font-vietnam
	mt-[4px]
	h-[31px]
	w-full
	rounded-[9px]
	bg-[#FFCC6E]
	px-[12px]
	text-[13px]
	text-black
	outline-none
`

function ResetForm() {
	// useSearchParams needs a Suspense boundary in an app-router page, which is
	// what the default export below wraps this in.
	const token = useSearchParams().get('token')
	const router = useRouter()

	const [password, setPassword] = useState('')
	const [verify, setVerify] = useState('')
	const [error, setError] = useState(null)
	const [busy, setBusy] = useState(false)
	const [done, setDone] = useState(false)

	const submit = async (event) => {
		event.preventDefault()
		if (busy) return

		if (password.length < 8) {
			setError('Password must be at least 8 characters.')
			return
		}
		if (password !== verify) {
			setError("Those passwords don't match.")
			return
		}

		setBusy(true)
		setError(null)
		try {
			await api('/auth/reset-password', {
				method: 'POST',
				body: { resetToken: token, newPassword: password },
				auth: false,
			})
			setDone(true)
		} catch (err) {
			setError(err.message)
		} finally {
			setBusy(false)
		}
	}

	// A link that ran out, or one somebody typed by hand. Worth saying plainly
	// rather than showing a form that can only fail on submit.
	if (!token) {
		return (
			<Card title="LINK EXPIRED">
				<p className="
					font-vietnam
					mt-[12px]
					text-[13px]
					leading-relaxed
					text-black/60
				">
					This link is missing its code, or it&apos;s already been used. Ask for
					a new one from the log-in page.
				</p>
				<Pill onClick={() => router.push('/login')}>BACK TO LOG IN</Pill>
			</Card>
		)
	}

	if (done) {
		return (
			<Card title="PASSWORD CHANGED">
				<p className="
					font-vietnam
					mt-[12px]
					text-[13px]
					leading-relaxed
					text-black/60
				">
					You can log in with the new one now.
				</p>
				<Pill onClick={() => router.push('/login')}>LOG IN</Pill>
			</Card>
		)
	}

	return (
		<Card title="NEW PASSWORD" onSubmit={submit}>
			<input
				type="password"
				autoComplete="new-password"
				autoFocus
				value={password}
				onChange={(event) => {
					setPassword(event.target.value)
					setError(null)
				}}
				className={FIELD}
			/>

			<p className={`${LABEL} mt-[19px]`}>VERIFY NEW PASSWORD</p>
			<input
				type="password"
				autoComplete="new-password"
				value={verify}
				onChange={(event) => {
					setVerify(event.target.value)
					setError(null)
				}}
				className={FIELD}
			/>

			<p className="
				font-vietnam
				mt-[10px]
				h-[15px]
				text-[12px]
				leading-tight
				text-[#B3402E]
			">
				{error ?? ''}
			</p>

			<Pill type="submit" disabled={busy}>{busy ? '...' : 'CREATE'}</Pill>
		</Card>
	)
}

function Card({ title, children, onSubmit }) {
	const Tag = onSubmit ? 'form' : 'div'
	return (
		<main className="
			flex
			min-h-svh
			w-full
			items-center
			justify-center
			bg-[#FDF4E0]
			p-4
		">
			<Tag
				{...(onSubmit ? { onSubmit } : {})}
				className="
					w-[431px]
					max-w-full
					rounded-[26px]
					bg-[#FFF6E3]
					px-[50px]
					py-[44px]
					shadow-[0_10px_40px_rgba(0,0,0,0.35)]
				"
			>
				<p className={LABEL}>{title}</p>
				{children}
			</Tag>
		</main>
	)
}

function Pill({ type = 'button', disabled = false, onClick, children }) {
	return (
		<div className="
			mt-[22px]
			flex
			justify-center
		">
			<button
				type={type}
				onClick={onClick}
				disabled={disabled}
				className={`
					font-dream
					flex
					h-[37px]
					w-[180px]
					items-center
					justify-center
					rounded-full
					text-[23px]
					leading-none
					text-white
					shadow-[4px_4px_3px_rgba(0,0,0,0.5)]
					transition-[translate,box-shadow]
					duration-150
					ease-out
					${disabled
						? 'bg-[#4066FF]/40 cursor-not-allowed'
						: `bg-[#4066FF]
						   cursor-pointer
						   active:translate-x-[4px]
						   active:translate-y-[4px]
						   active:shadow-[0px_0px_0px_rgba(0,0,0,0)]`}
				`}
			>
				{/* the same 0.185em baseline correction the log-in pill carries —
				    see the note on Button in components/login/AuthPanels.js */}
				<span className="translate-y-[0.185em]">{children}</span>
			</button>
		</div>
	)
}

export default function ResetPassword() {
	return (
		<Suspense fallback={<main className="min-h-svh w-full bg-[#FDF4E0]" />}>
			<ResetForm />
		</Suspense>
	)
}
