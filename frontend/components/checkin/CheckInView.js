'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { canChange, keepsBooks } from '@/lib/roles'
import { useRole } from '@/lib/session'
import DashboardShell from '@/components/dashboards/DashboardShell'
import { BackButton, metaLine, useDesignZoom } from '@/components/labs/LabViewParts'
import QrScanner from '@/components/checkin/QrScanner'
import FitTitle from '@/components/FitTitle'
import { INSET, EditorButton, IconLabel, UploadIcon, fieldClass } from '@/components/labs/EditorParts'
import DateTimeField from '@/components/labs/DateTimeField'
import EmailAllPopup from '@/components/EmailAllPopup'
import ConfirmationPopup from '@/components/ConfirmationPopup'
import LastSent from '@/components/LastSent'
import DuesPopup from '@/components/checkin/DuesPopup'
import { PaymentDetails, ReviewButtons, ScreenshotCircle } from '@/components/payments/PaymentReview'
import { Popup, PopupButton, priceText } from '@/components/labs/LabViewParts'
import {
	labs as labsApi,
	events as eventsApi,
	members as membersApi,
	paymentMethods as methodsApi,
	payments as paymentsApi,
} from '@/lib/api'
import { prettyTime } from '@/lib/dates'
import { dueBody, dueInput, dueOk, usualDueText } from '@/lib/finances'

// The officer's check-in page for one lab or one event — where clicking its
// card on /labs or /events lands. Top: the camera for scanning members' QR
// codes beside the date line and title. Below: three columns.
//
//   not checked in   signed up and not here yet — tick checks them in by
//                    hand, x drops their spot (which goes to the waitlist),
//                    and $ settles what they owe before they're here
//   checked in       here — x undoes the check-in
//   waitlist         in the order they joined — the yellow button offers them
//                    a spot (they move up with a blue envelope, which emails
//                    them an "accept" link — src/offers.js), x takes them off,
//                    and manual add puts someone on by username
//
// Beside anyone's buttons, where they stand on dues (DuesMark): a gold crown
// when the year's are paid, a $ while the door would ask, grey once the entry's
// been paid or waived for this one — which the treasurer or admin can click to
// take back. Over the first column, "email unpaid" reminds everyone with a
// green $ to pay by the due date (a week before, 11:59 PM, unless the form set
// one); and the header's
// "payments" is where officers and up approve, send back or reject what
// members paid on their own (PaymentsPopup).
//
// Laid out in the design's pixels and zoomed to the window like the member
// lab pages (see Scaled in LabViewParts). The columns run to the bottom of the
// window, where the sidebar ends, and scroll inside themselves.

const API = { lab: labsApi, event: eventsApi }

// The header's four buttons: the grid cell's full width, and 18px either side
// of the label so the longest ones ("attendance csv", "upload prelab") have
// air around them rather than touching the edges.
const BUTTON = `
	w-full
	h-[32px]
	px-[18px]
`

// how often the lists are re-read, to catch sign-ups and other officers
const POLL_MS = 5_000

function fullName(row) {
	return [row.firstName, row.lastName].filter(Boolean).join(' ') || `@${row.username}`
}

const byName = (a, b) => fullName(a).localeCompare(fullName(b))

// when a lab or event starts, in local time — its date at its start time (the
// top of the day if it has none); null for a draft with no date
function startsAt(item) {
	const day = String(item.date ?? '').slice(0, 10)
	if (!day) return null
	const [y, m, d] = day.split('-').map(Number)
	const [h, min] = (item.startTime || '00:00').split(':').map(Number)
	return new Date(y, m - 1, d, h, min)
}


// ---- icons -----------------------------------------------------------------

function TickIcon({ className }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
			<path d="M7.5 12.3l3 3 6-6.3" />
		</svg>
	)
}

function CrossIcon({ className }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" className={className} aria-hidden="true">
			<path d="M8.3 8.3l7.4 7.4M15.7 8.3l-7.4 7.4" />
		</svg>
	)
}

function EnvelopeIcon({ className }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
			<rect x="4.5" y="6.5" width="15" height="11" rx="1.8" />
			<path d="M5 7.5l7 5.2 7-5.2" />
		</svg>
	)
}

// '3h ago', '2d ago' — for the envelope's tooltip
function ago(when) {
	const hours = Math.floor((Date.now() - new Date(when).getTime()) / 3_600_000)
	if (hours < 1) return 'just now'
	if (hours < 48) return `${hours}h ago`
	return `${Math.floor(hours / 24)}d ago`
}

// a person with a tick beside them — let them in
function AdmitIcon({ className }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
			<circle cx="10" cy="9" r="2.8" />
			<path d="M5 17.5c0-2.6 2.2-4.4 5-4.4 1 0 1.9.2 2.6.6" />
			<path d="M13.2 16l1.9 1.9 3.6-3.8" />
		</svg>
	)
}

function DollarIcon({ className }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
			<path d="M12 4.5v15" />
			<path d="M15.6 8.4c-.6-1.2-1.9-1.9-3.6-1.9-2.1 0-3.5 1.1-3.5 2.7 0 3.8 7.1 2.1 7.1 5.8 0 1.7-1.5 2.9-3.7 2.9-1.8 0-3.2-.8-3.8-2" />
		</svg>
	)
}

// gold, on nothing — it takes the $'s place once the year's dues are paid
function CrownIcon({ className }) {
	return (
		<svg viewBox="0 0 24 24" className={className} aria-hidden="true">
			<path
				d="M4.2 8.8l4.1 3.5L12 5.8l3.7 6.5 4.1-3.5-1.6 9.2H5.8z"
				fill="#F5C842"
				stroke="#B8860B"
				strokeWidth="1.3"
				strokeLinejoin="round"
			/>
			<path d="M5.8 20h12.4" stroke="#B8860B" strokeWidth="1.8" strokeLinecap="round" />
			<circle cx="4.2" cy="8.4" r="1.5" fill="#F5C842" stroke="#B8860B" strokeWidth="1" />
			<circle cx="12" cy="5" r="1.5" fill="#F5C842" stroke="#B8860B" strokeWidth="1" />
			<circle cx="19.8" cy="8.4" r="1.5" fill="#F5C842" stroke="#B8860B" strokeWidth="1" />
		</svg>
	)
}

