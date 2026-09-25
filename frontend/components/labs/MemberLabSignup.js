'use client'

import { useState } from 'react'
import { labs as labsApi } from '@/lib/api'
import { LabIntro, ChunkyButton, ButtonCaption } from '@/components/labs/LabViewParts'

// Before the lab: one button that is the whole of your relationship with it.
//
//   not signed up   red SIGN UP, with the seats left under it
//   rsvped          green YOU'RE REGISTERED!, click again to give the seat up
//   waitlisted      yellow YOU'RE WAITLISTED!, your place in the queue, click
//                   again to leave it
//
// Whether a sign-up lands a seat or a waitlist place is the server's call — the
// button flips straight to "registered" and then `onChange` re-reads the lab,
// which corrects it to "waitlisted" if the lab was full.
//
// `ended` is a lab whose day has gone without you checking in: nothing left to
// sign up for, so it says so instead of offering a button.

export default function MemberLabSignup({ lab, ended, onChange }) {
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState(null)
	// the flip shown while the request is out, so the click answers at once
	const [pending, setPending] = useState(null)

	const mine = pending ?? lab.mine
	const going = mine === 'rsvped'
	const waitlisted = mine === 'waitlisted'
	// null capacity = unlimited seats: never full, and no count to show
	const unlimited = lab.capacity == null
	const left = unlimited ? Infinity : Math.max(0, lab.capacity - lab.taken)

	const toggle = async () => {
		if (busy) return
		setBusy(true)
		setError(null)
		const leaving = going || waitlisted
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
	} else if (going) {
		button = <ChunkyButton tone="green" onClick={toggle}>YOU&apos;RE REGISTERED!</ChunkyButton>
		caption = 'click again to unregister'
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
