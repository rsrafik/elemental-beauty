'use client'

import { useContext, useEffect, useRef, useState } from 'react'
import { payments as paymentsApi } from '@/lib/api'
import { useSession } from '@/lib/session'
import { RECEIPT_MAX, shrinkImage } from '@/lib/images'
import { FitScroll } from '@/components/labs/LabViewParts'

// Paying the club before you come, for a member who hasn't paid the year's
// dues — under the "you're registered" button on a lab's or a members-only
// event's page, and the whole of /vip. The QR codes of the accepted payments
// (the treasurer keeps them on /analytics) in a row; under them, how you paid,
// the transaction id your app gave you, and what it was for — the entry for
// this one, or VIP dues for the year; an optional screenshot; send. Every
// field but the screenshot has to be filled in. See src/routes/paymentRoutes.js.
//
// Then it says where that payment stands: waiting to be looked at (with
// "edit", to fix a typo before anyone checks it), approved, sent back (with
// why — and the form again, to fix it), or taken back.
//
// The "what was it for" dropdown always has the entry for this one — "lab
// fee" or "event fee" — beside VIP dues; greyed out when this one has no
// price.
//
//   place     { labId } / { eventId } on its page, {} on /vip
//   noun      'lab' / 'event', for "lab fee"
//   duesOnly  /vip: VIP dues and nothing else, so no "what was it" dropdown
//   hideDue   the due date's said above it already (PayToHold's card)
//   notice    a card to set over it, at its width (PayToHold)
//
// On a wide screen the card widens to fit every QR code in one row beside the
// form (see `wide`). Past what the page has room for they wrap into a grid,
// the card grows taller, and the page scrolls rather than shrinking to fit
// (FitScroll, in LabViewParts).
//
// On a lab's page there's a second card on its right (under it, narrower):
// renting goggles (GoggleCard) — for anyone signed up, VIP and staff too, so
// it's there even when there's nothing else to pay.
//
// Draws nothing for someone with nothing to pay here — paid up, staff, or a
// lab with no price and no dues set — and no goggles to rent.

const money = (amount) => Number(amount).toLocaleString('en-US', {
	style: 'currency',
	currency: 'USD',
	minimumFractionDigits: Number.isInteger(Number(amount)) ? 0 : 2,
})
const sentOn = (at) => new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

const FIELD = `
	w-full
	min-w-0
	h-[40px]
	rounded-[10px]
	border
	border-black/25
	bg-white
	px-3
	font-vietnam
	text-[14px]
	text-black
	outline-none
	transition-colors
	focus:border-black
`

// A select with its chevron drawn rather than the browser's: the native one
// sits hard against the right edge, this one is inset by the same 12px as the
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
					right-3
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

const label = (choice, noun) => choice.kind === 'dues'
	? `VIP dues · ${money(choice.amount)}`
	: `${noun} fee · ${money(choice.amount)}`

// How the newest payment they've sent stands, in a line
// 'Friday, October 22 at 11:59 PM'
const dueText = (at) => new Date(at).toLocaleString('en-US', {
	weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
})