function AddPersonIcon({ className }) {
	return (
		<svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
			<circle cx="9.5" cy="8" r="3.6" />
			<path d="M2.8 19.2c0-3.6 3-6 6.7-6s6.7 2.4 6.7 6c0 .5-.4.8-.8.8H3.6c-.4 0-.8-.3-.8-.8z" />
			<path d="M18.5 7.5v6M15.5 10.5h6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
		</svg>
	)
}

// ---- pieces ----------------------------------------------------------------

const TONES = {
	green: 'bg-green text-white',
	red: 'bg-red text-white',
	yellow: 'bg-[#EBD24A] text-white',
	// the envelope: solid until the offer's gone out, pale after
	blue: 'bg-blue text-white',
	'blue-sent': 'bg-blue-light text-blue-med',
	// the $: owed, and settled for this one
	dues: 'bg-green-dark text-white',
	'dues-done': 'bg-black/15 text-white',
}

function RowButton({ tone, label, onClick, disabled, children }) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			aria-label={label}
			title={label}
			className={`
				w-[22px]
				h-[22px]
				shrink-0
				rounded-full
				flex
				items-center
				justify-center
				cursor-pointer
				transition-[scale,filter]
				duration-150
				ease-out
				hover:scale-110
				hover:brightness-105
				active:scale-95
				disabled:opacity-50
				disabled:cursor-default
				${TONES[tone]}
			`}
		>
			{children}
		</button>
	)
}

// Where someone stands on dues for this one's school year (the roster's
// duesPaid / doorPayment / owesDues — src/routes/roster.js):
//
//   crown    the year's dues are paid — a VIP (or j-board who've paid)
//   $        the door would ask them — click it to settle it before they're
//            here (`onSettle`: the same dues popup a check-in opens)
//   grey $   the entry paid, or waived, for this one — the tick won't ask
//
// Nothing for staff, who never pay, nor where nobody's asked (an event open
// to everyone, or no dues or price set). The $ only on the not-checked-in
// column, where there's still a door to settle — `onSettle` says it's that one.
// `onUndo` (the treasurer's and admin's) makes the grey $ a button that takes
// the entry back.
function DuesMark({ row, onSettle, onUndo, disabled }) {
	const slot = `
		w-[22px]
		h-[22px]
		shrink-0
		flex
		items-center
		justify-center
	`
	if (row.duesPaid) {
		return (
			<span role="img" aria-label="Dues paid" title={`${fullName(row)}'s dues are paid for the year`} className={slot}>
				<CrownIcon className="w-[22px] h-[22px]" />
			</span>
		)
	}
	if (row.doorPayment) {
		const what = row.doorPayment === 'fee' ? 'Entry paid' : 'Entry waived'
		if (onUndo) {
			return (
				<RowButton tone="dues-done" label={`${what} for this one. Click to take it back`} onClick={onUndo} disabled={disabled}>
					<DollarIcon className="w-[15px] h-[15px]" />
				</RowButton>
			)
		}
		return (
			<span role="img" aria-label={what} title={`${what} for this one`} className={`${slot} rounded-full ${TONES['dues-done']}`}>
				<DollarIcon className="w-[15px] h-[15px]" />
			</span>
		)
	}
	if (row.owesDues && onSettle) {
		return (
			<RowButton tone="dues" label={`${fullName(row)} hasn't paid dues. Settle it now`} onClick={onSettle} disabled={disabled}>
				<DollarIcon className="w-[15px] h-[15px]" />
			</RowButton>
		)
	}
	return null
}

// `note` is a small line after the handle — where they are with confirming
function Person({ row, number, note = null }) {
	return (
		<div className="
			flex
			items-center
			min-w-0
		">
			{number != null && (
				<span className="
					w-[31.5px]
					shrink-0
					font-vietnam
					font-semibold
					text-[16px]
					leading-none
					text-black
				">
					{number}
				</span>
			)}
			<div className="min-w-0">
				<p className="
					font-vietnam
					text-[16px]
					leading-[20px]
					text-black
					truncate
				">
					{fullName(row)}
				</p>
				<p className="
					mt-[1.2px]
					font-vietnam
					text-[13px]
					leading-[16px]
					text-black
					truncate
				">
					@{row.username}
					{note}
				</p>
			</div>
		</div>
	)
}

