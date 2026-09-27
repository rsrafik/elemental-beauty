'use client'

import { useState } from 'react'
import { labs as labsApi } from '@/lib/api'
import { LabIntro, ChunkyButton, ButtonCaption, DuesNotice } from '@/components/labs/LabViewParts'

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
// Whether a sign-up lands a seat or a waitlist place is the server's call — the
// button flips straight to "registered" and then `onChange` re-reads the lab,
// which corrects it to "waitlisted" if the lab was full.
//
// `ended` is a lab whose day has gone without you checking in: nothing left to
// sign up for, so it says so instead of offering a button.
//
// Under the button: what it'll cost someone who hasn't paid the year's dues
// (DuesNotice), and — for anyone holding a spot — the prelab the confirmation
// email attaches, so an email that never arrived doesn't mean going without.

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
	const confirmPending = going && lab.confirmPending && !confirmed

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

	const toggle = async () => {
		if (busy) return
		setBusy(true)
		setError(null)
		const leaving = going || waitlisted || offered
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
					I can&apos;t make it — give up my spot
				</button>
			</>
		)
	} else if (going) {
		button = <ChunkyButton tone="green" onClick={toggle}>YOU&apos;RE REGISTERED!</ChunkyButton>
		caption = 'click again to unregister'
	} else if (offered) {
		button = <ChunkyButton tone="green" onClick={accept}>ACCEPT MY SPOT</ChunkyButton>
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
	} else {
		button = <ChunkyButton tone="red" onClick={toggle}>SIGN UP</ChunkyButton>
		if (unlimited) caption = null
		else caption = left > 0
			? `${left}/${lab.capacity} spots left!`
			: 'the lab is full — signing up puts you on the waitlist'
	}

	return (
		<LabIntro lab={lab}>
			<div className="
				flex
				flex-col
				items-center
				mt-[50px]
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
				{!ended && <DuesNotice dues={lab.dues} noun="lab" />}
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
			</div>
		</LabIntro>
	)
}
