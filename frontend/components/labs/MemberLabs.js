'use client'

import { useState } from 'react'
import DashboardShell from '@/components/dashboards/DashboardShell'

// /labs for a user or member: browse upcoming labs, RSVP, look back at the
// ones they've attended.
//
// Two panels stacked on top of each other, both bleeding off the right edge of
// the screen: "upcoming" sits underneath, "current" slides over it. Each panel
// keeps a TAB_W strip on its left edge for the vertical tab, so whichever panel
// is hidden still has a handle sticking out — tapping "upcoming" slides the
// current panel off to the right, tapping "current" brings it back.
//
// Both panels render the same LabCard. The only thing that changes between
// sections is the little status icon in the bottom-right corner, so that's the
// one piece a section hands in.

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

// ---- icons -----------------------------------------------------------------

function LockIcon({ className = '' }) {
	return (
		<svg
			viewBox="0 0 24 24"
			className={className}
			aria-hidden="true"
		>
			<path
				d="M8 10.5V7a4 4 0 0 1 8 0v3.5"
				fill="none"
				stroke="currentColor"
				strokeWidth="2.5"
				strokeLinecap="round"
			/>
			<rect x="4" y="10" width="16" height="11" rx="3" fill="currentColor" />
		</svg>
	)
}

function CalendarIcon({ className = '' }) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			<path d="M21 12.5V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6.5" />
			<path d="M8 3v4" />
			<path d="M16 3v4" />
			<path d="M3 10h18" />
			<path d="M20.5 18a3.5 3.5 0 1 1-1-2.4" />
			<path d="M19.5 13.2v2.6h-2.6" />
		</svg>
	)
}

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

// Status -> corner icon, per section. The card doesn't know about any of this;
// each panel looks its own statuses up here and passes the node down.
const ICON_CLASS = `
	w-6
	h-6
	transition-transform
	duration-200
	ease-out
	group-hover:scale-110
`

const currentIcons = {
	// check-in closed for the day
	locked: <LockIcon className={`${ICON_CLASS} text-red`} />,
	// check-in open — tap the lab to scan in
	open: <CalendarIcon className={`${ICON_CLASS} text-blue`} />,
}

// The upcoming section has no status icon — it gets the rsvp button instead.

// Its own centered row along the bottom of an upcoming card.
//
// `waitlist` means every seat is already spoken for, so a seat taken here sits
// past the cap — the lab still accepts you, the counter just runs over (21/20).
// Nothing is ever disabled: a full lab offers the waitlist instead.
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

// Placeholder rows until /labs is wired to the API. `image` is a path under
// public/ — cards fall back to a blank tile while those don't exist yet.
const current = [
	{ id: 1, title: 'Bronzer', date: 'August 30, 2026', image: null, status: 'locked' },
	{ id: 2, title: 'Lipstick', date: 'August 30, 2026', image: null, status: 'locked' },
	{ id: 3, title: 'Lip Gloss', date: 'August 30, 2026', image: null, status: 'open' },
	{ id: 4, title: 'Bronzer', date: 'August 30, 2026', image: null, status: 'locked' },
	{ id: 5, title: 'Lipstick', date: 'August 30, 2026', image: null, status: 'locked' },
	{ id: 6, title: 'Lip Gloss', date: 'August 30, 2026', image: null, status: 'open' },
]

// `taken` / `capacity` are the rsvp count and the seat cap. Only the upcoming
// labs carry them — a lab that's already running has nothing left to sign up
// for, so its cards leave the counter off. `taken` counts everyone but you;
// your own seat comes from `going`, so the count moves when you tap rsvp.
const upcoming = [
	{ id: 7, title: 'Blush', date: 'September 6, 2026', image: null, taken: 0, capacity: 20, going: false },
	{ id: 8, title: 'Highlighter', date: 'September 13, 2026', image: null, taken: 11, capacity: 20, going: true },
	{ id: 9, title: 'Body Butter', date: 'September 20, 2026', image: null, taken: 3, capacity: 15, going: false },
	{ id: 10, title: 'Lip Scrub', date: 'September 27, 2026', image: null, taken: 20, capacity: 20, going: false },
]

// ---- pieces ----------------------------------------------------------------

// `availability` is optional: pass it and it rides on the title's line, pinned
// to the right edge of the card. Sections that have no seat count (a lab that's
// already running) just leave it out and the title takes the full width.
//
// The card itself doesn't navigate anywhere — the only thing to click on one is
// its `action` (the rsvp button). The current section passes a plain `icon`
// instead, which is a status marker, not a control.
function LabCard({ title, date, image, icon, action, availability }) {
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
				bg-salmon-lightest
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

			{/* two full-width lines rather than one text column beside the icon, so
			    the seat count and the icon both land on the card's right edge */}
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
							text-salmon-med
							text-sm
							shrink-0
							whitespace-nowrap
							mr-2
						">
							{availability}
						</span>
					)}
				</div>

				{/* date line: the icon is the one bit that differs between sections */}
				<div className="
					flex
					items-end
					justify-between
					gap-2
				">
					<p className="
						font-vietnam
						text-black/70
						text-sm
						min-w-0
						truncate
					">
						{date}
					</p>
					<span className="
						shrink-0
						mr-2
						-translate-y-2
					">
						{icon}
					</span>
				</div>

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

// 3 across, scrolls on its own once the rows run past the panel.
//
// The padding is headroom, not styling: cards lift on hover and this is a
// scroll container, so without it the top of the raised card and its shadow
// get clipped.
function LabGrid({ items, icons, renderAction }) {
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
				{items.map((lab) => (
					<LabCard
						key={lab.id}
						title={lab.title}
						date={lab.date}
						image={lab.image}
						icon={icons?.[lab.status]}
						action={renderAction?.(lab)}
						availability={
							lab.capacity == null ? null : `${lab.taken}/${lab.capacity}`
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

export default function MemberLabs() {
	const [showUpcoming, setShowUpcoming] = useState(false)

	// Which labs you're down for. Local only until /labs is wired to the API —
	// the button and the seat count both read off this, so tapping rsvp moves
	// the count with it.
	const [rsvpd, setRsvpd] = useState(
		() => new Set(upcoming.filter((lab) => lab.going).map((lab) => lab.id))
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
	const upcomingRows = upcoming.map((lab) => {
		const going = rsvpd.has(lab.id)
		return {
			...lab,
			going,
			waitlist: lab.taken >= lab.capacity,
			taken: lab.taken + (going ? 1 : 0),
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
						bg-salmon
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
						color="text-salmon-dark"
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
						<LabGrid
							items={upcomingRows}
							renderAction={(lab) => (
								<RsvpButton
									going={lab.going}
									waitlist={lab.waitlist}
									onClick={() => toggleRsvp(lab.id)}
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
						bg-salmon-light
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
						color="text-salmon-med"
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
						<LabGrid items={current} icons={currentIcons} />
					</div>
				</section>
			</div>
		</DashboardShell>
	)
}
