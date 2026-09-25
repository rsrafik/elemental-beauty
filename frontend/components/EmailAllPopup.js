'use client'

import { useState } from 'react'
import { Popup, PopupButton } from '@/components/labs/LabViewParts'

// "Email all", written on the site and sent by the server — from the club's
// own address, in the club's layout, with replies going to the club inbox
// (see src/emailAll.js). Shared by the officer dashboard (everyone who wants
// club-wide email) and each check-in page (everyone signed up).
//
//   count           how many it'll reach, for the line at the top
//   who             what those people are — "everyone signed up for Blush"
//   defaultSubject  what the subject box starts with
//   addresses       optional — the same list, for "copy addresses" (pasting
//                   into your own mail instead)
//   onSend          ({ subject, message }) -> the server's reply; throws if
//                   it's refused

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

export default function EmailAllPopup({ count, who, defaultSubject = '', addresses, onSend, onClose }) {
	const [subject, setSubject] = useState(defaultSubject)
	const [message, setMessage] = useState('')
	const [busy, setBusy] = useState(false)
	const [status, setStatus] = useState(null) // { error?, text }

	const ready = subject.trim() !== '' && message.trim() !== '' && !busy && count > 0

	const send = async (dismiss) => {
		if (!ready) return
		setBusy(true)
		setStatus(null)
		try {
			const reply = await onSend({ subject: subject.trim(), message: message.trim() })
			setStatus({ text: reply?.message ?? 'Sent' })
			setTimeout(() => dismiss(onClose), 1400)
		} catch (err) {
			setStatus({ error: true, text: err.message })
			setBusy(false)
		}
	}

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(addresses.join('; '))
			setStatus({ text: `${addresses.length} ${addresses.length === 1 ? 'address' : 'addresses'} copied` })
		} catch {
			setStatus({ error: true, text: 'Couldn’t copy — allow clipboard access and try again' })
		}
	}

	return (
		<Popup title="email all" onClose={onClose}>
			{(dismiss) => (
				<>
					<p className="
						font-vietnam
						text-sm
						text-black/60
						mt-3
					">
						{count > 0
							? <>Goes to <span className="font-semibold text-black">{count} {count === 1 ? 'person' : 'people'}</span> — {who} — from the club’s email, in BCC. Replies go to the club’s inbox.</>
							: <>Nobody to send to yet — {who}.</>}
					</p>

					<label className="block mt-5">
						<span className="
							block
							font-vietnam
							text-[11px]
							uppercase
							tracking-[0.12em]
							text-black/50
							mb-1.5
						">
							subject
						</span>
						<input
							type="text"
							value={subject}
							onChange={(event) => setSubject(event.target.value)}
							maxLength={200}
							className={FIELD}
						/>
					</label>

					<label className="block mt-4">
						<span className="
							block
							font-vietnam
							text-[11px]
							uppercase
							tracking-[0.12em]
							text-black/50
							mb-1.5
						">
							message
						</span>
						<textarea
							value={message}
							onChange={(event) => setMessage(event.target.value)}
							rows={7}
							placeholder="A blank line starts a new paragraph."
							className={`${FIELD} resize-y`}
						/>
					</label>

					{status && (
						<p
							role="status"
							className={`
								mt-3
								font-vietnam
								font-semibold
								text-sm
								${status.error ? 'text-salmon-dark' : 'text-green-dark'}
							`}
						>
							{status.text}
						</p>
					)}

					<div className="
						mt-6
						flex
						flex-wrap
						items-center
						justify-between
						gap-3
					">
						{addresses?.length > 0 ? (
							<button
								type="button"
								onClick={copy}
								className="
									font-vietnam
									font-semibold
									text-sm
									text-black/55
									underline
									underline-offset-2
									cursor-pointer
									hover:text-black
								"
							>
								copy addresses instead
							</button>
						) : <span />}
						<div className="
							flex
							gap-3
						">
							<PopupButton onClick={() => dismiss(onClose)}>cancel</PopupButton>
							<button
								type="button"
								onClick={() => send(dismiss)}
								disabled={!ready}
								className={`
									rounded-full
									px-6
									py-2
									font-vietnam
									font-semibold
									text-sm
									transition-all
									duration-200
									ease-out
									${ready
										? 'bg-green text-[#295212] cursor-pointer hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/10 hover:brightness-95'
										: 'bg-black/10 text-black/40 cursor-not-allowed'}
								`}
							>
								{busy ? 'sending…' : 'send'}
							</button>
						</div>
					</div>
				</>
			)}
		</Popup>
	)
}
