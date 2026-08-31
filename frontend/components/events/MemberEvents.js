'use client'

import { useEffect, useMemo, useState } from 'react'
import DashboardShell from '@/components/dashboards/DashboardShell'
import { events as eventsApi } from '@/lib/api'
import { isoDate, longDate, prettyTime, today } from '@/lib/dates'

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
//
// The width is a CSS variable rather than a number because it has to shrink on
// a phone — a 100px strip out of a 390px screen is a quarter of the page spent
// on a handle. Everything that needs it reads --tab-w, so the interaction
// rescales from the one declaration on the box below without measuring the
// window. Same arrangement as /labs.
const TAB_W = 'var(--tab-w)'
const TAB_SIZES = '[--tab-w:56px] sm:[--tab-w:72px] lg:[--tab-w:100px]'
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
// `attended` is not a state of this button, it's the absence of one: once you've
// been checked in there is no RSVP left to cancel, so the card says so instead
// of offering a toggle the API would refuse.
function RsvpButton({ going, waitlist, attended, onClick }) {
	if (attended) {
		return (
			<span
				title="You were checked in to this event"
				className="
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
					bg-green
					text-green-dark
					select-none
				"
			>
				<CheckIcon className="w-4 h-4 text-green-dark" />
				attended
			</span>
		)
	}

	const label = going
		? waitlist ? 'waitlisted' : 'going'
		: waitlist ? 'waitlist' : 'rsvp'
	const tone = waitlist
		? 'bg-yellow text-black hover:brightness-95'
		: going
			? 'bg-green text-green-dark hover:brightness-95'
			: 'bg-blue text-white hover:brightness-105'
	return (
		// No busy state on the button, deliberately. The card is updated the
		// instant you click — the request that follows is a formality you should
		// never have to look at — so a spinner or a wait cursor would only ever
		// flash for a frame and read as a stutter. Double-clicks are already
		// handled in toggleRsvp, which ignores a second press while the first
		// call is still out.
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

// GET /api/events hands back every event this member is allowed to see —
// officers-only ones are filtered out server-side, not here — each with two
// extras: `taken`, the seats gone, and `mine`, this member's own attendance row
// (null when they have nothing to do with it).
//
// One list in state, both panels derived from it. That's what makes an RSVP
// show up in "current" the instant you press the button: the same row feeds
// both sides, so patching `mine` moves the card without a second request.
function toCard(event) {
	return {
		id: event.eventId,
		title: event.title,
		// kept as 'YYYY-MM-DD' so it compares against today as plain text; the
		// time rides along separately and the card joins them for display
		date: isoDate(event.date),
		time: event.startTime ?? '',
		image: event.image,
		taken: event.taken,
		capacity: event.capacity,
		mine: event.mine,
	}
}

// Which panel an event belongs to. No icons here — unlike a lab there's nothing
// to check into, so the current cards are just the photo, the name and the date.
//
//   current   anything that is yours or has happened: an event you're confirmed
//             for, one running today, and every one already past. A waitlist
//             place is NOT yours yet, so it doesn't qualify.
//   upcoming  everything still ahead, whether or not you're going — it's the
//             browse-and-sign-up side, and one you've joined stays on it so you
//             can still change your mind.
function panels(rows) {
	const now = today()
	const current = []
	const upcoming = []

	for (const event of rows) {
		const isToday = event.date === now
		const past = event.date < now
		// a confirmed seat. 'waitlisted' deliberately isn't one — you don't have
		// a place until somebody drops out
		const going = event.mine === 'rsvped' || event.mine === 'attended'

		// Listed field by field rather than pushing the row: a current card is a
		// photo, a name and a date. Carrying `taken` and `capacity` across would
		// put a seat counter on it — there's nothing left to sign up for here,
		// so the number would only be noise.
		if (past || isToday || going) {
			current.push({
				id: event.id,
				title: event.title,
				date: event.date,
				time: event.time,
				image: event.image,
			})
		}

		if (!past && !isToday) {
			upcoming.push({
				...event,
				going,
				waitlisted: event.mine === 'waitlisted',
				attended: event.mine === 'attended',
			})
		}
	}

	// current reads newest first, so the event you just signed up for — or the
	// one running today — is at the front rather than buried under the club's
	// back catalogue. Upcoming is soonest first, the order you'd sign up in.
	current.sort((a, b) => b.date.localeCompare(a.date))
	upcoming.sort((a, b) => a.date.localeCompare(b.date))
	return { current, upcoming }
}

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

// Up to 4 across, dropping a column at a time as the panel narrows; scrolls on
// its own once the rows run past it.
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
				grid-cols-1
				sm:grid-cols-2
				xl:grid-cols-3
				2xl:grid-cols-4
				gap-4
				sm:gap-5
			">
				{items.map((event) => (
					<EventCard
						key={event.id}
						title={event.title}
						/* the row carries 'YYYY-MM-DD' and the time separately so
						   the date can be compared against today; the card is
						   where the two become one line of prose */
						date={[longDate(event.date), prettyTime(event.time)].filter(Boolean).join(' · ')}
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
			style={{ width: TAB_W }}
		>
			<span className={`
				font-vietnam
				text-[16px]
				sm:text-[19px]
				lg:text-[22px]
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
			[-webkit-text-stroke:1px_black]
			lg:[-webkit-text-stroke:2px_black]
			text-black
			text-[30px]
			sm:text-[36px]
			lg:text-[45px]
			text-center
			pt-6
			sm:pt-10
			lg:pt-15
			pb-4
			lg:pb-5
			select-none
		">
			{children}
		</h1>
	)
}

// ---- page ------------------------------------------------------------------

export default function MemberEvents() {
	const [showUpcoming, setShowUpcoming] = useState(false)

	// Every event, once. Both panels are derived from this — see `panels` — so a
	// change to one row is a change to both sides at the same instant.
	const [rows, setRows] = useState([])
	// ids with a request in flight, so a button can't be pressed twice into two
	// opposite calls that then race each other
	const [busy, setBusy] = useState(() => new Set())
	// What the API refused the last change with. A revert on its own looks like
	// the click missed; the reason is the only thing that makes it make sense.
	const [error, setError] = useState(null)

	useEffect(() => {
		let live = true
		eventsApi
			.list()
			.then((list) => live && setRows(list.map(toCard)))
			.catch((err) => live && setError(err.message))
		return () => { live = false }
	}, [])

	const { current, upcoming } = useMemo(() => panels(rows), [rows])

	// Applied to the row first and rolled back if the call is refused. Because
	// both panels read off that one row, an RSVP does two things at once with no
	// extra work: the button turns green, and the event appears in "current".
	//
	// Whether the seat taken is a real one or a waitlist place is the server's
	// call: `code` in the reply says which. A waitlist place is not a seat, so
	// it neither moves the counter nor puts the event in "current".
	const toggleRsvp = async (event) => {
		if (busy.has(event.id)) return
		setBusy((prev) => new Set(prev).add(event.id))
		setError(null)

		const leaving = event.going || event.waitlisted
		const patch = (changes) =>
			setRows((prev) =>
				prev.map((row) => (row.id === event.id ? { ...row, ...changes } : row))
			)

		// what the row said before, to put back if the call is refused
		const before = { mine: event.mine, taken: event.taken }

		patch(
			leaving
				? { mine: null, taken: event.taken - (event.going ? 1 : 0) }
				: { mine: 'rsvped', taken: event.taken + 1 }
		)

		try {
			if (leaving) {
				await eventsApi.unrsvp(event.id)
			} else {
				const reply = await eventsApi.rsvp(event.id)
				if (reply?.code === 'WAITLISTED' || reply?.code === 'ALREADY_WAITLISTED') {
					patch({ mine: 'waitlisted', taken: event.taken })
				}
			}
		} catch (err) {
			patch(before)
			setError(err.message)
		} finally {
			setBusy((prev) => {
				const next = new Set(prev)
				next.delete(event.id)
				return next
			})
		}
	}

	// An event is full when every seat is gone and none of them is yours. One
	// with no cap at all is never full, which is what the null check is for.
	const upcomingRows = upcoming.map((event) => ({
		...event,
		waitlist:
			event.waitlisted ||
			(!event.going && event.capacity != null && event.taken >= event.capacity),
	}))

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
			lg:-mt-8
			lg:-mb-8
			lg:-mr-8
			lg:ml-8
			xl:ml-12
			2xl:ml-20
		">
			{/* page-plain: the panels inside bring their own entrance, so this
			    box doesn't take the standard one on top of it.

			    The panels are absolutely positioned, so this box is the only
			    thing that can give them a height. Above `lg` it takes the one the
			    shell's scroll column already has; below that the shell grows with
			    its content, so the box has to name a height itself — the window
			    less the menu bar and the padding around it — or it collapses to
			    nothing and takes the panels with it. Same as /labs. */}
			<div className={`
				page-plain
				${TAB_SIZES}
				relative
				h-[calc(100dvh-7rem)]
				sm:h-[calc(100dvh-8rem)]
				lg:h-auto
				lg:absolute
				lg:inset-0
				overflow-hidden
				rounded-[30px]
				lg:rounded-none
			`}>
				{/* back panel: upcoming */}
				<section
					className="
						panel-slide
						absolute
						inset-y-0
						right-0
						bg-blue
						rounded-tl-[40px]
						rounded-bl-[40px]
						lg:rounded-tl-[60px]
						lg:rounded-bl-[60px]
						shadow-[-5px_1px_4px_rgba(0,0,0,0.7)]
						flex
						transition-transform
						ease-out
					"
					style={{
						'--slide': '210px',
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
					    it slides away, so keep --tab-w (plus a little air) clear of cards */}
					<div
						className="
							flex-1
							min-w-0
							flex
							flex-col
							pb-6
							lg:pb-8
							pr-[calc(var(--tab-w)+12px)]
							lg:pr-[calc(var(--tab-w)+40px)]
						"
					>
						<PanelHeading>UPCOMING</PanelHeading>
						{error && (
							<p className="
								font-vietnam
								-mt-2
								mb-2
								px-3
								text-center
								text-sm
								text-white
							">
								{error}
							</p>
						)}
						<EventGrid
							items={upcomingRows}
							renderAction={(event) => (
								<RsvpButton
									going={event.going || event.waitlisted}
									waitlist={event.waitlist}
									attended={event.attended}
									onClick={() => toggleRsvp(event)}
								/>
							)}
						/>
					</div>
				</section>

				{/* front panel: current — slides right to uncover the one behind it */}
				<section
					className="
						panel-slide
						absolute
						inset-y-0
						right-0
						bg-blue-light
						rounded-tl-[40px]
						rounded-bl-[40px]
						lg:rounded-tl-[60px]
						lg:rounded-bl-[60px]
						flex
						shadow-[-5px_1px_4px_rgba(0,0,0,0.5)]
						transition-transform
						ease-out
					"
					style={{
						'--slide': '130px',
						left: `calc(${TAB_W} + ${SHADOW_ROOM}px)`,
						transitionDuration: `${slideMs}ms`,
						transform: showUpcoming
							? `translateX(calc(100% - ${TAB_W} - ${currentNudge}px))`
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
						pr-4
						lg:pr-10
						pb-6
						lg:pb-8
					">
						<PanelHeading>CURRENT</PanelHeading>
						<EventGrid items={current} />
					</div>
				</section>
			</div>
		</DashboardShell>
	)
}
