'use client'

import { useState } from 'react'
import DashboardShell from '@/components/dashboards/DashboardShell'

// /events for a user or member: browse what's running now and rsvp to what's
// coming up.
//
// Same two-panel stack as /labs, in blue: "upcoming" sits underneath, "current"
// slides over it. Each panel keeps a TAB_W strip on its left edge for the
// vertical tab, so whichever panel is hidden still has a handle sticking out —
// tapping "upcoming" slides the current panel off to the right, tapping
// "current" brings it back.
//
// Both panels render the same EventCard. The current cards are plain — photo,
// name and date, nothing to click. The upcoming ones carry the seat count and
// the rsvp button.

// Width of the vertical tab strip on each panel's left edge, and how long the
// slide takes. Retune the whole interaction from these two.
const TAB_W = 100
const SLIDE_MS = 550

// Hovering the tab of the minimized panel widens its sliver by this much, so it
// reads as being tugged out of the stack. It's the same transform that does the
// full slide, so the hover carries its own (much shorter) duration.
const PEEK = 5
const PEEK_MS = 200

// The panels live in an overflow-hidden box (that's what swallows the current
// panel as it slides off to the right), which would also chop off the drop
// shadow the back panel casts to its left. So both panels start this far in
// from the box's left edge, leaving the shadow somewhere to land.
const SHADOW_ROOM = 16

// ---- pieces ----------------------------------------------------------------

function CheckIcon({ className = '' }) {
	return (
		<svg
			viewBox="0 0 24 24"
			className={className}
			aria-hidden="true"
		>
			<circle cx="12" cy="12" r="9" fill="currentColor" />
			<path
				d="M8 12.3l2.7 2.7L16 9.5"
				fill="none"
				stroke="white"
				strokeWidth="2.2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
}

// Its own centered row along the bottom of an upcoming card.
//
// `waitlist` means every seat is already spoken for, so a seat taken here sits
// past the cap — the event still accepts you, the counter just runs over
// (21/20). Nothing is ever disabled: a full event offers the waitlist instead.
function RsvpButton({ going, waitlist, onClick }) {
	const label = going
		? waitlist ? 'waitlisted' : 'going'
		: waitlist ? 'waitlist' : 'rsvp'
	const tone = waitlist
		? 'bg-yellow text-black hover:brightness-95'
		: going
			? 'bg-green text-green-dark hover:brightness-95'
			: 'bg-blue text-white hover:brightness-105'
	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={going}
			className={`
				relative
				flex
				items-center
				justify-center
				gap-1
				min-w-[110px]
				rounded-full
				px-4
				py-1.5
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
				active:translate-y-0
				active:shadow-none
				${tone}
			`}
		>
			{going && (
				<CheckIcon className={`
					w-4
					h-4
					${waitlist ? 'text-yellow-dark' : 'text-green-dark'}
				`} />
			)}
			{label}
		</button>
	)
}

// ---- data ------------------------------------------------------------------

// Placeholder rows until /events is wired to the API. `image` is a path under
// public/ — cards fall back to a blank tile while those don't exist yet.
const current = [
	{ id: 1, title: 'Vendor Pop-Up', date: 'August 30, 2026', image: null },
	{ id: 2, title: 'Glow Social', date: 'August 30, 2026', image: null },
	{ id: 3, title: 'Sunset Picnic', date: 'August 31, 2026', image: null },
	{ id: 4, title: 'Vendor Pop-Up', date: 'September 1, 2026', image: null },
	{ id: 5, title: 'Glow Social', date: 'September 1, 2026', image: null },
	{ id: 6, title: 'Sunset Picnic', date: 'September 2, 2026', image: null },
]

// `taken` / `capacity` are the rsvp count and the seat cap. Only the upcoming
// events carry them — one that's already running has nothing left to sign up
// for, so its cards leave the counter off. `taken` counts everyone but you;
// your own seat comes from `going`, so the count moves when you tap rsvp.
const upcoming = [
	{ id: 7, title: 'Fall Formal', date: 'September 6, 2026', image: null, taken: 0, capacity: 20, going: false },
	{ id: 8, title: 'Volunteer Day', date: 'September 13, 2026', image: null, taken: 11, capacity: 20, going: true },
	{ id: 9, title: 'Sip & Swatch', date: 'September 20, 2026', image: null, taken: 3, capacity: 15, going: false },
	{ id: 10, title: 'Winter Market', date: 'September 27, 2026', image: null, taken: 20, capacity: 20, going: false },
]

