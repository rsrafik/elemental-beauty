'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import DashboardShell from '@/components/dashboards/DashboardShell'
import { events as eventsApi } from '@/lib/api'
import { isoDate, today } from '@/lib/dates'
import { BackButton, Scaled, LabIntro, ChunkyButton, ButtonCaption } from '@/components/labs/LabViewParts'
import { ShowQrButton, QrPopup } from '@/components/labs/MemberLabQuiz'

// /events/view?id=N for a user or member: one event — its date, time and room,
// what it is, and the one button that is your relationship with it. The same
// layout as a lab's sign-up page (LabIntro), with the title in the events
// page's blue.
//
//   not signed up   red RSVP, with the seats left under it (or the waitlist
//                   when it's full)
//   rsvped          green YOU'RE GOING!, click again to give the seat up
//   asked to confirm  the check-in page's "confirmation" went out and you
//                   haven't answered it: green CONFIRM MY SPOT until you do
//   offered         a spot came off the waitlist and it's held for you
//                   (src/offers.js): green ACCEPT MY SPOT, or turn it down
//   waitlisted      yellow YOU'RE WAITLISTED!, your place in the queue
//   started         no more sign-ups — if you hold a spot, the QR for the door
//   ended           it's happened; says whether you were there
//
// Whether an rsvp lands a seat or a waitlist place is the server's call: the
// button flips straight to "going" and the re-read corrects it.

const CLOCK_MS = 30_000
const fmtDeadline = (at) =>
	new Date(at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

function LinkButton({ onClick, children }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="
				underline
				underline-offset-2
				cursor-pointer
				hover:text-black
			"
		>
			{children}
		</button>
	)
}

