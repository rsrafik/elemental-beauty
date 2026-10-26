'use client'

import { useState } from 'react'
import { labs as labsApi } from '@/lib/api'
import { LabIntro, ChunkyButton, ButtonCaption, DuesNotice, LeavePopup, PayToHold } from '@/components/labs/LabViewParts'
import PaySection from '@/components/payments/PaySection'

// Before the lab: one button that is the whole of your relationship with it.
//
//   not signed up   red SIGN UP, with the seats left under it
//   rsvped          green YOU'RE REGISTERED!, click again to give the seat up
//   waitlisted      yellow YOU'RE WAITLISTED!, your place in the queue, click
//                   again to leave it
//   offered         a spot came free and it's held for you (src/offers.js):
//                   green ACCEPT MY SPOT, or turn it down
//   asked to confirm  signed up, and the officers have asked everyone to
//                   confirm (the check-in page's "confirmation"): green
//                   CONFIRM MY SPOT until you do
//
// Someone who owes for it gets neither button: paying is how they confirm or
// accept (src/offers.js), so they keep YOU'RE REGISTERED! — or, offered, just
// the caption — and a card over the pay card says so (PayToHold).
//   sign-ups closed  not signed up, and the lab isn't taking sign-ups (its
//                   "accepting rsvps" switch): no button, just saying so
//
// Whether a sign-up lands a seat or a waitlist place is the server's call — the
// button flips straight to "registered" and then `onChange` re-reads the lab,
// which corrects it to "waitlisted" if the lab was full.
//
// `ended` is a lab whose day has gone without you checking in: nothing left to
// sign up for, so it says so instead of offering a button.
//
// The button sits under the title, description and photo, in the middle of
// the content column. Under it: for anyone holding a spot, the prelab the
// confirmation email attaches (so an email that never arrived doesn't mean
// going without) and — when they haven't paid the year's dues — the way to
// pay before they come (PaySection: the QR codes, and the form that tells the
// treasurer they've paid). Anyone else who'd owe is told what it'll cost
// (DuesNotice).