// On /vip (`duesOnly`), a sent-back dues payment has as long to be fixed as
// `nextDue` gives (the API's: the soonest lab or event their dues are due
// for), and no deadline without one — whichever page it was first sent from.
// On a lab's or event's page it's that one's 48 hours. Either way it names
// whose waitlist they'd be moved to.
function Status({ payment, noun, duesOnly = false, nextDue = null }) {
	const goggles = payment.kind === 'goggles'
	const what = payment.kind === 'dues' ? 'VIP dues' : goggles ? 'goggle rental' : `${noun} fee`
	const tones = {
		pending: 'bg-yellow-light/60 text-[#8A7500]',
		approved: 'bg-green/40 text-[#295212]',
		rejected: 'bg-red/10 text-red',
		declined: 'bg-red/10 text-red',
		reversed: 'bg-red/10 text-red',
	}
	// /vip: a sent-back one's deadline, and what missing it costs — the date in
	// bold — off the soonest lab or event their dues are for. A lab's or
	// event's page leaves it to the card over this one (PayToHold), which
	// already says when it's due now.
	const by = (at) => <> by <b className="font-extrabold">{at}</b></>
	let fix = null
	if (nextDue && ['offer', 'start'].includes(nextDue.by)) {
		fix = <>{by(dueText(nextDue.at))}, or the spot you were offered in {nextDue.title} may go to someone else</>
	} else if (nextDue) {
		fix = <>{by(dueText(nextDue.at))}, or you’ll be moved to the waitlist of {nextDue.title}</>
	}
	const text = {
		pending: `You sent your ${what} (${money(payment.amount)} by ${payment.methodTitle}, #${payment.reference}) on ${sentOn(payment.submittedAt)}. It’s waiting to be checked.`,
		approved: payment.kind === 'dues'
			? `Your VIP dues were approved. You’re a VIP for ${payment.schoolYear}!`
			: goggles
				? 'Your goggle rental was approved. Your goggles will be ready for you at the lab.'
				: `Your ${what} was approved, and your spot is confirmed. Show your QR code at the door.`,
		// on /vip, what to do about it on a line of its own, under why
		rejected: (
			<>
				Your {what} (#{payment.reference}) was sent back: {payment.rejectionReason}
				{duesOnly && (
					<>
						<br />
						Fix it and send it again below{fix}.
					</>
				)}
			</>
		),
		declined: `Your ${what} (#${payment.reference}) was rejected${payment.rejectionReason ? `: ${payment.rejectionReason}` : '.'}${goggles
			? ' Bring your own goggles, or rent a pair again below.'
			: payment.labId || payment.eventId ? ` You’ve been moved to the waitlist.` : ''}`,
		reversed: `Your ${what} approval was taken back, and you’re marked unpaid again. Send it again below.`,
	}[payment.status]
	return (
		<p
			role="status"
			className={`
				rounded-[10px]
				px-4
				py-2.5
				font-vietnam
				font-semibold
				text-[13px]
				leading-[1.4]
				${tones[payment.status]}
			`}
		>
			{text}
		</p>
	)
}

// a QR code's width and the gap between two, and the narrowest the form beside
// them gets, in the design's px
const CODE_W = 112
const CODE_GAP = 32
const FORM_MIN = 320
// the goggle card beside it (lg:w-[340px] on it), and the gap between
const GOGGLES_W = 340
const CARD_GAP = 20

// a white card the way the analytics cards are
const CARD = 'rounded-[16px] bg-white p-6 shadow-[0_0_20px_rgba(0,0,0,0.15)]'

// `onSent` runs once a payment's been sent (or fixed): sending one holds their
// spot (and takes one they were offered), so the page re-reads.
export default function PaySection({ place = {}, noun = 'lab', duesOnly = false, hideDue = false, notice = null, onSent }) {
	const { user, refresh } = useSession()
	const [options, setOptions] = useState(null)
	const [error, setError] = useState(null)
	const [busy, setBusy] = useState(false)
	const [methodId, setMethodId] = useState('')
	const [reference, setReference] = useState('')
	const [kind, setKind] = useState(duesOnly ? 'dues' : '')
	const [screenshot, setScreenshot] = useState(null)
	// the pending payment being fixed, when "edit" is open
	const [editing, setEditing] = useState(null)
	const picker = useRef(null)
	const codes = useRef(null)
	const fitScroll = useContext(FitScroll)
	const key = JSON.stringify(place)

	// A payment that was sent back (or taken back) opens the form on what they
	// sent, so fixing it is changing the one thing that was wrong rather than
	// typing it all again.
	const fill = (reply) => {
		setOptions(reply)
		const last = reply.payments.find((payment) => payment.kind !== 'goggles')
		if (last?.status !== 'rejected' && last?.status !== 'reversed') return
		setMethodId(last.methodId != null && reply.methods.some((m) => m.methodId === last.methodId) ? String(last.methodId) : '')
		setReference(last.reference)
		setKind(duesOnly ? 'dues' : last.kind)
		setScreenshot(last.screenshot ?? null)
	}

	const read = () => paymentsApi.options(JSON.parse(key)).then(fill)

	useEffect(() => {
		let live = true
		paymentsApi.options(JSON.parse(key))
			.then((reply) => live && fill(reply))
			.catch((err) => live && setError(err.message))
		return () => { live = false }
		// `fill` only sets state; the read is what depends on `key`
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key])

	// Approved dues make them VIP on the server; the session's copy of their
	// role (and with it the sidebar's "become VIP") is re-read to follow —
	// j-board's role stays, but their duesPaid turns.
	const nowVip = Boolean(options?.duesPaid) && (user?.role === 'member' || (user?.role === 'jboard' && !user?.duesPaid))
	useEffect(() => {
		if (nowVip) refresh()
	}, [nowVip, refresh])

	// Once the QR codes wrap onto a second row the page is let scroll, not
	// shrunk to fit (FitScroll). Checked whenever the row changes size.
	useEffect(() => {
		if (!fitScroll) return
		const list = codes.current
		if (!list) {
			fitScroll(false)
			return
		}
		const check = () => {
			const items = list.children
			fitScroll(items.length > 1 && items[items.length - 1].offsetTop > items[0].offsetTop)
		}
		check()
		const observer = new ResizeObserver(check)
		observer.observe(list)
		return () => {
			observer.disconnect()
			fitScroll(false)
		}
	}, [fitScroll, options, editing])

	if (!options) return null
	// the spot's payments — a goggle rental has its own card
	const latest = options.payments.find((payment) => payment.kind !== 'goggles') ?? null
	const choices = options.choices.filter((choice) => !duesOnly || choice.kind === 'dues')

	// a lab's goggle rental, for anyone signed up — and anyone who's sent one
	const rentals = options.payments.filter((payment) => payment.kind === 'goggles')
	const goggles = !duesOnly && options.goggles?.price > 0 && (options.goggles.holds || rentals.length > 0)
		? (
			<GoggleCard
				key={rentals[0]?.paymentId ?? 'none'}
				goggles={options.goggles}
				rentals={rentals}
				methods={options.methods}
				place={place}
				onSent={async () => {
					await read()
					await onSent?.()
				}}
			/>
		)
		: null
	// nothing to pay to come, but goggles to rent: the notice, any line in
	// place of the pay card, and the goggle card under it (AloneFrame)
	const alone = (content = null) => goggles
		? (
			<AloneFrame>
				{notice}
				{content}
				{goggles}
			</AloneFrame>
		)
		: content

	// /vip once they're paid up
	if (options.duesPaid) {
		if (!duesOnly) return alone()
		return (
			<section className="w-full max-w-[640px] mx-auto">
				<Status payment={latest ?? { kind: 'dues', status: 'approved', schoolYear: options.schoolYear }} noun={noun} />
			</section>
		)
	}
	if (options.exempt) return alone()

	// the entry's settled for this one — at the door, or a fee they sent
	if (options.door) {
		return alone(
			<p className="
				mt-5
				font-vietnam
				font-semibold
				text-[14px]
				text-green-dark
				text-center
			">
				{options.door === 'fee' ? `your ${noun} fee is paid ✓` : `you’re all set for this ${noun} ✓`}
			</p>
		)
	}
	if (choices.length === 0 && !latest) return goggles ? alone() : notice

	// the card's wide layout (see the form), and how wide it is: room for
	// every QR code in one row beside the form, or the usual 880px if that's
	// more — never past the column, which wraps them instead
	// With the goggle card beside it the pay card starts narrower, so the two
	// fit the column side by side.
	const side = !duesOnly
	const count = options.methods.length
	const needed = count * CODE_W + (count - 1) * CODE_GAP + CODE_GAP + FORM_MIN + 48
	const wide = goggles ? Math.max(720, needed) + CARD_GAP + GOGGLES_W : Math.max(880, needed)
	const waiting = latest?.status === 'pending'
	const ready = methodId !== '' && reference.trim() !== '' && kind !== '' && !busy
	const showForm = editing != null || (!waiting && choices.length > 0)

	// what the dropdown offers: this one's fee and VIP dues, each greyed out
	// when there's nothing to pay for it here — and, editing, whatever it was
	// sent as
	const fee = choices.find((choice) => choice.kind === 'fee')
	const dues = choices.find((choice) => choice.kind === 'dues')
	const kinds = [
		...(options.item ? [{ kind: 'fee', text: fee ? label(fee, noun) : `${noun} fee (none for this ${noun})`, off: !fee && !(editing && latest.kind === 'fee') }] : []),
		{ kind: 'dues', text: dues ? label(dues, noun) : 'VIP dues (not set yet)', off: !dues && !(editing && latest.kind === 'dues') },
	]

	const startEdit = () => {
		setEditing(latest.paymentId)
		setMethodId(latest.methodId != null ? String(latest.methodId) : '')
		setReference(latest.reference)
		setKind(latest.kind)
		setScreenshot(latest.screenshot ?? null)
		setError(null)
	}
	const stopEdit = () => {
		setEditing(null)
		setMethodId('')
		setReference('')
		setKind(duesOnly ? 'dues' : '')
		setScreenshot(null)
	}

	const pick = async (event) => {
		const file = event.target.files?.[0]
		event.target.value = ''
		if (!file) return
		try {
			setScreenshot(await shrinkImage(file, RECEIPT_MAX))
		} catch (err) {
			setError(err.message)
		}
	}

	const submit = async (event) => {
		event.preventDefault()
		if (!ready) return
		setBusy(true)
		setError(null)
		try {
			const body = { kind, methodId: Number(methodId), reference: reference.trim(), screenshot }
			if (editing != null) await paymentsApi.edit(editing, body)
			else await paymentsApi.send({ ...(options.item ? place : {}), ...body })
			stopEdit()
			await read()
			await onSent?.()
		} catch (err) {
			setError(err.message)
		} finally {
			setBusy(false)
		}
	}

	return (
		// the notice and the card share one width
		<div
			className={`
				mt-6
				w-full
				${duesOnly ? 'max-w-[720px]' : 'max-w-[720px] lg:max-w-(--pay-w)'}
				mx-auto
				flex
				flex-col
				gap-5
			`}
			style={side ? { '--pay-w': `${wide}px` } : undefined}
		>
		{notice}
		{/* the pay card, and a lab's goggle card on its right (under it,
		    narrower) */}
		<div className="
			flex
			flex-col
			lg:flex-row
			lg:items-stretch
			gap-5
		">
		{/* on a lab's or event's page it's a card of its own, the way the
		    analytics cards are (white, rounded, the soft shadow) — set apart
		    from the page's own text above it. /vip is nothing but this, so it
		    isn't. */}
		<section className={`
			w-full
			min-w-0
			lg:flex-1
			text-left
			${duesOnly ? '' : CARD}
		`}>
			<h2 className="
				font-vietnam
				font-semibold
				text-[15px]
				text-black
			">
				{duesOnly ? 'pay your VIP dues' : 'pay before you come'}
				{choices.length > 0 && (
					<span className="
						ml-2
						font-normal
						text-[13px]
						text-black/50
					">
						{choices.map((choice) => label(choice, noun)).join(', or ')}
					</span>
				)}
			</h2>

			{/* when it's due — a week before, 11:59 PM, or their confirmation
			    deadline if that's sooner — and what happens if it isn't; and
			    that it isn't refunded. A lab's or event's only: /vip's dues
			    aren't for one day. */}
			{!duesOnly && !hideDue && options.dueAt && (
				<p className="
					mt-1
					font-vietnam
					text-[13px]
					text-black/70
				">
					{new Date(options.dueAt) > new Date()
						? <>Pay {{ confirm: 'by your confirmation deadline,', late: 'within 48 hours, by' }[options.dueBy] ?? 'a week before, by'} <b className="text-black">{dueText(options.dueAt)}</b>, or you’ll be moved to the waitlist.</>
						: <>Payment was due <b className="text-black">{dueText(options.dueAt)}</b>. Pay now to keep your spot.</>}
				</p>
			)}
			{/* /vip: dues aren't due by any day of their own — only once they're
			    signed up for something they'd pay for, by that one's due date
			    (the soonest happening; the next one's once it's gone) */}
			{/* (a sent-back payment's red line says it instead, once) */}
			{duesOnly && options.nextDue && !['pending', 'rejected'].includes(latest?.status) && (
				<p className="
					mt-1
					font-vietnam
					text-[13px]
					text-black/70
				">
					{options.nextDue.by === 'offer'
						? <>To take the spot you were offered in {options.nextDue.title}, pay by <b className="text-black">{dueText(options.nextDue.at)}</b>.</>
						: options.nextDue.by === 'start'
							? <>To take the spot you were offered in {options.nextDue.title}, pay before it starts, <b className="text-black">{dueText(options.nextDue.at)}</b>.</>
							: <>Pay by <b className="text-black">{dueText(options.nextDue.at)}</b> to keep your spot in {options.nextDue.title}, or you’ll be moved to its waitlist.</>}
				</p>
			)}
			{!duesOnly && (
				<p className="
					mt-2
					flex
					items-start
					gap-2
					rounded-[10px]
					bg-yellow-light/50
					px-4
					py-2
					font-vietnam
					font-semibold
					text-[12.5px]
					leading-snug
					text-[#8A7500]
				">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0 mt-px" aria-hidden="true">
						<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
						<path d="M12 9v4" />
						<path d="M12 17h.01" />
					</svg>
					<span>
						Payments <b className="font-extrabold">AREN’T REFUNDED</b> if you can’t make it, because we buy your materials ahead of time. Make sure to remove your RSVP if you can’t make it, so other people have a chance to join.
					</span>
				</p>
			)}

			{latest && (
				<div className="
					mt-2
					flex
					items-start
					gap-3
				">
					<div className="flex-1 min-w-0"><Status payment={latest} noun={noun} duesOnly={duesOnly} nextDue={options.nextDue} /></div>
					{waiting && (
						<button
							type="button"
							onClick={editing != null ? stopEdit : startEdit}
							className="
								shrink-0
								mt-1.5
								rounded-full
								border
								border-black/60
								px-3
								py-1
								font-vietnam
								font-semibold
								text-[12px]
								text-black
								cursor-pointer
								transition-colors
								hover:bg-black
								hover:text-cream
							"
						>
							{editing != null ? 'cancel' : 'edit'}
						</button>
					)}
				</div>
			)}

			{showForm && (
				options.methods.length === 0 ? (
					<p className="
						mt-3
						font-vietnam
						text-[13px]
						text-black/50
					">
						There’s no way to pay online yet. You can pay at the door.
					</p>
				) : (
					<form onSubmit={submit} className="mt-3">
						{/* a QR code on the phone you'd pay with can't be scanned by
						    that phone — so the tip, set apart from the rest in a blue
						    box of its own */}
						<p className="
							mb-3
							flex
							items-start
							gap-2
							rounded-[12px]
							bg-blue-light/50
							px-4
							py-2
							font-vietnam
							italic
							text-[12.5px]
							leading-snug
							text-blue-med
						">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0 mt-px not-italic" aria-hidden="true">
								<rect x="7" y="3" width="10" height="18" rx="2" />
								<path d="M11 18h2" />
							</svg>
							<span>
								<b className="not-italic font-semibold">tip:</b> open this page on another device, like a laptop, and scan the QR code off its screen with your phone.
							</span>
						</p>

						{/* On a wide screen in its card, the QR codes and the form sit
						    side by side — the QR codes on the left, the three fields
						    stacked on the right — so the card is wide and short
						    enough for the whole page to fit the window. Narrower, and
						    on /vip, the form goes under the codes. */}
						<div className={side ? `
							lg:grid
							lg:grid-cols-[auto_minmax(320px,1fr)]
							lg:items-center
							lg:gap-8
						` : ''}>
							{/* the QR codes, side by side and centred across the section,
							    the same gap between each — more than fit wrap onto a
							    second row, still centred */}
							<ul ref={codes} className="
								flex
								flex-wrap
								justify-center
								gap-x-8
								gap-y-4
								pb-1
							">
								{options.methods.map((method) => (
									<li
										key={method.methodId}
										className="
											w-[112px]
											shrink-0
											text-center
										"
									>
										<div className="
											w-[112px]
											h-[112px]
											flex
											items-center
											justify-center
											rounded-[10px]
											overflow-hidden
											bg-white
											border
											border-black/10
										">
											{method.image
												? <img src={method.image} alt={`${method.title} QR code`} className="w-full h-full object-contain" />
												: <span className="px-2 text-center font-vietnam font-semibold text-[13px] text-black/60">{method.title}</span>}
										</div>
										<p className="
											mt-1.5
											font-vietnam
											font-semibold
											text-[12px]
											leading-tight
											text-black
											break-words
										">
											{method.title}
										</p>
										{method.description && (
											<p className="
												mt-0.5
												font-vietnam
												text-[11px]
												leading-tight
												text-black/50
												break-words
											">
												{method.description}
											</p>
										)}
									</li>
								))}
							</ul>

							<div className="min-w-0">
								<div className={`
									mt-3
									grid
									grid-cols-1
									gap-2.5
									${duesOnly ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}
									${side ? 'lg:mt-0 lg:grid-cols-1' : ''}
								`}>
									<Dropdown
										value={methodId}
										onChange={(event) => setMethodId(event.target.value)}
										aria-label="Payment platform"
									>
										<option value="">payment platform</option>
										{options.methods.map((method) => (
											<option key={method.methodId} value={method.methodId}>{method.title}</option>
										))}
									</Dropdown>
									<input
										type="text"
										value={reference}
										onChange={(event) => setReference(event.target.value)}
										maxLength={80}
										placeholder="transaction id"
										aria-label="Transaction id"
										className={FIELD}
									/>
									{!duesOnly && (
										<Dropdown
											value={kind}
											onChange={(event) => setKind(event.target.value)}
											aria-label="What it was for"
										>
											<option value="">what was it for?</option>
											{kinds.map((option) => (
												<option key={option.kind} value={option.kind} disabled={option.off}>{option.text}</option>
											))}
										</Dropdown>
									)}
								</div>

								<div className="
									mt-2.5
									flex
									items-center
									justify-between
									gap-3
								">
									<div className="
										min-w-0
										flex
										items-center
										gap-2
										font-vietnam
										text-[13px]
										text-black/55
									">
										{screenshot && (
											<img src={screenshot} alt="" className="w-8 h-8 rounded-[6px] object-cover border border-black/10" />
										)}
										<button
											type="button"
											onClick={() => picker.current?.click()}
											className="
												underline
												underline-offset-2
												cursor-pointer
												hover:text-black
											"
										>
											{screenshot ? 'change screenshot' : '+ screenshot (recommended)'}
										</button>
										{screenshot && (
											<button
												type="button"
												onClick={() => setScreenshot(null)}
												className="cursor-pointer hover:text-black"
											>
												remove
											</button>
										)}
										<input ref={picker} type="file" accept="image/*" onChange={pick} className="hidden" />
									</div>
									<button
										type="submit"
										disabled={!ready}
										title={ready ? undefined : 'Fill in all three first'}
										className={`
											shrink-0
											h-[38px]
											rounded-full
											px-5
											font-vietnam
											font-semibold
											text-[14px]
											transition-all
											duration-200
											ease-out
											${ready
												? 'bg-salmon text-white cursor-pointer hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20'
												: 'bg-black/10 text-black/40 cursor-not-allowed'}
										`}
									>
										{busy ? 'sending…' : editing != null ? 'save changes' : 'send payment'}
									</button>
								</div>
							</div>
						</div>
					</form>
				)
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
		</section>
		{goggles}
		</div>
		</div>
	)
}

// The goggle card with nothing to pay beside it — a VIP's, staff's — centred
// at its own width. It sits as far under the button as the button sits under
// the lab's description (MemberLabSignup's lg:mt-[30px]), so the three read
// as evenly spaced, and the page centres them as one block — truly centred:
// the lab page sits its content 26px above the middle (MemberLabView's
// lg:pb-[26px]), which the -26px under this hands back.
function AloneFrame({ children }) {
	return (
		<div className="
			mt-6
			lg:mt-[30px]
			lg:-mb-[26px]
			w-full
			max-w-[720px]
			mx-auto
			flex
			flex-col
			items-center
			gap-5
		">
			{children}
		</div>
	)
}

// The goggle rental, on a lab's page beside the pay card: goggles are
// required, so anyone signed up who hasn't got their own rents a pair — the
// club's price, up to 24 hours before it starts. Sent the way any payment is
// (the platform and the transaction id, a screenshot if they like), with no
// QR codes of its own (they're on the pay card) and nothing to pick for what
// it's for. Paid in the same transaction as the lab, it's the same
// transaction id. Then it says where the rental stands, the same as the pay
// card does, with the form back to fix one that's sent back. Keyed on the
// newest rental, so the form starts over (or on the one sent back) when that
// changes.
//
// Past the deadline with no rental in (none sent, or one sent back or turned
// down), the card is only a note, in its middle: bring your own goggles, from
// the university bookstore or a friend — no more rentals.
//
//   goggles  the API's { price, dueAt, holds, open, sent }
//   rentals  their goggle payments for this lab, newest first
function GoggleCard({ goggles, rentals, methods, place, onSent }) {
	const latest = rentals[0] ?? null
	// a sent-back (or taken-back) one opens the form on what they sent
	const again = latest && ['rejected', 'reversed'].includes(latest.status) ? latest : null
	const [methodId, setMethodId] = useState(() =>
		again?.methodId != null && methods.some((m) => m.methodId === again.methodId) ? String(again.methodId) : '')
	const [reference, setReference] = useState(again?.reference ?? '')
	const [screenshot, setScreenshot] = useState(again?.screenshot ?? null)
	const [editing, setEditing] = useState(null)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState(null)
	const picker = useRef(null)

	const waiting = latest?.status === 'pending'
	const settled = latest && ['pending', 'approved'].includes(latest.status)
	const showForm = goggles.open && (editing != null || !settled)
	const ready = methodId !== '' && reference.trim() !== '' && !busy
	const closed = goggles.dueAt && new Date(goggles.dueAt) <= new Date()

	if (closed && !settled) {
		return (
			<section className={`
				w-full
				lg:w-[340px]
				lg:shrink-0
				min-h-[180px]
				flex
				flex-col
				items-center
				justify-center
				text-center
				${CARD}
			`}>
				<h2 className="
					font-vietnam
					font-semibold
					text-[15px]
					text-black
				">
					goggle rental is closed
				</h2>
				<p className="
					mt-2
					font-vietnam
					text-[13px]
					leading-snug
					text-black/70
				">
					You must now bring your own goggles. We aren’t taking any more rentals. You can buy a pair at the university bookstore, or get one from a friend.
				</p>
			</section>
		)
	}

	const startEdit = () => {
		setEditing(latest.paymentId)
		setMethodId(latest.methodId != null ? String(latest.methodId) : '')
		setReference(latest.reference)
		setScreenshot(latest.screenshot ?? null)
		setError(null)
	}
	const stopEdit = () => {
		setEditing(null)
		setMethodId('')
		setReference('')
		setScreenshot(null)
	}

	const pick = async (event) => {
		const file = event.target.files?.[0]
		event.target.value = ''
		if (!file) return
		try {
			setScreenshot(await shrinkImage(file, RECEIPT_MAX))
		} catch (err) {
			setError(err.message)
		}
	}

	const submit = async (event) => {
		event.preventDefault()
		if (!ready) return
		setBusy(true)
		setError(null)
		try {
			const body = { kind: 'goggles', methodId: Number(methodId), reference: reference.trim(), screenshot }
			if (editing != null) await paymentsApi.edit(editing, body)
			else await paymentsApi.send({ ...place, ...body })
			stopEdit()
			await onSent()
		} catch (err) {
			setError(err.message)
		} finally {
			setBusy(false)
		}
	}

	return (
		<section className={`
			w-full
			lg:w-[340px]
			lg:shrink-0
			text-left
			${CARD}
		`}>
			<h2 className="
				font-vietnam
				font-semibold
				text-[15px]
				text-black
			">
				goggle rental
				<span className="
					ml-2
					font-normal
					text-[13px]
					text-black/50
				">
					{money(goggles.price)}
				</span>
			</h2>
			<p className="
				mt-1
				font-vietnam
				text-[13px]
				leading-snug
				text-black/70
			">
				Goggles are required in the lab. If you need a pair, rent one here with a payment of its own. If you paid for the rental in the same transaction as the lab, put that same transaction id.
			</p>
			{goggles.dueAt && (
				<p className="
					mt-2
					font-vietnam
					text-[13px]
					leading-snug
					text-black/70
				">
					{closed
						? <>Rental closed <b className="text-black">{dueText(goggles.dueAt)}</b>, 24 hours before the lab.</>
						: <>Rent by <b className="text-black">{dueText(goggles.dueAt)}</b>, 24 hours before the lab.</>}
				</p>
			)}

			{latest && (
				<div className="
					mt-3
					flex
					items-start
					gap-3
				">
					<div className="flex-1 min-w-0"><Status payment={latest} noun="lab" /></div>
					{waiting && goggles.open && (
						<button
							type="button"
							onClick={editing != null ? stopEdit : startEdit}
							className="
								shrink-0
								mt-1.5
								rounded-full
								border
								border-black/60
								px-3
								py-1
								font-vietnam
								font-semibold
								text-[12px]
								text-black
								cursor-pointer
								transition-colors
								hover:bg-black
								hover:text-cream
							"
						>
							{editing != null ? 'cancel' : 'edit'}
						</button>
					)}
				</div>
			)}

			{showForm && methods.length > 0 && (
				<form onSubmit={submit} className="
					mt-3
					grid
					gap-2.5
				">
					<Dropdown
						value={methodId}
						onChange={(event) => setMethodId(event.target.value)}
						aria-label="Payment platform"
					>
						<option value="">payment platform</option>
						{methods.map((method) => (
							<option key={method.methodId} value={method.methodId}>{method.title}</option>
						))}
					</Dropdown>
					<input
						type="text"
						value={reference}
						onChange={(event) => setReference(event.target.value)}
						maxLength={80}
						placeholder="transaction id"
						aria-label="Transaction id"
						className={FIELD}
					/>
					<div className="
						flex
						items-center
						justify-between
						gap-3
					">
						<div className="
							min-w-0
							flex
							items-center
							gap-2
							font-vietnam
							text-[13px]
							text-black/55
						">
							{screenshot && (
								<img src={screenshot} alt="" className="w-8 h-8 rounded-[6px] object-cover border border-black/10" />
							)}
							<button
								type="button"
								onClick={() => picker.current?.click()}
								className="
									underline
									underline-offset-2
									cursor-pointer
									hover:text-black
								"
							>
								{screenshot ? 'change screenshot' : '+ screenshot (recommended)'}
							</button>
							{screenshot && (
								<button
									type="button"
									onClick={() => setScreenshot(null)}
									className="cursor-pointer hover:text-black"
								>
									remove
								</button>
							)}
							<input ref={picker} type="file" accept="image/*" onChange={pick} className="hidden" />
						</div>
						<button
							type="submit"
							disabled={!ready}
							title={ready ? undefined : 'Pick how you paid and type the transaction id first'}
							className={`
								shrink-0
								h-[38px]
								rounded-full
								px-5
								font-vietnam
								font-semibold
								text-[14px]
								transition-all
								duration-200
								ease-out
								${ready
									? 'bg-salmon text-white cursor-pointer hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20'
									: 'bg-black/10 text-black/40 cursor-not-allowed'}
							`}
						>
							{busy ? 'sending…' : editing != null ? 'save' : 'rent goggles'}
						</button>
					</div>
				</form>
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
		</section>
	)
}