// Where someone signed up stands with the "confirmation" round: confirmed,
// or asked and not yet — nothing until a round has gone out.
function ConfirmNote({ row }) {
	// sent a payment in that's waiting on the treasurer — the payments popup
	if (row.paymentPending && !row.duesPaid && !row.doorPayment) {
		return <span className="ml-1.5 text-[12px] font-semibold text-yellow-dark">· payment pending</span>
	}
	if (row.status !== 'rsvped') return null
	if (row.confirmedAt) {
		return <span className="ml-1.5 text-[12px] font-semibold text-green-dark">· confirmed</span>
	}
	// missed the deadline, but nobody's waiting for the spot so they keep it
	if (row.confirmMissed) {
		return <span className="ml-1.5 text-[12px] font-semibold text-salmon-dark">· missed</span>
	}
	if (row.confirmSentAt) {
		const by = row.confirmBy
			? ` by ${new Date(row.confirmBy).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
			: ''
		return <span className="ml-1.5 text-[12px] text-black/45">· waiting{by}</span>
	}
	return null
}

// One column: its name and count over the card, the card running to the
// bottom of the page with its list scrolling inside it. `action` sits between
// the two — "email unpaid", over the first.
function Column({ title, count, action = null, footer, children }) {
	return (
		<div className="
			flex
			flex-col
			min-h-0
		">
			<div className="
				flex
				items-baseline
				justify-between
				pl-[12px]
				pr-[5px]
				font-vietnam
				font-semibold
				text-[17px]
				leading-[22px]
				text-black
			">
				<h2>{title}</h2>
				<span className="
					flex
					items-baseline
					gap-3
				">
					{action}
					<span>{count}</span>
				</span>
			</div>
			<div className="
				mt-[6px]
				flex-1
				min-h-[260px]
				lg:min-h-0
				flex
				flex-col
				rounded-[10px]
				bg-cream
				shadow-[inset_0_0_10px_rgba(0,0,0,0.3)]
				overflow-hidden
			">
				<div className="
					flex-1
					min-h-0
					overflow-y-auto
					pt-[22px]
					pb-[12px]
					flex
					flex-col
					gap-[17.3px]
				">
					{children}
				</div>
				{footer}
			</div>
		</div>
	)
}

function Row({ children }) {
	return (
		<div className="
			flex
			items-center
			justify-between
			gap-3
			pr-[16.2px]
		">
			{children}
		</div>
	)
}

function Empty({ children }) {
	return (
		<p className="
			px-[18px]
			font-vietnam
			text-[14px]
			text-black/40
		">
			{children}
		</p>
	)
}

// The waitlist's footer: type a username (or pick one — the list is every
// member) and they go on the end of the waitlist.
function ManualAdd({ onAdd, people }) {
	const [value, setValue] = useState('')
	const [error, setError] = useState(null)
	const [busy, setBusy] = useState(false)

	const submit = async (event) => {
		event.preventDefault()
		const username = value.trim().replace(/^@/, '')
		if (!username || busy) return
		setBusy(true)
		setError(null)
		try {
			await onAdd(username)
			setValue('')
		} catch (err) {
			setError(err.message)
		} finally {
			setBusy(false)
		}
	}

	return (
		<form
			onSubmit={submit}
			className="
				shrink-0
				px-[21.8px]
				pb-[13.4px]
				pt-[6px]
			"
		>
			{error && (
				<p className="
					mb-[6px]
					font-vietnam
					text-[12px]
					leading-tight
					text-red
				">
					{error}
				</p>
			)}
			<div className="
				h-[34.5px]
				flex
				items-center
				rounded-full
				border
				border-[#ABA7A2]
				bg-white
				pl-[14px]
				pr-[4px]
			">
				<input
					type="text"
					value={value}
					onChange={(event) => setValue(event.target.value)}
					list="checkin-people"
					placeholder="manual add"
					aria-label="Add someone to the waitlist by username"
					autoComplete="off"
					className="
						flex-1
						min-w-0
						bg-transparent
						outline-none
						font-vietnam
						italic
						text-[16px]
						text-black
						placeholder:text-black/80
					"
				/>
				<datalist id="checkin-people">
					{people.map((person) => (
						<option key={person.userId} value={person.user.username}>
							{[person.user.firstName, person.user.lastName].filter(Boolean).join(' ')}
						</option>
					))}
				</datalist>
				<button
					type="submit"
					disabled={busy}
					aria-label="Add to waitlist"
					className={`
						w-[26px]
						h-[26px]
						shrink-0
						rounded-full
						flex
						items-center
						justify-center
						bg-cream
						text-black
						${INSET}
					`}
				>
					<AddPersonIcon className="w-[15px] h-[15px]" />
				</button>
			</div>
		</form>
	)
}

// The header's "payments", for officers and up: when payment for this one is
// due, at the top (PaymentDueSetting), then what members paid on their
// own for this one — the fee, or VIP dues sent from its page — waiting to be
// checked. Approving books it as income and settles it (their $ goes grey, or
// they turn VIP) and confirms their spot; "send back" asks why, and they have
// 48 hours to fix it; "reject" moves them to the waitlist. Each emails them.
//
// `readOnly` is the advisor's copy: all of it to see, none of it to settle.
// A lab's popup has a toggle over the list: "fee" (paying to come — the
// entry, or VIP dues) and "rental" (goggle rentals), each with its own count,
// approved, sent back or rejected the same way. An event's has no rentals.
const PAYMENT_TABS = [
	{ key: 'fee', label: 'fee', has: (payment) => payment.kind !== 'goggles' },
	{ key: 'rental', label: 'rental', has: (payment) => payment.kind === 'goggles' },
]

// The top of the payments popup: when payment for this one is due. Blank is
// the usual, a week before at 11:59 PM; a date and time picked in the calendar
// takes its place (paymentDueOverride — see paymentDue in src/payable.js), and
// anyone signed up and still owing with nothing sent in by then is moved to
// the waitlist. A day picked with no time is 11:59 PM that day (dueBody). Saved
// with its own button, so picking a day and then a time doesn't save twice.
// `item` is the lab or event as GET /:id has it; `onSaved` gets the new
// override.
function PaymentDueSetting({ kind, item, readOnly, onSaved }) {
	const saved = item.paymentDueOverride ? new Date(item.paymentDueOverride).toISOString() : null
	const [value, setValue] = useState(() => dueInput(item.paymentDueOverride))
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState(null)
	const day = String(item.date ?? '').slice(0, 10)
	const usual = usualDueText(day)
	const ok = dueOk(value, day, item.startTime ?? '')
	const dirty = dueBody(value) !== saved

	const save = async () => {
		if (!ok || !dirty || busy) return
		setBusy(true)
		setError(null)
		try {
			const reply = await API[kind].update(item[kind === 'lab' ? 'labId' : 'eventId'], { paymentDueOverride: dueBody(value) })
			onSaved(reply.paymentDueOverride ?? null)
		} catch (err) {
			setError(err.message)
		} finally {
			setBusy(false)
		}
	}

	return (
		<div className="
			mt-5
			flex
			flex-col
			items-center
			text-center
			rounded-[14px]
			bg-black/[0.04]
			px-4
			py-4
		">
			<label
				htmlFor="payment-due"
				className="
					font-vietnam
					text-[11px]
					uppercase
					tracking-[0.12em]
					text-black/50
				"
			>
				payment due
			</label>
			<div className="
				mt-2
				flex
				items-center
				justify-center
				gap-3
			">
				<div className="w-[250px]">
					{readOnly ? (
						<p className="
							font-vietnam
							font-semibold
							text-[15px]
							text-black
						">
							{value ? new Date(dueBody(value)).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : usual ?? 'a week before, 11:59 PM'}
						</p>
					) : (
						<DateTimeField
							id="payment-due"
							value={value}
							onChange={(next) => {
								setValue(next)
								setError(null)
							}}
							zoom={1}
							className={`
								${fieldClass('orange', !ok)}
								h-[36px]
								px-[10px]
								text-[14px]
								${value ? '' : 'text-black/40'}
							`}
						/>
					)}
				</div>
				{!readOnly && dirty && (
					<PopupButton primary onClick={save} disabled={!ok || busy}>
						{busy ? 'saving…' : 'save'}
					</PopupButton>
				)}
			</div>
			<p className="
				mt-2
				font-vietnam
				text-[12px]
				text-black/50
			">
				{error
					? <span className="text-red">{error}</span>
					: !ok
						? <span className="text-red">Has to be before it starts</span>
						: value
							? (
								<>
									Anyone still owing by then moves to the waitlist.{' '}
									{!readOnly && (
										<button
											type="button"
											onClick={() => setValue('')}
											className="
												underline
												underline-offset-2
												cursor-pointer
												hover:text-black
											"
										>
											use the usual{usual ? ` (${usual})` : ''}
										</button>
									)}
								</>
							)
							: `The usual: a week before${usual ? `, ${usual}` : ', 11:59 PM'}. Pick a date to change it.`}
			</p>
		</div>
	)
}

function PaymentsPopup({ kind, item, title, payments: all, rentals = false, readOnly, onChange, onDueSaved, onClose }) {
	const [tab, setTab] = useState('fee')
	const payments = rentals ? all.filter(PAYMENT_TABS.find((one) => one.key === tab).has) : all
	// only a lab or a members-only event takes payment, so only they have a
	// due date to set
	const takesPayment = kind === 'lab' || item?.track === 'members'
	return (
		<Popup title="payments" onClose={onClose} width="max-w-[620px]">
			{() => (
				<>
					{takesPayment && <PaymentDueSetting kind={kind} item={item} readOnly={readOnly} onSaved={onDueSaved} />}

					<p className="
						mt-4
						font-vietnam
						text-sm
						text-black/60
					">
						What members say they paid for {title}. Check it’s in the account before you approve it.
					</p>

					{rentals && (
						<div
							role="tablist"
							aria-label="Which payments"
							className="
								mt-4
								inline-flex
								rounded-full
								bg-black/5
								p-1
							"
						>
							{PAYMENT_TABS.map((one) => {
								const on = tab === one.key
								const count = all.filter(one.has).length
								return (
									<button
										key={one.key}
										type="button"
										role="tab"
										aria-selected={on}
										onClick={() => setTab(one.key)}
										className={`
											rounded-full
											px-4
											py-1.5
											font-vietnam
											font-semibold
											text-[13px]
											cursor-pointer
											transition-colors
											duration-150
											${on ? 'bg-black text-cream' : 'text-black/60 hover:text-black'}
										`}
									>
										{one.label}{count > 0 ? ` · ${count}` : ''}
									</button>
								)
							})}
						</div>
					)}

					{payments.length === 0 ? (
						<p className="
							mt-6
							font-vietnam
							text-sm
							text-black/40
						">
							nothing waiting
						</p>
					) : (
						<ul className="
							mt-5
							divide-y
							divide-black/10
						">
							{payments.map((payment) => (
								<li
									key={payment.paymentId}
									className="
										flex
										flex-wrap
										items-start
										justify-between
										gap-3
										py-3
									"
								>
									<div className="
										min-w-0
										flex
										items-center
										gap-3
									">
										<ScreenshotCircle src={payment.screenshot} who={fullName(payment)} blank />
										<div className="min-w-0">
											<p className="
												font-vietnam
												font-semibold
												text-sm
												text-black
											">
												{fullName(payment)} <span className="font-normal text-black/45">@{payment.username}</span>
											</p>
											<div className="mt-1">
												<PaymentDetails payment={payment} />
											</div>
										</div>
									</div>
									<ReviewButtons payment={payment} onDone={onChange} readOnly={readOnly} />
								</li>
							))}
						</ul>
					)}
				</>
			)}
		</Popup>
	)
}

// ---- page ------------------------------------------------------------------

export default function CheckInView({ kind, id }) {
	const api = API[kind]
	// The advisor sees the door as it stands — who's signed up, who's in, the
	// waitlist — and can email everyone or download the attendance, but runs
	// none of it: no camera, no ticks or crosses, no confirmations or prelab.
	const role = useRole()
	const changes = canChange(role)
	// the treasurer and admin: payments to approve, and the grey $ to undo
	const books = keepsBooks(role)
	const zoom = useDesignZoom()
	// the accepted payments' names, for the dues popup's "paid how?"
	const [methods, setMethods] = useState([])
	// what members sent in for this one, waiting — the header's "payments"
	const [waitingPayments, setWaitingPayments] = useState([])
	const [showPayments, setShowPayments] = useState(false)
	// the grey $ being taken back, while it's asked about
	const [undoing, setUndoing] = useState(null)
	// "email unpaid": asked, then the answer
	const [reminding, setReminding] = useState(false)
	const [notice, setNotice] = useState(null)
	const [emailing, setEmailing] = useState(false)
	const [confirming, setConfirming] = useState(false)
	// when the three emails last went out — the line at the bottom of each
	// popup (LastSent). undefined until it's read; re-read after each send.
	const [lastSent, setLastSent] = useState(undefined)
	const readLastSent = () => api.lastSent(id).then(setLastSent).catch(() => {})
	useEffect(() => {
		let live = true
		api.lastSent(id).then((reply) => live && setLastSent(reply)).catch(() => {})
		return () => { live = false }
	}, [api, id])
	const [exporting, setExporting] = useState(false)
	// the prelab upload: busy while it goes up, and what went wrong if it didn't
	const [prelabBusy, setPrelabBusy] = useState(false)
	const prelabInput = useRef(null)
	const [item, setItem] = useState(null)
	const [roster, setRoster] = useState([])
	const [people, setPeople] = useState([])
	const [error, setError] = useState(null)
	// member ids with a request out, so a button can't be hit twice
	const [busy, setBusy] = useState(() => new Set())
	// a check-in (scanned or ticked) that came back DUES_UNPAID, waiting on
	// the officer's answer: { reply, answer(choice), close() } — see DuesPopup
	const [duesAsk, setDuesAsk] = useState(null)
	// "start check-in" on its way to the server
	const [opening, setOpening] = useState(false)

	const loadRoster = useCallback(async () => {
		try {
			const rows = await api.roster(id)
			setRoster(rows)
			return rows
		} catch (err) {
			setError(err.message)
			return null
		}
	}, [api, id])

	const loadPayments = useCallback(async () => {
		const place = kind === 'lab' ? { labId: id } : { eventId: id }
		try {
			setWaitingPayments(await paymentsApi.list({ ...place, status: 'pending' }))
		} catch {}
	}, [kind, id])

	useEffect(() => {
		if (!id) return
		let live = true
		methodsApi.list()
			.then((rows) => live && setMethods(rows.map((method) => method.title)))
			.catch(() => {})
		api.get(id)
			.then((row) => live && setItem(row))
			.catch((err) => live && setError(err.message))
		api.roster(id)
			.then((rows) => live && setRoster(rows))
			.catch((err) => live && setError(err.message))
		membersApi.list()
			.then((rows) => live && setPeople(rows))
			.catch(() => {})
		const timer = setInterval(() => {
			api.roster(id).then((rows) => live && setRoster(rows)).catch(() => {})
		}, POLL_MS)
		return () => {
			live = false
			clearInterval(timer)
		}
	}, [api, id])

	// the payments too, on the roster's beat
	useEffect(() => {
		if (!id) return
		let live = true
		const place = kind === 'lab' ? { labId: id } : { eventId: id }
		const read = () => paymentsApi.list({ ...place, status: 'pending' })
			.then((waiting) => live && setWaitingPayments(waiting))
			.catch(() => {})
		read()
		const timer = setInterval(read, POLL_MS)
		return () => {
			live = false
			clearInterval(timer)
		}
	}, [kind, id])

	// "start check-in" / "close check-in": before the start time, whether the
	// people signed up get their QR code on its page yet (members' pages read
	// checkinOpen; roster.js). From the start time it's open regardless, so
	// the button only shows before then — the roster poll re-renders the page
	// often enough to drop it on time.
	const start = item ? startsAt(item) : null
	const now = new Date()
	const early = Boolean(start) && start > now
	// past the start time on the day itself: open on its own, which the page
	// says where the button was, so it isn't missed
	const openNow = Boolean(start) && !early && start.toDateString() === now.toDateString()
	const setDoor = async (open) => {
		setOpening(true)
		setError(null)
		try {
			const reply = await api.setCheckinOpen(id, open)
			setItem((prev) => ({ ...prev, checkinOpen: reply.checkinOpen }))
		} catch (err) {
			setError(err.message)
		} finally {
			setOpening(false)
		}
	}

	const act = async (memberId, action) => {
		setBusy((prev) => new Set(prev).add(memberId))
		setError(null)
		try {
			const reply = await api.rosterAction(id, { memberId, action })
			// the green tick on someone who owes dues: ask first, and send
			// the tick again with the answer
			// (the $ asks the same, without checking them in)
			if (reply?.code === 'DUES_UNPAID') {
				setDuesAsk({
					reply,
					ahead: action === 'dues',
					answer: async (dues, paidBy = {}) => {
						await api.rosterAction(id, { memberId, action, dues, ...paidBy })
						await loadRoster()
					},
					close: () => {},
				})
			}
			await loadRoster()
		} catch (err) {
			setError(err.message)
		} finally {
			setBusy((prev) => {
				const next = new Set(prev)
				next.delete(memberId)
				return next
			})
		}
	}

	const add = async (username) => {
		await api.rosterAction(id, { action: 'add', username })
		await loadRoster()
	}

	// A check-in reply as the scanner's flash, once the lists are re-read.
	const flashFor = async (reply, who) => {
		const rows = await loadRoster()
		const row = rows?.find((r) => r.memberId === who)
		const name = row ? fullName(row) : 'member'
		const tone = { CHECKED_IN: 'green', ALREADY_CHECKED_IN: 'green', WAITLISTED: 'yellow', ALREADY_WAITLISTED: 'yellow' }[reply.code] ?? 'green'
		const text = {
			CHECKED_IN: `${name} checked in`,
			ALREADY_CHECKED_IN: `${name} is already checked in`,
			WAITLISTED: `${name} wasn't signed up, so they were added to the waitlist`,
			ALREADY_WAITLISTED: `${name} is on the waitlist`,
		}[reply.code] ?? reply.message
		return { tone, text }
	}

	// What the camera found: check it in, re-read the lists, and say who it
	// was. The code is the member's signed id; its payload is readable here,
	// which is enough to put a name to the result.
	//
	// Someone who owes dues isn't checked in yet: the dues popup opens, and
	// this doesn't resolve until it's answered — the scanner holds off reading
	// more codes until then.
	const scanned = async (token) => {
		let who = null
		try {
			const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
			who = payload.id
		} catch {}

		const reply = await api.checkin(id, token)
		if (reply.code === 'DUES_UNPAID') {
			return new Promise((resolve) => setDuesAsk({
				reply,
				// paid / fee / waive: scan them again with the answer
				answer: async (dues, paidBy) => resolve(await flashFor(await api.checkin(id, token, dues, paidBy), reply.memberId)),
				// wait (or the popup closing after an answer, when this does nothing)
				// red, like the popup's own "hasn't paid" — they still owe
				close: () => resolve({ tone: 'red', text: `${reply.name ?? 'member'} not checked in: dues unpaid` }),
			}))
		}
		return flashFor(reply, who)
	}

	const { waiting, here, waitlist } = useMemo(() => ({
		// open offers first — they're the ones waiting on an officer or an answer
		waiting: roster
			.filter((r) => r.status === 'rsvped' || r.status === 'absent' || r.status === 'offered')
			.sort((a, b) => (b.status === 'offered') - (a.status === 'offered') || byName(a, b)),
		here: roster.filter((r) => r.status === 'attended').sort(byName),
		waitlist: roster
			.filter((r) => r.status === 'waitlisted')
			.sort((a, b) => new Date(a.waitlistedAt) - new Date(b.waitlistedAt)),
	}), [roster])

	// "email all": everyone with a confirmed spot (both "not checked in" and
	// "checked in" — not the waitlist, and not an offer nobody's accepted yet)
	// who hasn't turned lab & event emails off (the roster leaves their address
	// out). The server works out the same list when it sends.
	const recipients = [...waiting, ...here]
		.filter((row) => row.status !== 'offered')
		.map((row) => row.email)
		.filter(Boolean)

	// who "email unpaid" would email: a green $ and nothing sent in
	const unpaid = waiting.filter((row) =>
		(row.status === 'rsvped' || row.status === 'offered') && row.owesDues && !row.paymentPending).length

	const remind = async () => {
		setError(null)
		setNotice(null)
		try {
			const reply = await api.remindUnpaid(id)
			setNotice(reply.message)
			readLastSent()
		} catch (err) {
			setError(err.message)
		}
	}

	const undoEntry = async (row) => {
		await act(row.memberId, 'undo-dues')
		setNotice(`${fullName(row)} is unpaid again, and they’ve been emailed`)
	}

	// who "confirmation" would email: signed up and not confirmed yet
	const unconfirmed = waiting.filter((row) => row.status === 'rsvped' && !row.confirmedAt).length

	const uploadPrelab = async (event) => {
		const file = event.target.files?.[0]
		event.target.value = ''
		if (!file) return
		if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
			setError('The prelab has to be a PDF')
			return
		}
		setPrelabBusy(true)
		setError(null)
		try {
			const reply = await api.uploadPrelab(id, file)
			setItem((prev) => ({ ...prev, prelabPdfName: reply.prelabPdfName }))
		} catch (err) {
			setError(err.message)
		} finally {
			setPrelabBusy(false)
		}
	}

	const removePrelab = async () => {
		setError(null)
		try {
			await api.removePrelab(id)
			setItem((prev) => ({ ...prev, prelabPdfName: null }))
		} catch (err) {
			setError(err.message)
		}
	}

	// the file opens in a new tab, fetched with the officer's login
	const viewPrelab = async () => {
		const tab = window.open('', '_blank')
		try {
			const url = await api.prelabUrl(id)
			if (tab) tab.location.href = url
			setTimeout(() => URL.revokeObjectURL(url), 60_000)
		} catch (err) {
			tab?.close()
			setError(err.message)
		}
	}

	const exportAttendance = async () => {
		setExporting(true)
		setError(null)
		try {
			await api.exportAttendance(id)
		} catch (err) {
			setError(err.message)
		} finally {
			setExporting(false)
		}
	}

	const back = kind === 'lab'
		? { href: '/labs', label: 'Back to labs' }
		: { href: '/events', label: 'Back to events' }

	return (
		<DashboardShell className="
			lg:-mt-8
			lg:-mb-8
			lg:-mr-8
			lg:py-8
			lg:pr-8
		">
			<BackButton {...back} />

			<div
				className="
					lg:h-full
					flex
					flex-col
				"
				// --design-zoom is for the columns' spacing below, which is
				// measured on the screen rather than in the design's pixels
				style={{ zoom, '--design-zoom': zoom }}
			>
				{/* ---- camera + header ----------------------------------------
				    No padding over it: the scanner's top edge lines up with the
				    sidebar's (the page column already starts level with it), and
				    the lists under it take the room, the gap between the two
				    staying as it is. */}
				<div className="
					shrink-0
					flex
					flex-col
					lg:flex-row
					items-center
					lg:items-start
					justify-center
					gap-6
					lg:gap-[33.8px]
				">
					{changes && <QrScanner onScan={scanned} />}

					<div className="
						w-full
						lg:w-[366px]
						lg:pt-[16.9px]
						text-center
						lg:text-left
					">
						{item && (
							<>
								<p className="
									font-vietnam
									font-semibold
									text-[15px]
									leading-[22px]
									text-black
								">
									{metaLine(item)}
								</p>
								<FitTitle
									text={item.title}
									className="
										mt-[3.3px]
										font-beachday
										text-[40px]
										sm:text-[54px]
										leading-[1.2]
										sm:leading-[1.207]
										text-salmon
										break-words
									"
								/>
								{/* the page's four buttons, two by two. The columns are
								    equal, each as wide as the widest label plus its
								    padding, so none of them is squeezed to its text. An
								    event has no prelab, so its fourth cell stays empty.
								    Before the start time, "start check-in" runs the full
								    width under them. */}
								<div className="
									mt-[14px]
									mx-auto
									lg:mx-0
									w-fit
									grid
									grid-cols-2
									gap-[10px]
								">
									<EditorButton
										className={BUTTON}
										disabled={recipients.length === 0}
										title={recipients.length === 0 ? 'Nobody has signed up yet' : `Email ${recipients.length} ${recipients.length === 1 ? 'person' : 'people'}`}
										onClick={() => setEmailing(true)}
									>
										email all
									</EditorButton>
									{/* asks everyone signed up to confirm their spot, with the
									    prelab attached (src/offers.js) */}
									{changes && (
										<EditorButton
											className={BUTTON}
											title={`Ask ${unconfirmed} ${unconfirmed === 1 ? 'person' : 'people'} to confirm their spot`}
											onClick={() => setConfirming(true)}
										>
											confirmation
										</EditorButton>
									)}
									{/* everyone on the list as a spreadsheet — who came, who
									    didn't — for the reports the university asks for */}
									<EditorButton
										className={BUTTON}
										disabled={roster.length === 0 || exporting}
										title={roster.length === 0 ? 'Nobody on the list yet' : 'Download the attendance as a CSV'}
										onClick={exportAttendance}
									>
										{exporting ? 'saving…' : 'attendance csv'}
									</EditorButton>
									{kind === 'lab' && changes && (
										<EditorButton
											className={BUTTON}
											disabled={prelabBusy}
											onClick={() => prelabInput.current?.click()}
										>
											<IconLabel icon={<UploadIcon className="w-[17px] h-[17px]" />}>
												{prelabBusy ? 'uploading…' : item.prelabPdfName ? 'replace prelab' : 'upload prelab'}
											</IconLabel>
										</EditorButton>
									)}
									{/* what members paid on their own, to approve or send
									    back — lit up while anything's waiting */}
									<EditorButton
										className={`
											${BUTTON}
											${kind === 'lab' ? 'col-span-2' : ''}
											${waitingPayments.length ? 'bg-yellow-light!' : ''}
										`}
										title="Payments members sent in for this one, waiting to be checked"
										onClick={() => setShowPayments(true)}
									>
										{`payments${waitingPayments.length ? ` · ${waitingPayments.length}` : ''}`}
									</EditorButton>
									{early && changes && (
										<EditorButton
											className={`
												${BUTTON}
												col-span-2
												${item.checkinOpen ? '' : 'bg-green!'}
											`}
											disabled={opening}
											title={item.checkinOpen
												? 'Hide the QR codes again until the start time'
												: 'Let people signed up show their QR code now, before the start time'}
											onClick={() => setDoor(!item.checkinOpen)}
										>
											{opening ? 'saving…' : item.checkinOpen ? 'close check-in' : 'start check-in'}
										</EditorButton>
									)}
								</div>
								{((early && item.checkinOpen) || openNow) && (
									<p className="
										mt-[8px]
										font-vietnam
										text-[12px]
										text-green-dark
									">
										{openNow
											? `check-in opened at ${prettyTime(item.startTime || '00:00').replace(' ', '').toLowerCase()}, and people signed up can show their QR code`
											: 'check-in is open, and people signed up can show their QR code now'}
									</p>
								)}
								{kind === 'lab' && (
									<>
										<input
											ref={prelabInput}
											type="file"
											accept="application/pdf,.pdf"
											onChange={uploadPrelab}
											className="hidden"
										/>
										{item.prelabPdfName && (
											<p className="
												mt-[8px]
												mx-auto
												lg:mx-0
												max-w-[300px]
												font-vietnam
												text-[12px]
												text-black/55
												truncate
											">
												<button
													type="button"
													onClick={viewPrelab}
													className="underline underline-offset-2 cursor-pointer hover:text-black"
												>
													{item.prelabPdfName}
												</button>
												{changes && (
													<>
														{' · '}
														<button
															type="button"
															onClick={removePrelab}
															className="cursor-pointer hover:text-salmon-dark"
														>
															remove
														</button>
													</>
												)}
											</p>
										)}
									</>
								)}
							</>
						)}
						{error && (
							<p className="
								mt-2
								font-vietnam
								text-[13px]
								text-salmon-dark
							">
								{error}
							</p>
						)}
						{notice && !error && (
							<p className="
								mt-2
								font-vietnam
								text-[13px]
								text-green-dark
							">
								{notice}
							</p>
						)}
					</div>
				</div>

				{/* ---- the three lists ----------------------------------------
				    Beside the sidebar they fill the page, three equal columns
				    with the same 32px on the screen everywhere: from the
				    sidebar to the first, between each, and from the last to the
				    window's edge — the sidebar's own margin. The page column
				    already sits 24px off the sidebar and 32px in from the
				    window, so the list takes 8px more on the left and none on
				    the right. Dividing by the zoom keeps those screen pixels
				    rather than design ones, which the zoom would scale. */}
				<div className="
					mt-8
					lg:mt-[24px]
					flex-1
					min-h-0
					w-full
					grid
					grid-cols-1
					md:grid-cols-3
					gap-y-8
					gap-x-[24px]
					lg:gap-x-[calc(32px/var(--design-zoom))]
					lg:pl-[calc(8px/var(--design-zoom))]
				">
					<Column
						title="not checked in"
						count={waiting.length}
						action={changes && (
							<button
								type="button"
								onClick={() => setReminding(true)}
								disabled={unpaid === 0}
								title={unpaid === 0
									? 'Nobody with a green $. Everyone’s paid or sent a payment in'
									: `Email the ${unpaid} with a green $ to pay before the day`}
								className="
									rounded-full
									border
									border-black/60
									px-[10px]
									py-[2px]
									font-vietnam
									font-semibold
									text-[11px]
									leading-[16px]
									text-black
									cursor-pointer
									transition-colors
									hover:bg-black
									hover:text-cream
									disabled:opacity-35
									disabled:cursor-default
									disabled:hover:bg-transparent
									disabled:hover:text-black
								"
							>
								email unpaid{unpaid ? ` · ${unpaid}` : ''}
							</button>
						)}
					>
						{waiting.length === 0 && <Empty>nobody waiting to check in</Empty>}
						{waiting.map((row) => (
							<Row key={row.memberId}>
								{row.status === 'offered' ? (
									// off the waitlist, spot held until they accept: the
									// envelope emails them the offer (again, once sent)
									<div className="
										pl-[8px]
										min-w-0
										flex
										items-center
										gap-[8px]
									">
										{changes && <RowButton
											tone={row.offerSentAt ? 'blue-sent' : 'blue'}
											label={row.offerSentAt
												? `Offer sent to ${fullName(row)} ${ago(row.offerSentAt)}. Send again`
												: `Email ${fullName(row)} their offer`}
											onClick={() => act(row.memberId, 'offer')}
											disabled={busy.has(row.memberId)}
										>
											<EnvelopeIcon className="w-[16px] h-[16px]" />
										</RowButton>}
										<Person row={row} />
									</div>
								) : (
									<div className="pl-[18px] min-w-0">
										<Person row={row} note={<ConfirmNote row={row} />} />
									</div>
								)}
								<div className="
									flex
									gap-[15.5px]
								">
									<DuesMark
										row={row}
										onSettle={changes ? () => act(row.memberId, 'dues') : undefined}
										onUndo={books ? () => setUndoing(row) : undefined}
										disabled={busy.has(row.memberId)}
									/>
									{changes && <>
										<RowButton
											tone="green"
											label={`Check in ${fullName(row)}`}
											onClick={() => act(row.memberId, 'checkin')}
											disabled={busy.has(row.memberId)}
										>
											<TickIcon className="w-[20px] h-[20px]" />
										</RowButton>
										<RowButton
											tone="red"
											label={`Remove ${fullName(row)}`}
											onClick={() => act(row.memberId, 'remove')}
											disabled={busy.has(row.memberId)}
										>
											<CrossIcon className="w-[20px] h-[20px]" />
										</RowButton>
									</>}
								</div>
							</Row>
						))}
					</Column>

					<Column title="checked in" count={here.length}>
						{here.length === 0 && <Empty>nobody checked in yet</Empty>}
						{here.map((row) => (
							<Row key={row.memberId}>
								<div className="pl-[18px] min-w-0">
									<Person row={row} />
								</div>
								<div className="
									flex
									gap-[15.5px]
								">
									<DuesMark
										row={row}
										onUndo={books ? () => setUndoing(row) : undefined}
										disabled={busy.has(row.memberId)}
									/>
									{changes && <RowButton
										tone="red"
										label={`Undo ${fullName(row)}'s check-in`}
										onClick={() => act(row.memberId, 'uncheck')}
										disabled={busy.has(row.memberId)}
									>
										<CrossIcon className="w-[20px] h-[20px]" />
									</RowButton>}
								</div>
							</Row>
						))}
					</Column>

					<Column
						title="waitlist"
						count={waitlist.length}
						footer={changes ? <ManualAdd onAdd={add} people={people} /> : null}
					>
						{waitlist.length === 0 && <Empty>nobody on the waitlist</Empty>}
						{waitlist.map((row, i) => (
							<Row key={row.memberId}>
								<div className="pl-[27.5px] min-w-0">
									<Person row={row} number={i + 1} />
								</div>
								<div className="
									flex
									gap-[10px]
								">
									<DuesMark row={row} />
									{changes && <>
										<RowButton
											tone="yellow"
											label={`Offer ${fullName(row)} a spot`}
											onClick={() => act(row.memberId, 'admit')}
											disabled={busy.has(row.memberId)}
										>
											<AdmitIcon className="w-[18px] h-[18px]" />
										</RowButton>
										<RowButton
											tone="red"
											label={`Take ${fullName(row)} off the waitlist`}
											onClick={() => act(row.memberId, 'remove')}
											disabled={busy.has(row.memberId)}
										>
											<CrossIcon className="w-[20px] h-[20px]" />
										</RowButton>
									</>}
								</div>
							</Row>
						))}
					</Column>
				</div>
			</div>
			{duesAsk && (
				<DuesPopup
					name={duesAsk.reply.name}
					schoolYear={duesAsk.reply.schoolYear}
					amount={duesAsk.reply.amount}
					price={duesAsk.reply.price}
					onChoose={duesAsk.answer}
					ahead={duesAsk.ahead}
					methods={methods}
					onClose={() => {
						duesAsk.close()
						setDuesAsk(null)
					}}
				/>
			)}
			{showPayments && item && (
				<PaymentsPopup
					kind={kind}
					item={item}
					onDueSaved={(paymentDueOverride) => setItem((prev) => ({ ...prev, paymentDueOverride }))}
					title={item.title}
					payments={waitingPayments}
					rentals={kind === 'lab'}
					readOnly={!changes}
					onChange={async () => {
						await loadPayments()
						await loadRoster()
					}}
					onClose={() => setShowPayments(false)}
				/>
			)}
			{undoing && (
				<Popup title="take it back?" onClose={() => setUndoing(null)}>
					{(dismiss) => (
						<>
							<p className="
								mt-3
								font-vietnam
								text-sm
								text-black/70
							">
								{undoing.doorPayment === 'fee'
									? <>{fullName(undoing)}’s entry payment comes out of the income in analytics, their $ turns green again, and they’re emailed to disregard the approval. They’re unpaid again.</>
									: <>{fullName(undoing)}’s waiver is taken back, their $ turns green again, and they’re emailed that they’re unpaid.</>}
							</p>
							<div className="
								mt-8
								flex
								justify-end
								gap-3
							">
								<PopupButton onClick={() => dismiss(() => setUndoing(null))}>keep it</PopupButton>
								<PopupButton danger onClick={() => dismiss(() => {
									const row = undoing
									setUndoing(null)
									undoEntry(row)
								})}>
									take it back
								</PopupButton>
							</div>
						</>
					)}
				</Popup>
			)}
			{reminding && item && (
				<Popup title="email unpaid" onClose={() => setReminding(false)}>
					{(dismiss) => (
						<>
							<p className="
								mt-3
								font-vietnam
								text-sm
								text-black/70
							">
								{`The ${unpaid} ${unpaid === 1 ? 'person' : 'people'} with a green $ get a reminder to pay`}
								{item.nonmemberPrice > 0 ? ` the ${priceText(item.nonmemberPrice)} entry` : ''}
								{' '}(or their VIP dues) by {item.title}’s payment due date, or they’ll be moved to the waitlist. Every accepted payment’s QR code is attached.
							</p>
							<div className="
								mt-8
								flex
								justify-end
								gap-3
							">
								<PopupButton onClick={() => dismiss(() => setReminding(false))}>cancel</PopupButton>
								<PopupButton primary onClick={() => dismiss(() => {
									setReminding(false)
									remind()
								})}>
									send them
								</PopupButton>
							</div>
							<LastSent last={lastSent?.unpaid_reminder} />
						</>
					)}
				</Popup>
			)}
			{confirming && item && (
				<ConfirmationPopup
					count={unconfirmed}
					what={item.title}
					prelab={kind === 'lab' ? item.prelabPdfName : null}
					startsAt={startsAt(item)}
					lastSent={lastSent?.confirmation}
					onSend={async (deadline) => {
						const reply = await api.confirmAll(id, deadline)
						await loadRoster()
						readLastSent()
						return reply
					}}
					onClose={() => setConfirming(false)}
				/>
			)}
			{emailing && item && (
				<EmailAllPopup
					count={recipients.length}
					who={`everyone signed up for ${item.title}`}
					defaultSubject={item.title}
					addresses={recipients}
					lastSent={lastSent?.email_all}
					onSend={async (message) => {
						const reply = await api.emailAll(id, message)
						readLastSent()
						return reply
					}}
					onClose={() => setEmailing(false)}
				/>
			)}
		</DashboardShell>
	)
}