export default function MemberLabSignup({ lab, ended, onChange }) {
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState(null)
	// the flip shown while the request is out, so the click answers at once
	const [pending, setPending] = useState(null)

	const mine = pending ?? lab.mine
	const going = mine === 'rsvped'
	const waitlisted = mine === 'waitlisted'
	const offered = mine === 'offered'
	// null capacity = unlimited seats: never full, and no count to show
	const unlimited = lab.capacity == null
	const left = unlimited ? Infinity : Math.max(0, lab.capacity - lab.taken)

	const [confirmed, setConfirmed] = useState(false)
	// owes for it: paying confirms (or accepts) it, not a button
	const payToHold = Boolean(lab.pay)
	const confirmPending = going && lab.confirmPending && !confirmed && !payToHold

	// the prelab, opened in a new tab — the tab is opened on the click itself,
	// before the file is fetched, or a popup blocker takes it for an ad
	const openPrelab = async () => {
		const tab = window.open('', '_blank')
		setError(null)
		try {
			const url = await labsApi.prelabUrl(lab.labId)
			if (tab) tab.location.href = url
			setTimeout(() => URL.revokeObjectURL(url), 60_000)
		} catch (err) {
			tab?.close()
			setError(err.message)
		}
	}

	const confirm = async () => {
		if (busy) return
		setBusy(true)
		setError(null)
		try {
			await labsApi.confirm(lab.labId)
			setConfirmed(true)
			await onChange()
		} catch (err) {
			setError(err.message)
		} finally {
			setBusy(false)
		}
	}

	// accepting is the same call as signing up — the server sees the offer
	const accept = async () => {
		if (busy) return
		setBusy(true)
		setError(null)
		setPending('rsvped')
		try {
			await labsApi.rsvp(lab.labId)
			await onChange()
		} catch (err) {
			setError(err.message)
		} finally {
			setPending(null)
			setBusy(false)
		}
	}

	// the leave-a-closed-lab warning, while it's up
	const [askingLeave, setAskingLeave] = useState(false)

	// Leaving always asks first (LeavePopup — it also says when sign-ups are
	// closed, and that a paid entry isn't refunded) and comes back here with
	// `confirmed`: { ok }. A click hands this an event, which has no `ok`, so
	// a click always asks.
	const toggle = async (confirmed = null) => {
		if (busy) return
		const leaving = going || waitlisted || offered
		if (leaving && !confirmed?.ok) {
			setAskingLeave(true)
			return
		}
		setBusy(true)
		setError(null)
		setPending(leaving ? 'none' : 'rsvped')
		try {
			if (leaving) await labsApi.unrsvp(lab.labId)
			else await labsApi.rsvp(lab.labId)
			await onChange()
		} catch (err) {
			setError(err.message)
		} finally {
			setPending(null)
			setBusy(false)
		}
	}

	let button
	let caption
	if (ended) {
		caption = 'this lab has already happened'
	} else if (confirmPending) {
		button = <ChunkyButton tone="green" onClick={confirm}>CONFIRM MY SPOT</ChunkyButton>
		caption = (
			<>
				{`please confirm you're still coming${lab.confirmBy
					? ` by ${new Date(lab.confirmBy).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
					: ''}, or your spot may go to the waitlist`}
				<br />
				<button
					type="button"
					onClick={toggle}
					className="
						underline
						underline-offset-2
						cursor-pointer
						hover:text-black
					"
				>
					I can&apos;t make it, give up my spot
				</button>
			</>
		)
	} else if (going) {
		button = <ChunkyButton tone="green" onClick={toggle}>YOU&apos;RE REGISTERED!</ChunkyButton>
		caption = 'click again to unregister'
	} else if (offered) {
		// owing, there's nothing to press: paying below accepts it
		if (!payToHold) button = <ChunkyButton tone="green" onClick={accept}>ACCEPT MY SPOT</ChunkyButton>
		caption = (
			<>
				a spot opened up and it&apos;s being held for you
				<br />
				<button
					type="button"
					onClick={toggle}
					className="
						underline
						underline-offset-2
						cursor-pointer
						hover:text-black
					"
				>
					no thanks, give it to the next person
				</button>
			</>
		)
	} else if (waitlisted) {
		const away = lab.waitlistPosition
		button = <ChunkyButton tone="yellow" onClick={toggle}>YOU&apos;RE WAITLISTED!</ChunkyButton>
		caption = (
			<>
				we will notify you when you&apos;re on the list
				{away != null && (
					<>
						<br />
						you&apos;re currently: {away} {away === 1 ? 'spot' : 'spots'} away
					</>
				)}
				<br />
				click again to unwaitlist
			</>
		)
	} else if (!lab.acceptingRsvps) {
		// the officers have switched sign-ups off (the lab's dots menu)
		caption = 'this lab isn’t taking sign-ups right now'
	} else {
		button = <ChunkyButton tone="red" onClick={toggle}>SIGN UP</ChunkyButton>
		if (unlimited) caption = null
		else caption = left > 0
			? `${left}/${lab.capacity} spots left!`
			: 'the lab is full, so signing up puts you on the waitlist'
	}

	return (
		<>
			<LabIntro lab={lab} />

			{/* centred in the content column: MemberLabView pads the page 48px on
			    the left and 64px on the right, which the margins here give back,
			    so the middle is the column's and not the padded box's */}
			<div className="
				flex
				flex-col
				items-center
				mt-8
				lg:mt-[30px]
				lg:-ml-[48px]
				lg:-mr-[64px]
			">
				{button}
				{caption && <ButtonCaption>{caption}</ButtonCaption>}
				{!ended && (going || offered) && lab.prelabPdfName && (
					<button
						type="button"
						onClick={openPrelab}
						className="
							mt-3
							font-vietnam
							font-semibold
							text-[15px]
							text-salmon-dark
							underline
							underline-offset-2
							cursor-pointer
							hover:text-black
						"
					>
						open the prelab ({lab.prelabPdfName})
					</button>
				)}
				{!ended && !(going || offered) && <DuesNotice dues={lab.dues} noun="lab" due={lab.paymentDueAt} />}
				{error && (
					<p className="
						font-vietnam
						text-sm
						text-salmon-dark
						text-center
						mt-2
					">
						{error}
					</p>
				)}
				{!ended && (going || offered) && (
					<PaySection
						place={{ labId: lab.labId }}
						noun="lab"
						hideDue={payToHold}
						notice={<PayToHold pay={lab.pay} offered={offered} offerBy={lab.offerBy} />}
						onSent={onChange}
					/>
				)}
			</div>

			{askingLeave && (
				<LeavePopup
					title={lab.title}
					mine={mine}
					closed={!lab.acceptingRsvps}
					place={{ labId: lab.labId }}
					onConfirm={() => {
						setAskingLeave(false)
						toggle({ ok: true })
					}}
					onClose={() => setAskingLeave(false)}
				/>
			)}
		</>
	)
}
