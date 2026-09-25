'use client'

import { useState } from 'react'
import { Popup } from '@/components/labs/LabViewParts'

// What the check-in page asks when someone scanned or ticked into a lab hasn't paid
// their dues for the year (the server's DUES_UNPAID — see POST
// /labs/:labId/checkin). Three answers:
//
//   waive   let them in this once without paying
//   wait    close this and leave them not checked in, to scan others while
//           they sort it out — closing the popup any other way is the same
//   paid    they've paid at the door: marked paid for the year, checked in
//
//   name, schoolYear, amount   who, and what they owe
//   onChoose                   ('waive' | 'paid') -> resolves once they're in;
//                              throws if the server refused
//   onClose                    called once the popup has gone, whichever way —
//                              after a choice, or for wait

const money = (amount) => Number(amount).toLocaleString('en-US', { style: 'currency', currency: 'USD' })

const TONE = {
	waive: 'bg-[#EBD24A] text-white',
	wait: 'border border-black/70 text-black',
	paid: 'bg-green text-[#295212]',
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

export default function DuesPopup({ name, schoolYear, amount, onChoose, onClose }) {
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
						paid their {schoolYear} dues ({money(amount)}), so they haven’t been checked in.
					</p>
					<p className={line}>
						<b className="text-black">waive</b> lets them in this once.{' '}
						<b className="text-black">wait</b> leaves them not checked in while they pay.{' '}
						<b className="text-black">paid</b> marks their dues paid and checks them in.
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

					<div className="
						mt-8
						flex
						gap-3
					">
						<Choice tone="waive" disabled={!!busy} onClick={() => choose('waive', dismiss)}>
							{busy === 'waive' ? 'waiving…' : 'waive'}
						</Choice>
						<Choice tone="wait" disabled={!!busy} onClick={() => dismiss(onClose)}>
							wait
						</Choice>
						<Choice tone="paid" disabled={!!busy} onClick={() => choose('paid', dismiss)}>
							{busy === 'paid' ? 'saving…' : 'paid'}
						</Choice>
					</div>
				</>
			)}
		</Popup>
	)
}