// ---- card ------------------------------------------------------------------

// `availability` is optional: pass it and it rides on the title's line, pinned
// to the right edge of the card. The current section has no seat count and no
// action, so its cards are just the photo, the name and the date.
function EventCard({ title, date, image, action, availability }) {
	return (
		<div
			className="
				group
				relative
				bg-white
				rounded-[10px]
				p-3
				pb-4
				shadow-[0_4px_10px_rgba(0,0,0,0.15)]
				transition-all
				duration-200
				ease-out
				hover:-translate-y-1
				hover:shadow-[-5px_5px_5px_rgba(0,0,0,0.5)]
				active:translate-y-0
				active:shadow-[0_4px_10px_rgba(0,0,0,0.15)]
			"
		>
			<div className="
				aspect-[4/3]
				w-full
				overflow-hidden
				rounded-[10px]
				bg-blue-light/50
			">
				{image && (
					<img
						src={image}
						alt=""
						className="
							w-full
							h-full
							object-cover
							select-none
						"
					/>
				)}
			</div>

			<div className="mt-3">
				{/* title line: name on the left, seats left on the right */}
				<div className="
					flex
					items-baseline
					justify-between
					gap-2
				">
					{/* truncate, so a long one-word name gives way to the count
					    instead of running underneath it */}
					<p className="
						font-vietnam
						font-semibold
						text-black
						text-[17px]
						leading-tight
						min-w-0
						truncate
					">
						{title}
					</p>
					{availability && (
						<span className="
							font-vietnam
							font-semibold
							text-blue-med
							text-sm
							shrink-0
							whitespace-nowrap
							mr-2
						">
							{availability}
						</span>
					)}
				</div>

				<p className="
					font-vietnam
					text-black/70
					text-sm
					mt-1
					truncate
				">
					{date}
				</p>

				{/* an action gets its own centered row under the date, so the card can
				    grow downward instead of fighting the date for the corner */}
				{action && (
					<div className="
						mt-3
						flex
						justify-center
					">
						{action}
					</div>
				)}
			</div>
		</div>
	)
}

// 4 across, scrolls on its own once the rows run past the panel.
//
// The padding is headroom, not styling: cards lift on hover and this is a
// scroll container, so without it the top of the raised card and its shadow
// get clipped.
function EventGrid({ items, renderAction }) {
	return (
		<div className="
			flex-1
			min-h-0
			overflow-y-auto
			p-3
		">
			<div className="
				grid
				grid-cols-4
				gap-5
			">
				{items.map((event) => (
					<EventCard
						key={event.id}
						title={event.title}
						date={event.date}
						image={event.image}
						action={renderAction?.(event)}
						availability={
							event.capacity == null
								? null
								: `${event.taken}/${event.capacity}`
						}
					/>
				))}
			</div>
		</div>
	)
}

// The vertical handle on a panel's left edge. `hidden` parks it (faded, not
// clickable) for the panel that's currently on top of the stack.
//
// `onPeek(true/false)` fires as the pointer (or keyboard focus) arrives and
// leaves, so the page can nudge the stack open by PEEK px.
function SideTab({ label, onClick, onPeek, color, hidden = false }) {
	return (
		<button
			type="button"
			onClick={onClick}
			onMouseEnter={() => onPeek?.(true)}
			onMouseLeave={() => onPeek?.(false)}
			onFocus={() => onPeek?.(true)}
			onBlur={() => onPeek?.(false)}
			aria-hidden={hidden}
			tabIndex={hidden ? -1 : 0}
			className={`
				group
				shrink-0
				flex
				items-center
				justify-center
				h-full
				cursor-pointer
				transition-opacity
				duration-300
				ease-out
				${hidden ? 'opacity-0 pointer-events-none' : 'opacity-100'}
			`}
			style={{ width: `${TAB_W}px` }}
		>
			<span className={`
				font-vietnam
				text-[22px]
				[writing-mode:vertical-rl]
				rotate-180
				transition-transform
				duration-200
				ease-out
				group-hover:-translate-y-1
				${color}
			`}>
				{label}
			</span>
		</button>
	)
}

function PanelHeading({ children }) {
	return (
		<h1 className="
			font-canobis
			[-webkit-text-stroke:2px_black]
			text-black
			text-[45px]
			text-center
			pt-15
			pb-5
			select-none
		">
			{children}
		</h1>
	)
}

// ---- page ------------------------------------------------------------------

