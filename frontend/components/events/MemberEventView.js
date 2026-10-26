'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import DashboardShell from '@/components/dashboards/DashboardShell'
import { events as eventsApi } from '@/lib/api'
import { isoDate, today } from '@/lib/dates'
import { BackButton, FitScaled, LabIntro, ChunkyButton, ButtonCaption, DuesNotice, LeavePopup, PayToHold } from '@/components/labs/LabViewParts'
import { ShowQrButton, QrPopup } from '@/components/labs/MemberLabQuiz'
import { LinkList } from '@/components/events/EventLinks'
import PaySection from '@/components/payments/PaySection'

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
//
// The button sits under the title, description and photo, in the middle of
// the content column — as a lab's does. A members-only event with a price
// shows someone holding a spot who hasn't paid the year's dues how to pay
// before they come (PaySection), and warns anyone else what it'll cost
// (DuesNotice). Its links sit under the photo.
//
// `preview` is the advisor's "view content" (/events/preview, from the dots on
// /events): the same page a VIP gets — photo, date, description, category,
// links — with the button and everything under it left off.

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

export default function MemberEventView({ preview = false }) {
	const id = useSearchParams().get('id')
	const [event, setEvent] = useState(null)
	const [error, setError] = useState(null)
	const [busy, setBusy] = useState(false)
	const [actionError, setActionError] = useState(null)
	// the flip shown while the request is out, so the click answers at once
	const [pending, setPending] = useState(null)
	const [showQr, setShowQr] = useState(false)
	// "are you sure?" before giving up a spot
	const [askingLeave, setAskingLeave] = useState(false)
	// bumped on a timer, with a re-read, so "has it started" (or has the door
	// opened early — checkinOpen) is re-asked
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
		const timer = setInterval(() => {
			setTick((n) => n + 1)
			load()
		}, CLOCK_MS)
		return () => clearInterval(timer)
	}, [load])

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
		body = <Message>No event picked. Head back to the events page and choose one.</Message>
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
		// leaving asks first (LeavePopup, below)
		const leave = () => setAskingLeave(true)
		const confirm = () => act(() => eventsApi.confirm(event.eventId))

		let button = null
		let caption = null
		if (mine === 'attended') {
			caption = ended ? 'you were there, thanks for coming!' : 'you’re checked in, enjoy!'
		} else if (ended) {
			caption = mine === 'absent' ? 'this event already happened, and we missed you!' : 'this event has already happened'
		} else if (event.started || (event.checkinOpen && (going || offered))) {
			// the door opens at the start time, or earlier from the check-in
			// page's "start check-in" — then it's only the QR that's early
			if (going || offered) {
				button = <ShowQrButton onClick={() => setShowQr(true)} />
				caption = event.started
					? 'it’s on! show your QR code at the door to check in'
					: 'check-in is open! show your QR code at the door'
			} else if (waitlisted) {
				caption = 'it’s started, but if there’s room, an e-board member can let you in at the door'
			} else {
				caption = 'this event has already started'
			}
		} else if (going && event.confirmPending && !event.pay) {
			// someone who owes confirms by paying (PayToHold), not with this
			button = <ChunkyButton tone="green" onClick={confirm} disabled={busy}>CONFIRM MY SPOT</ChunkyButton>
			caption = (
				<>
					{`please confirm you're still coming${event.confirmBy ? ` by ${fmtDeadline(event.confirmBy)}` : ''}, or your spot may go to the waitlist`}
					<br />
					<LinkButton onClick={leave}>I can&apos;t make it, give up my spot</LinkButton>
				</>
			)
		} else if (going) {
			button = <ChunkyButton tone="green" onClick={leave} disabled={busy}>YOU&apos;RE GOING!</ChunkyButton>
			caption = 'click again to cancel your rsvp'
		} else if (offered) {
			// owing, there's nothing to press: paying below accepts it
			if (!event.pay) button = <ChunkyButton tone="green" onClick={rsvp} disabled={busy}>ACCEPT MY SPOT</ChunkyButton>
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
				: 'it’s full, so rsvping puts you on the waitlist'
		}

		body = (
			<div className="
				lg:min-h-full
				flex
				flex-col
				justify-center
				lg:pb-[26px]
			">
				{/* sized to fit the window, pay card and all (FitScaled) */}
				{/* 64px on the right keeps the photo clear of the back arrow
				    pinned in the window's corner, now the page can reach the top */}
				<FitScaled className="
					lg:pl-[48px]
					lg:pr-[64px]
				">
					<LabIntro
						lab={event}
						accent="text-blue"
						aside={<LinkList links={event.links} className="mt-4" />}
					>
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
					</LabIntro>

					{/* centred in the content column: the 48px / 64px padding on
					    Scaled above is given back, so the middle is the column's */}
					{!preview && <div className="
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
						{holding && !event.started && !ended && event.confirmedAt && (
							<ButtonCaption>spot confirmed ✓</ButtonCaption>
						)}
						{!ended && mine !== 'attended' && !(going || offered) && <DuesNotice dues={event.dues} noun="event" due={event.paymentDueAt} />}
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
						{!ended && !event.started && (going || offered) && (
							<PaySection
								place={{ eventId: event.eventId }}
								noun="event"
								hideDue={Boolean(event.pay)}
								notice={<PayToHold pay={event.pay} offered={offered} offerBy={event.offerBy} />}
								onSent={load}
							/>
						)}
					</div>}
				</FitScaled>
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
			{askingLeave && event && (
				<LeavePopup
					title={event.title}
					mine={event.mine}
					place={{ eventId: event.eventId }}
					onConfirm={() => {
						setAskingLeave(false)
						act(() => eventsApi.unrsvp(event.eventId), 'none')
					}}
					onClose={() => setAskingLeave(false)}
				/>
			)}
			{showQr && (
				<QrPopup
					note="Show this to an e-board member at the door to check in."
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
