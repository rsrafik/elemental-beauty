'use client'

import { useEffect, useState } from 'react'
import { calendar as calendarApi } from '@/lib/api'
import { STAFF_TRACKS } from '@/lib/calendar'
import { Popup, PopupButton } from '@/components/labs/LabViewParts'

// "Subscribe" under the calendar's colour key: the club's calendar in their
// own Google Calendar, as a live feed (src/routes/calendarRoutes.js).
//
// The popup lists the tracks their role can see as the key's own pills —
// filled is in, hollow is out — and "export" saves the picks and sends them to
// Google's "add this calendar?" screen. After that the button reads "edit
// calendar": the same popup on their saved picks, where "save" changes what
// their existing Google calendar shows. The feed's address never changes, so
// nothing new is added on Google's side.
//
// Which tracks are offered is the server's answer (`available`), not worked
// out here — it's the one that decides what the feed holds.
//
// Used by both calendars: <SubscribeCalendar /> renders the button and, when
// it's open, the popup.

const same = (a, b) => a.length === b.length && a.every((track) => b.includes(track))

export default function SubscribeCalendar({ className = '' }) {
	const [state, setState] = useState(null)
	const [open, setOpen] = useState(false)

	useEffect(() => {
		let live = true
		calendarApi.subscription().then((reply) => { if (live) setState(reply) }).catch(() => {})
		return () => { live = false }
	}, [])

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className={`
					group
					inline-flex
					items-center
					gap-2.5
					rounded-full
					border
					border-black/70
					pl-2.5
					pr-4
					py-1.5
					font-vietnam
					font-semibold
					text-xs
					uppercase
					tracking-[0.12em]
					text-black
					cursor-pointer
					transition-all
					duration-200
					ease-out
					hover:-translate-y-0.5
					hover:shadow-lg
					hover:shadow-black/10
					active:translate-y-0
					active:shadow-none
					${className}
				`}
			>
				<CalendarApps />
				{state?.subscribed ? 'edit calendar' : 'subscribe'}
			</button>

			{open && (
				<SubscribePopup
					initial={state}
					onChange={setState}
					onClose={() => setOpen(false)}
				/>
			)}
		</>
	)
}

