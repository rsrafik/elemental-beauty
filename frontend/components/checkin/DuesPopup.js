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
//   methods            the accepted payments' names ('Venmo'), for the
//                      optional "how" and transaction id that go in the
//                      ledger row's title when money changes hands — onChoose
//                      gets them as its second argument, { method, reference }
//   ahead              asked from the $ on a row, before they're checked in
//                      (not by a check-in): the same answers, settled now so
//                      the check-in doesn't ask, and "cancel" for "wait"

const FIELD = `
	w-full
	min-w-0
	rounded-full
	border
	border-black/25
	bg-white
	px-4
	py-2
	font-vietnam
	text-xs
	text-black
	outline-none
	focus:border-black
`

// A select with its chevron drawn rather than the browser's: the native one
// sits hard against the right edge, this one is inset by the same 16px as the
// text on the left.
function Dropdown({ children, ...props }) {
	return (
		<div className="
			relative
			min-w-0
		">
			<select {...props} className={`${FIELD} appearance-none pr-10 cursor-pointer`}>
				{children}
			</select>
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2.2"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
				className="
					pointer-events-none
					absolute
					right-4
					top-1/2
					-translate-y-1/2
					w-4
					h-4
					text-black/70
				"
			>
				<path d="M6 9l6 6 6-6" />
			</svg>
		</div>
	)
}

// the small word over each of the "how it was paid" fields
const OPTIONAL = `
	block
	mb-1
	pl-4
	font-vietnam
	text-[11px]
	text-black/45
`

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

export default function DuesPopup({ name, schoolYear, amount, price = 0, onChoose, onClose, ahead = false, methods = [] }) {
	// which answer is on its way to the server
	const [busy, setBusy] = useState(null)
	const [error, setError] = useState(null)
	// how they paid — both optional, and only sent with money
	const [method, setMethod] = useState('')
	const [reference, setReference] = useState('')

	const choose = async (choice, dismiss) => {
		if (busy) return
		setBusy(choice)
		setError(null)
		try {
			await onChoose(choice, choice === 'waive' ? {} : { method: method || undefined, reference: reference.trim() || undefined })
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
						{/* the unpaid part in red, so it's what the eye lands on */}
						<span className="font-semibold text-black">{name ?? 'This member'}</span>{' '}
						<span className="font-semibold text-red">
							hasn’t paid their {schoolYear} dues{amount > 0 ? ` (${money(amount)})` : ''}
						</span>{ahead ? '.' : ', so they haven’t been checked in.'}
					</p>
					<p className={line}>
						{amount > 0 && <><b className="text-black">paid dues</b> marks them paid for the semester.{' '}</>}
						{price > 0 && <><b className="text-black">paid entry</b> takes the {money(price)} non-member price for this one.{' '}</>}
						<b className="text-black">waive</b> lets them in this once.{' '}
						{ahead
							? <>Checking them in won’t ask again.</>
							: <><b className="text-black">wait</b> leaves them not checked in while they pay.</>}
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

					{/* how it was paid, when it's money: both optional, and they
					    go in the ledger row's title */}
					{(amount > 0 || price > 0) && (
						<div className="
							mt-6
							grid
							grid-cols-2
							gap-3
						">
							<label className="min-w-0">
								<span className={OPTIONAL}>optional</span>
								<Dropdown
									value={method}
									onChange={(event) => setMethod(event.target.value)}
									aria-label="How they paid (optional)"
								>
									<option value="">payment platform</option>
									{[...methods, 'Cash'].map((title) => (
										<option key={title} value={title}>{title}</option>
									))}
								</Dropdown>
							</label>
							<label className="min-w-0">
								<span className={OPTIONAL}>optional</span>
								<input
									type="text"
									value={reference}
									onChange={(event) => setReference(event.target.value)}
									maxLength={80}
									placeholder="transaction id"
									aria-label="Transaction id (optional)"
									className={FIELD}
								/>
							</label>
						</div>
					)}

					{/* the ways they can pay on top, the two that let nothing
					    change hands underneath */}
					{(amount > 0 || price > 0) && (
						<div className="
							mt-3
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
							{ahead ? 'cancel' : 'wait'}
						</Choice>
					</div>
				</>
			)}
		</Popup>
	)
}