export default function MemberEvents() {
	const [showUpcoming, setShowUpcoming] = useState(false)

	// Which events you're down for. Local only until /events is wired to the
	// API — the button and the seat count both read off this, so tapping rsvp
	// moves the count with it.
	const [rsvpd, setRsvpd] = useState(
		() => new Set(upcoming.filter((event) => event.going).map((event) => event.id))
	)

	const toggleRsvp = (id) =>
		setRsvpd((prev) => {
			const next = new Set(prev)
			next.has(id) ? next.delete(id) : next.add(id)
			return next
		})

	// `taken` in the data leaves you out, so add your own seat back in here.
	// Everyone else already filling the cap means your seat is a waitlist one,
	// which is what tips the count past the cap (21/20).
	const upcomingRows = upcoming.map((event) => {
		const going = rsvpd.has(event.id)
		return {
			...event,
			going,
			waitlist: event.taken >= event.capacity,
			taken: event.taken + (going ? 1 : 0),
		}
	})

	// Both the slide and the hover peek move the same panel, so they share one
	// transform — and the duration rides along with whichever one set it, so a
	// 5px tug doesn't crawl for SLIDE_MS.
	const [peeking, setPeeking] = useState(false)
	const [slideMs, setSlideMs] = useState(SLIDE_MS)

	const swap = (next) => {
		setSlideMs(SLIDE_MS)
		setPeeking(false)
		setShowUpcoming(next)
	}

	const peek = (on) => {
		setSlideMs(PEEK_MS)
		setPeeking(on)
	}

	// The peek moves the minimized panel only — the one on top of the stack
	// holds still. Closed, that's the upcoming panel leaning out to the left;
	// open, it's the current panel stepping back in from the right edge.
	const upcomingNudge = !showUpcoming && peeking ? -PEEK : 0
	const currentNudge = showUpcoming && peeking ? PEEK : 0

	return (
		<DashboardShell className="
			relative
			-my-8
			-mr-8
			ml-20
		">
			<div className="
				absolute
				inset-0
				overflow-hidden
			">
				{/* back panel: upcoming */}
				<section
					className="
						absolute
						inset-y-0
						right-0
						bg-blue
						rounded-tl-[60px]
						rounded-bl-[60px]
						shadow-[-5px_1px_4px_rgba(0,0,0,0.7)]
						flex
						transition-transform
						ease-out
					"
					style={{
						left: `${SHADOW_ROOM}px`,
						transitionDuration: `${PEEK_MS}ms`,
						transform: `translateX(${upcomingNudge}px)`,
					}}
				>
					<SideTab
						label="upcoming"
						onClick={() => swap(true)}
						onPeek={peek}
						color="text-white"
						hidden={showUpcoming}
					/>

					{/* the parked "current" tab sits over this panel's right edge once
					    it slides away, so keep TAB_W (plus a little air) clear of cards */}
					<div
						className="
							flex-1
							min-w-0
							flex
							flex-col
							pb-8
						"
						style={{ paddingRight: `${TAB_W + 40}px` }}
					>
						<PanelHeading>UPCOMING</PanelHeading>
						<EventGrid
							items={upcomingRows}
							renderAction={(event) => (
								<RsvpButton
									going={event.going}
									waitlist={event.waitlist}
									onClick={() => toggleRsvp(event.id)}
								/>
							)}
						/>
					</div>
				</section>

				{/* front panel: current — slides right to uncover the one behind it */}
				<section
					className="
						absolute
						inset-y-0
						right-0
						bg-blue-light
						rounded-tl-[60px]
						rounded-bl-[60px]
						flex
						shadow-[-5px_1px_4px_rgba(0,0,0,0.5)]
						transition-transform
						ease-out
					"
					style={{
						left: `${TAB_W + SHADOW_ROOM}px`,
						transitionDuration: `${slideMs}ms`,
						transform: showUpcoming
							? `translateX(calc(100% - ${TAB_W + currentNudge}px))`
							: 'translateX(0)',
					}}
				>
					<SideTab
						label="current"
						onClick={() => swap(false)}
						onPeek={peek}
						color="text-blue-med"
						hidden={!showUpcoming}
					/>

					<div className="
						flex-1
						min-w-0
						flex
						flex-col
						pr-10
						pb-8
					">
						<PanelHeading>CURRENT</PanelHeading>
						<EventGrid items={current} />
					</div>
				</section>
			</div>
		</DashboardShell>
	)
}