function SubscribePopup({ initial, onChange, onClose }) {
	// the server's answer; reloaded on open so a role change since the page
	// loaded is what's offered
	const [state, setState] = useState(initial)
	const [picked, setPicked] = useState(initial?.tracks ?? [])
	const [busy, setBusy] = useState(false)
	// saved, and about to close
	const [saved, setSaved] = useState(false)
	const [status, setStatus] = useState(null) // { error?, text }
	const [loadError, setLoadError] = useState(null)
	// Google only adds a calendar by link on a computer; a phone gets its own
	// calendar app's link instead
	// (the popup only ever renders after a click, so window is there)
	const [phone] = useState(() => window.matchMedia?.('(pointer: coarse)').matches ?? false)

	useEffect(() => {
		let live = true
		calendarApi.subscription()
			.then((reply) => {
				if (!live) return
				setState(reply)
				setPicked(reply.tracks)
				onChange(reply)
			})
			.catch((err) => { if (live) setLoadError(err.message) })
		return () => { live = false }
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const subscribed = state?.subscribed ?? false
	const available = state?.available ?? []
	const changed = state ? !same(picked, state.tracks) : false
	const ready = Boolean(state) && picked.length > 0 && !busy && (!subscribed || changed)

	const toggle = (track) =>
		setPicked((prev) => (prev.includes(track) ? prev.filter((t) => t !== track) : [...prev, track]))
	const allOn = available.length > 0 && available.every((track) => picked.includes(track))

	// Saves the picks (marking it exported) and hands back the reply.
	const save = async () => {
		const reply = await calendarApi.save(available.filter((track) => picked.includes(track)))
		setState(reply)
		setPicked(reply.tracks)
		onChange(reply)
		return reply
	}

	// First time: off to Google. The tab is opened on the click itself — a
	// window opened after the save comes back would be stopped as a popup —
	// and pointed at Google once the save lands, or closed if it doesn't.
	const exportToGoogle = async (dismiss) => {
		if (!ready) return
		const tab = window.open('', '_blank')
		setBusy(true)
		setStatus(null)
		try {
			const reply = await save()
			if (tab) tab.location.assign(reply.googleUrl)
			else window.location.assign(reply.googleUrl)
			dismiss(onClose)
		} catch (err) {
			tab?.close()
			setStatus({ error: true, text: err.message })
			setBusy(false)
		}
	}

	// Already in their Google calendar: saving is all it takes.
	const saveChanges = async (dismiss) => {
		if (!ready) return
		setBusy(true)
		setStatus(null)
		try {
			await save()
			setSaved(true)
			setStatus({ text: 'Saved. Google picks this up on its next refresh, usually within a few hours (up to a day)' })
			setTimeout(() => dismiss(onClose), 2200)
		} catch (err) {
			setStatus({ error: true, text: err.message })
			setBusy(false)
		}
	}

	// On a phone: the webcal link, which the phone's own calendar app opens.
	const addOnPhone = async () => {
		if (!picked.length || busy) return
		setBusy(true)
		setStatus(null)
		try {
			const reply = !subscribed || changed ? await save() : state
			window.location.assign(reply.webcalUrl)
		} catch (err) {
			setStatus({ error: true, text: err.message })
		}
		setBusy(false)
	}

	// For Apple Calendar or Outlook. The feed only has anything on it once the
	// picks are saved, so a first copy saves them too.
	const copy = async () => {
		if (!picked.length || busy) return
		setStatus(null)
		try {
			const reply = !subscribed || changed ? await save() : state
			await navigator.clipboard.writeText(reply.url)
			setStatus({ text: 'Link copied. Paste it wherever your calendar app asks for a calendar by URL' })
		} catch (err) {
			setStatus({ error: true, text: err.message || 'Couldn’t copy. Allow clipboard access and try again' })
		}
	}

	const stop = async (dismiss) => {
		setBusy(true)
		setStatus(null)
		try {
			const reply = await calendarApi.stop()
			setState(reply)
			onChange(reply)
			setStatus({ text: 'Stopped. Your calendar will empty out on its next refresh. You can also remove it from your calendar app' })
			setTimeout(() => dismiss(onClose), 3200)
		} catch (err) {
			setStatus({ error: true, text: err.message })
			setBusy(false)
		}
	}

	const lostLabels = (state?.lost ?? []).map((track) => STAFF_TRACKS[track]?.label ?? track)

	return (
		<Popup title={subscribed ? 'edit calendar' : 'subscribe'} label={subscribed ? 'Edit calendar' : 'Subscribe to calendar'} onClose={onClose}>
			{(dismiss) => (
				<>
					<p className="
						font-vietnam
						text-sm
						text-black/60
						mt-3
					">
						{subscribed
							? 'What shows in your Google Calendar. Changes reach the calendar you already added, so there’s nothing to add again.'
							: 'Pick what goes on your Google Calendar. It stays in sync: new and changed events show up on their own.'}
					</p>

					{loadError && (
						<p role="alert" className="mt-4 font-vietnam font-semibold text-sm text-salmon-dark">
							{loadError}
						</p>
					)}

					{!state && !loadError && (
						<p className="mt-6 font-vietnam text-sm text-black/45">loading…</p>
					)}

					{state && (
						<>
							<div className="
								mt-5
								flex
								flex-wrap
								gap-2
							">
								{available.map((track) => (
									<TrackPill
										key={track}
										track={track}
										on={picked.includes(track)}
										onToggle={() => toggle(track)}
									/>
								))}
							</div>

							<button
								type="button"
								onClick={() => setPicked(allOn ? [] : available)}
								className="
									mt-2
									font-vietnam
									text-sm
									text-black/45
									cursor-pointer
									transition-colors
									duration-150
									hover:text-black/70
								"
							>
								{allOn ? 'select none' : 'select all'}
							</button>

							{lostLabels.length > 0 && (
								<p className="mt-3 font-vietnam text-sm text-black/60">
									{lostLabels.join(', ')} {lostLabels.length === 1 ? 'isn’t' : 'aren’t'} open to your role any more, so {lostLabels.length === 1 ? 'it’s' : 'they’re'} off your calendar.
								</p>
							)}

							{phone && (
								<p className="mt-3 font-vietnam text-sm text-black/60">
									Google only adds calendars by link on a computer. On this phone,{' '}
									<button
										type="button"
										onClick={addOnPhone}
										disabled={!picked.length || busy}
										className="font-semibold text-black underline underline-offset-2 cursor-pointer disabled:opacity-40"
									>
										add it to this phone’s calendar
									</button>{' '}
									instead.
								</p>
							)}
						</>
					)}

					{status && (
						<p
							role="status"
							className={`
								mt-4
								font-vietnam
								font-semibold
								text-sm
								${status.error ? 'text-salmon-dark' : 'text-green-dark'}
							`}
						>
							{status.text}
						</p>
					)}

					<div className="
						mt-6
						flex
						flex-wrap
						items-center
						justify-end
						gap-3
					">
						<PopupButton onClick={() => dismiss(onClose)}>cancel</PopupButton>
						<PopupButton
							primary
							disabled={!ready}
							onClick={() => (subscribed ? saveChanges(dismiss) : exportToGoogle(dismiss))}
						>
							{saved ? 'saved' : busy ? 'saving…' : subscribed ? 'save' : 'export'}
						</PopupButton>
					</div>

					{state && (
						<div className="
							mt-6
							pt-4
							border-t
							border-black/10
							font-vietnam
							text-sm
							text-black/55
							space-y-2
						">
							<p className="flex flex-wrap gap-x-4 gap-y-1">
								{subscribed && (
									<a
										href={state.googleUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="font-semibold underline underline-offset-2 hover:text-black"
									>
										open in Google Calendar again
									</a>
								)}
								<button
									type="button"
									onClick={copy}
									disabled={!picked.length || busy}
									className="font-semibold underline underline-offset-2 cursor-pointer hover:text-black disabled:opacity-40 disabled:cursor-not-allowed"
								>
									copy link (Apple, Outlook)
								</button>
								{subscribed && (
									<button
										type="button"
										onClick={() => stop(dismiss)}
										disabled={busy}
										className="font-semibold underline underline-offset-2 cursor-pointer hover:text-salmon-dark disabled:opacity-40"
									>
										stop syncing
									</button>
								)}
							</p>
						</div>
					)}
				</>
			)}
		</Popup>
	)
}

// The colour key's pill, as a choice: filled with a tick when it's in, the
// hollow outline when it's out — the same look the key uses for on and off.
function TrackPill({ track, on, onToggle }) {
	const look = STAFF_TRACKS[track]
	if (!look) return null
	return (
		<button
			type="button"
			role="checkbox"
			aria-checked={on}
			onClick={onToggle}
			className={`
				inline-flex
				items-center
				gap-1.5
				rounded-full
				px-4
				py-1.5
				font-vietnam
				font-semibold
				text-xs
				uppercase
				tracking-[0.12em]
				cursor-pointer
				transition-colors
				duration-200
				ease-out
				${on ? look.pill : `bg-transparent ring-2 ring-inset ${look.hollow}`}
			`}
		>
			{on && <CheckIcon className="w-3 h-3" />}
			{look.label}
		</button>
	)
}

function CheckIcon({ className = '' }) {
	return (
		<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
			<path d="M3 8.5l3.2 3L13 4.5" />
		</svg>
	)
}

// The three calendars it can go into, as a little fanned stack on the
// button's left: Google, Apple and Outlook, each tipped a few degrees and
// tucked under the next. Hovering the button spreads them a touch.
function CalendarApps() {
	return (
		<span aria-hidden="true" className="
			inline-flex
			items-center
			-my-1
			pl-0.5
		">
			<span className="
				relative
				z-0
				-rotate-12
				transition-transform
				duration-200
				ease-out
				group-hover:-rotate-[18deg]
				group-hover:-translate-x-0.5
			">
				<GoogleCalendarIcon />
			</span>
			<span className="
				relative
				z-10
				-ml-1.5
				-rotate-2
				transition-transform
				duration-200
				ease-out
				group-hover:-translate-y-0.5
			">
				<AppleCalendarIcon />
			</span>
			<span className="
				relative
				z-20
				-ml-1.5
				rotate-12
				transition-transform
				duration-200
				ease-out
				group-hover:rotate-[18deg]
				group-hover:translate-x-0.5
			">
				<OutlookIcon />
			</span>
		</span>
	)
}

// each tile is 20px with a soft shadow, so the one on top reads over the one
// it overlaps
const TILE = 'block w-5 h-5 drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.28)]'

function GoogleCalendarIcon() {
	return (
		<svg viewBox="0 0 24 24" className={TILE}>
			<rect x="1" y="1" width="22" height="22" rx="4" fill="#fff" />
			{/* the coloured frame: blue top, yellow left, green bottom, red corner */}
			<path d="M5 1h14a4 4 0 0 1 4 4v1H1V5a4 4 0 0 1 4-4z" fill="#4285F4" />
			<path d="M1 6h4.5v12.5H1z" fill="#FBBC04" />
			<path d="M1 18.5h17.5V23H5a4 4 0 0 1-4-4z" fill="#34A853" />
			<path d="M18.5 18.5H23L18.5 23z" fill="#EA4335" />
			<path d="M18.5 6H23v12.5h-4.5z" fill="#1A73E8" />
			<text x="12" y="16.3" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontWeight="700" fontSize="8.5" fill="#1A73E8">31</text>
		</svg>
	)
}

function AppleCalendarIcon() {
	return (
		<svg viewBox="0 0 24 24" className={TILE}>
			<rect x="1" y="1" width="22" height="22" rx="5" fill="#fff" />
			<text x="12" y="8" textAnchor="middle" fontFamily="-apple-system, Helvetica, Arial, sans-serif" fontWeight="700" fontSize="4.6" letterSpacing="0.3" fill="#FF3B30">WED</text>
			<text x="12" y="19.5" textAnchor="middle" fontFamily="-apple-system, Helvetica, Arial, sans-serif" fontWeight="400" fontSize="11.5" fill="#1C1C1E">17</text>
		</svg>
	)
}

function OutlookIcon() {
	return (
		<svg viewBox="0 0 24 24" className={TILE}>
			<rect x="1" y="1" width="22" height="22" rx="4" fill="#0F78D4" />
			{/* the envelope behind, and the "O" tile in front */}
			<path d="M10 6.5h10a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10z" fill="#50A9F0" />
			<path d="M10 7.5l5.5 4 5.5-4" fill="none" stroke="#0F78D4" strokeWidth="1.1" />
			<rect x="3" y="5" width="11" height="14" rx="1.6" fill="#0A5299" />
			<ellipse cx="8.5" cy="12" rx="2.9" ry="3.6" fill="none" stroke="#fff" strokeWidth="1.8" />
		</svg>
	)
}
