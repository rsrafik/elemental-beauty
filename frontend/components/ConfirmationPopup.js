'use client'

import { useState } from 'react'
import { Popup, PopupButton } from '@/components/labs/LabViewParts'
import DateTimeField from '@/components/labs/DateTimeField'

// The check-in page's "confirmation": asks everyone signed up who hasn't
// confirmed yet to confirm their spot. Each gets their own email with a
// "Confirm my spot" button (and a lab's prelab attached), and a deadline set
// here; anyone who hasn't confirmed by then loses the spot to the waitlist.
// See src/offers.js.
//
//   count     how many haven't confirmed — who it'll go to
//   what      the lab or event's name
//   prelab    the prelab's file name, or null
//   startsAt  when the lab or event starts (a Date), or null
//   onSend    (deadline: ISO string) -> the server's reply; throws if refused

const pad = (n) => String(n).padStart(2, '0')

// a Date as <input type="datetime-local"> wants it, in local time
function toInput(at) {
	return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`
}

// 48 hours from now, on the hour — or the start, if that comes sooner
function defaultDeadline(startsAt) {
	const at = new Date(Date.now() + 48 * 3_600_000)
	at.setMinutes(0, 0, 0)
	return toInput(startsAt && startsAt < at ? startsAt : at)
}

const FIELD = `
	w-full
	h-[42px]
	rounded-[10px]
	border
	border-black/25
	bg-white
	px-4
	font-vietnam
	text-sm
	text-black
	outline-none
	transition-colors
	duration-200
	focus:border-black
`

export default function ConfirmationPopup({ count, what, prelab, startsAt, onSend, onClose }) {
	const [busy, setBusy] = useState(false)
	const [status, setStatus] = useState(null)
	const [deadline, setDeadline] = useState(() => defaultDeadline(startsAt))
	// "has it passed?" is judged against when the popup opened — the server
	// checks it again against the real time when it's sent
	const [opened] = useState(() => Date.now())

	const when = deadline ? new Date(deadline) : null
	const passed = when && when.getTime() <= opened
	const afterStart = when && startsAt && when > startsAt
	const ready = !busy && count > 0 && when && !passed

	const send = async (dismiss) => {
		if (!ready) return
		setBusy(true)
		setStatus(null)
		try {
			const reply = await onSend(when.toISOString())
			setStatus({ text: reply?.message ?? 'Sent' })
			setTimeout(() => dismiss(onClose), 1600)
		} catch (err) {
			setStatus({ error: true, text: err.message })
			setBusy(false)
		}
	}

	const line = 'font-vietnam text-sm text-black/60 mt-3'

	return (
		<Popup title="confirmation" onClose={onClose}>
			{(dismiss) => (
				<>
					{count > 0 ? (
						<>
							<p className={line}>
								Email <span className="font-semibold text-black">{count} {count === 1 ? 'person' : 'people'}</span> signed
								up for {what} who {count === 1 ? 'hasn’t' : 'haven’t'} confirmed yet, each with a button to confirm
								their spot.
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
									confirm by
								</span>
								<DateTimeField
									id="confirm-by"
									value={deadline}
									onChange={setDeadline}
									zoom={1}
									className={`${FIELD} ${passed ? 'border-red' : ''}`}
								/>
							</label>
							<p className={`
								${line}
								${passed || afterStart ? 'text-salmon-dark font-semibold' : ''}
							`}>
								{passed
									? 'That time has already passed — pick one ahead.'
									: afterStart
										? `That’s after ${what} starts, so nobody would lose their spot before it.`
										: `Anyone who hasn’t confirmed by then loses their spot, and it’s offered to the next person on the waitlist.`}
							</p>
							<p className={`${line} ${prelab ? 'text-green-dark font-semibold' : ''}`}>
								{prelab
									? `The prelab (${prelab}) will be attached.`
									: 'No prelab uploaded — it’ll go without one.'}
							</p>
						</>
					) : (
						<p className={line}>Everyone signed up for {what} has already confirmed.</p>
					)}

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
						mt-8
						flex
						justify-end
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
				</>
			)}
		</Popup>
	)
}