export default function MemberEventView() {
	const id = useSearchParams().get('id')
	const [event, setEvent] = useState(null)
	const [error, setError] = useState(null)
	const [busy, setBusy] = useState(false)
	const [actionError, setActionError] = useState(null)
	// the flip shown while the request is out, so the click answers at once
	const [pending, setPending] = useState(null)
	const [showQr, setShowQr] = useState(false)
	// bumped on a timer so "has it started" is re-asked against the clock
	const [, setTick] = useState(0)

	const load = useCallback(async () => {
		try {
			setEvent(await eventsApi.get(id))
			setError(null)
		} catch (err) {
			setError(err.message)
		}
	}, [id])

	useEffect(() => {
		if (!id) return
		let live = true
		eventsApi
			.get(id)
			.then((row) => live && setEvent(row))
			.catch((err) => live && setError(err.message))
		return () => { live = false }
	}, [id])

	useEffect(() => {
		const timer = setInterval(() => setTick((n) => n + 1), CLOCK_MS)
		return () => clearInterval(timer)
	}, [])

	// every button is one request and a re-read
	const act = async (call, flip) => {
		if (busy) return
		setBusy(true)
		setActionError(null)
		if (flip) setPending(flip)
		try {
			await call()
			await load()
		} catch (err) {
			setActionError(err.message)
		} finally {
			setPending(null)
			setBusy(false)
		}
	}

	let body = null
	if (!id) {
		body = <Message>No event picked — head back to the events page and choose one.</Message>
	} else if (error && !event) {
		body = <Message>{error}</Message>
	} else if (event) {
		const mine = pending ?? event.mine
		const going = mine === 'rsvped'
		const waitlisted = mine === 'waitlisted'
		const offered = mine === 'offered'
		const holding = going || waitlisted || offered
		const ended = isoDate(event.date) < today()
		const unlimited = event.capacity == null
		const left = unlimited ? Infinity : Math.max(0, event.capacity - event.taken)

		const rsvp = () => act(() => eventsApi.rsvp(event.eventId), 'rsvped')
		const leave = () => act(() => eventsApi.unrsvp(event.eventId), 'none')
		const confirm = () => act(() => eventsApi.confirm(event.eventId))

		let button = null
		let caption = null
		if (mine === 'attended') {
			caption = ended ? 'you were there — thanks for coming!' : 'you’re checked in — enjoy!'
		} else if (ended) {
			caption = mine === 'absent' ? 'this event has happened — we missed you!' : 'this event has already happened'
		} else if (event.started) {
			if (going || offered) {
				button = <ShowQrButton onClick={() => setShowQr(true)} />
				caption = 'it’s on! show your QR code at the door to check in'
			} else if (waitlisted) {
				caption = 'it’s started — if there’s room, an officer can let you in at the door'
			} else {
				caption = 'this event has already started'
			}
		} else if (going && event.confirmPending) {
			button = <ChunkyButton tone="green" onClick={confirm} disabled={busy}>CONFIRM MY SPOT</ChunkyButton>
			caption = (
				<>
					{`please confirm you're still coming${event.confirmBy ? ` by ${fmtDeadline(event.confirmBy)}` : ''}, or your spot may go to the waitlist`}
					<br />
					<LinkButton onClick={leave}>I can&apos;t make it — give up my spot</LinkButton>
				</>
			)
		} else if (going) {
			button = <ChunkyButton tone="green" onClick={leave} disabled={busy}>YOU&apos;RE GOING!</ChunkyButton>
			caption = 'click again to cancel your rsvp'
		} else if (offered) {
			button = <ChunkyButton tone="green" onClick={rsvp} disabled={busy}>ACCEPT MY SPOT</ChunkyButton>
			caption = (
				<>
					a spot opened up and it&apos;s being held for you
					<br />
					<LinkButton onClick={leave}>no thanks, give it to the next person</LinkButton>
				</>
			)
		} else if (waitlisted) {
			const away = event.waitlistPosition
			button = <ChunkyButton tone="yellow" onClick={leave} disabled={busy}>YOU&apos;RE WAITLISTED!</ChunkyButton>
			caption = (
				<>
					we&apos;ll email you if a spot opens up
					{away != null && (
						<>
							<br />
							you&apos;re currently: {away} {away === 1 ? 'spot' : 'spots'} away
						</>
					)}
					<br />
					click again to leave the waitlist
				</>
			)
		} else {
			button = <ChunkyButton tone="red" onClick={rsvp} disabled={busy}>RSVP</ChunkyButton>
			if (!unlimited) caption = left > 0
				? `${left}/${event.capacity} spots left!`
				: 'it’s full — rsvping puts you on the waitlist'
		}

		body = (
			<div className="
				lg:min-h-full
				flex
				flex-col
				justify-center
				lg:pb-[26px]
			">
				<Scaled className="
					lg:pl-[48px]
					lg:pr-[16px]
				">
					<LabIntro lab={event} accent="text-blue">
						{event.category?.name && (
							<p className="
								mt-4
								inline-block
								rounded-full
								bg-blue-light/60
								px-3
								py-1
								font-vietnam
								font-semibold
								text-[12px]
								uppercase
								tracking-[0.12em]
								text-blue-med
							">
								{event.category.name}
							</p>
						)}
						<div className="
							flex
							flex-col
							items-center
							mt-[50px]
						">
							{button}
							{caption && <ButtonCaption>{caption}</ButtonCaption>}
							{holding && !event.started && !ended && event.confirmedAt && (
								<ButtonCaption>spot confirmed ✓</ButtonCaption>
							)}
							{actionError && (
								<p className="
									font-vietnam
									text-sm
									text-salmon-dark
									text-center
									mt-2
								">
									{actionError}
								</p>
							)}
						</div>
					</LabIntro>
				</Scaled>
			</div>
		)
	}

	return (
		<DashboardShell className="
			lg:-mt-8
			lg:-mb-8
			lg:-mr-8
			lg:py-8
			lg:pr-8
		">
			<BackButton href="/events" label="Back to events" />
			{body}
			{showQr && (
				<QrPopup
					note="Show this to an officer at the door to check in."
					onClose={() => setShowQr(false)}
				/>
			)}
		</DashboardShell>
	)
}

function Message({ children }) {
	return (
		<p className="
			font-vietnam
			text-[15px]
			text-black/[0.53]
			text-center
			mt-20
		">
			{children}
		</p>
	)
}
