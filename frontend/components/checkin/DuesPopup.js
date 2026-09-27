'use client'

import { useState } from 'react'
import { Popup } from '@/components/labs/LabViewParts'

// What the check-in page asks when someone scanned or ticked into a lab or a
// members-only event hasn't paid their dues for the year (the server's
// DUES_UNPAID — see src/dues.js). Up to four answers:
//
//   paid    they've paid their dues at the door: marked paid for the year,
//           checked in (only when the year's dues are set)
//   fee     they've paid the non-member price for this one: taken as income,
//           checked in, and asked again next time (only when it's set)
//   waive   let them in this once without paying
//   wait    close this and leave them not checked in, to scan others while
//           they sort it out — closing the popup any other way is the same
//
//   name, schoolYear   who, and which year
//   amount, price      the year's dues and the non-member price (0 = not set)
//   onChoose           ('paid' | 'fee' | 'waive') -> resolves once they're
//                      in; throws if the server refused
//   onClose                    called once the popup has gone, whichever way —
//                              after a choice, or for wait

const money = (amount) => Number(amount).toLocaleString('en-US', { style: 'currency', currency: 'USD' })

const TONE = {
	waive: 'bg-[#EBD24A] text-white',
	wait: 'border border-black/70 text-black',
	paid: 'bg-green text-[#295212]',
	fee: 'bg-blue-light text-blue-med',
}

function Choice({ tone, onClick, disabled, children }) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className={`
				flex-1
				rounded-full
				px-5
				py-2
				font-vietnam
				font-semibold
				text-sm
				cursor-pointer
				transition-all
				duration-200
				ease-out
				hover:-translate-y-0.5
				hover:shadow-lg
				hover:shadow-black/10
				hover:brightness-95
				active:translate-y-0
				active:shadow-none
				disabled:opacity-50
				disabled:cursor-default
				disabled:hover:translate-y-0
				disabled:hover:shadow-none
				${TONE[tone]}
			`}
		>
			{children}
		</button>
	)
}

export default function DuesPopup({ name, schoolYear, amount, price = 0, onChoose, onClose }) {
	// which answer is on its way to the server
	const [busy, setBusy] = useState(null)
	const [error, setError] = useState(null)

	const choose = async (choice, dismiss) => {
		if (busy) return
		setBusy(choice)
		setError(null)
		try {
			await onChoose(choice)
			dismiss(onClose)
		} catch (err) {
			setError(err.message)
			setBusy(null)
		}
	}

	const line = 'font-vietnam text-sm text-black/60 mt-3'

	return (
		<Popup title="dues unpaid" onClose={onClose}>
			{(dismiss) => (
				<>
					<p className={line}>
						<span className="font-semibold text-black">{name ?? 'This member'}</span> hasn’t
						paid their {schoolYear} dues{amount > 0 ? ` (${money(amount)})` : ''}, so they
						haven’t been checked in.
					</p>
					<p className={line}>
						{amount > 0 && <><b className="text-black">paid dues</b> marks them paid for the semester.{' '}</>}
						{price > 0 && <><b className="text-black">paid entry</b> takes the {money(price)} non-member price for this one.{' '}</>}
						<b className="text-black">waive</b> lets them in this once.{' '}
						<b className="text-black">wait</b> leaves them not checked in while they pay.
					</p>

					{error && (
						<p
							role="status"
							className="
								mt-3
								font-vietnam
								font-semibold
								text-sm
								text-salmon-dark
							"
						>
							{error}
						</p>
					)}

					{/* the ways they can pay on top, the two that let nothing
					    change hands underneath */}
					{(amount > 0 || price > 0) && (
						<div className="
							mt-8
							flex
							gap-3
						">
							{amount > 0 && (
								<Choice tone="paid" disabled={!!busy} onClick={() => choose('paid', dismiss)}>
									{busy === 'paid' ? 'saving…' : `paid dues · ${money(amount)}`}
								</Choice>
							)}
							{price > 0 && (
								<Choice tone="fee" disabled={!!busy} onClick={() => choose('fee', dismiss)}>
									{busy === 'fee' ? 'saving…' : `paid entry · ${money(price)}`}
								</Choice>
							)}
						</div>
					)}
					<div className={`
						${amount > 0 || price > 0 ? 'mt-3' : 'mt-8'}
						flex
						gap-3
					`}>
						<Choice tone="waive" disabled={!!busy} onClick={() => choose('waive', dismiss)}>
							{busy === 'waive' ? 'waiving…' : 'waive'}
						</Choice>
						<Choice tone="wait" disabled={!!busy} onClick={() => dismiss(onClose)}>
							wait
						</Choice>
					</div>
				</>
			)}
		</Popup>
	)
}
