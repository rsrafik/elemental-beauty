'use client'

import { useEffect, useState } from 'react'

// The check-in page's "email unpaid" and "confirmation" open with the email
// they'd send already written in — the same subject and message boxes as
// "email all", but filled with the club's usual words — so an officer can
// change it before it goes (see src/emailDrafts.js).
//
// useEmailDraft(load): load() -> { subject, message }, the usual email.
//   Returns { ready, error, subject, message, setSubject, setMessage,
//   edited, reset, custom } — `custom` is what to send with the request:
//   the officer's subject and message once they've changed anything, and
//   undefined while it's still the usual email, so everyone gets the one
//   tailored to where they stand (an overdue reminder says it's overdue).
//
// <EmailDraftFields draft={…} placeholders={['{first name}', …]} />

export function useEmailDraft(load) {
	const [draft, setDraft] = useState(null)
	const [error, setError] = useState(null)
	const [subject, setSubject] = useState('')
	const [message, setMessage] = useState('')

	useEffect(() => {
		let live = true
		load()
			.then((reply) => {
				if (!live) return
				setDraft(reply)
				setSubject(reply.subject)
				setMessage(reply.message)
			})
			.catch((err) => live && setError(err.message))
		return () => { live = false }
		// read once, when the popup opens
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const edited = Boolean(draft) && (subject.trim() !== draft.subject.trim() || message.trim() !== draft.message.trim())
	const filled = subject.trim() !== '' && message.trim() !== ''
	return {
		ready: Boolean(draft) && filled,
		error,
		subject,
		message,
		setSubject,
		setMessage,
		edited,
		reset: () => {
			if (!draft) return
			setSubject(draft.subject)
			setMessage(draft.message)
		},
		custom: edited ? { subject: subject.trim(), message: message.trim() } : undefined,
	}
}

const FIELD = `
	w-full
	rounded-[10px]
	border
	border-black/25
	bg-white
	px-4
	py-2.5
	font-vietnam
	text-sm
	text-black
	outline-none
	transition-colors
	duration-200
	focus:border-black
`

const LABEL = `
	block
	font-vietnam
	text-[11px]
	uppercase
	tracking-[0.12em]
	text-black/50
	mb-1.5
`

export function EmailDraftFields({ draft, placeholders = [], note }) {
	if (draft.error) {
		return (
			<p className="
				mt-5
				font-vietnam
				font-semibold
				text-sm
				text-salmon-dark
			">
				Couldn’t load the email: {draft.error}
			</p>
		)
	}
	if (!draft.ready && draft.subject === '' && draft.message === '') {
		return (
			<p className="
				mt-5
				font-vietnam
				text-sm
				text-black/50
			">
				loading the email…
			</p>
		)
	}
	return (
		<>
			<label className="block mt-5">
				<span className={LABEL}>subject</span>
				<input
					type="text"
					value={draft.subject}
					onChange={(event) => draft.setSubject(event.target.value)}
					maxLength={200}
					className={FIELD}
				/>
			</label>

			<label className="block mt-4">
				<span className={LABEL}>message</span>
				<textarea
					value={draft.message}
					onChange={(event) => draft.setMessage(event.target.value)}
					rows={10}
					maxLength={10000}
					className={`${FIELD} resize-y`}
				/>
			</label>

			<div className="
				mt-2
				flex
				flex-wrap
				items-start
				justify-between
				gap-x-4
				gap-y-1
			">
				<p className="
					font-vietnam
					text-xs
					text-black/50
					flex-1
					min-w-[200px]
				">
					A blank line starts a new paragraph.
					{placeholders.length > 0 && <> {placeholders.join(' and ')} {placeholders.length === 1 ? 'is' : 'are'} filled in for each person.</>}
					{note && <> {note}</>}
				</p>
				{draft.edited && (
					<button
						type="button"
						onClick={draft.reset}
						className="
							font-vietnam
							font-semibold
							text-xs
							text-black/55
							underline
							underline-offset-2
							cursor-pointer
							hover:text-black
						"
					>
						back to the usual email
					</button>
				)}
			</div>
		</>
	)
}
