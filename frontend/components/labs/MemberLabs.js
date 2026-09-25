'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardShell from '@/components/dashboards/DashboardShell'
import { labs as labsApi } from '@/lib/api'
import { isoDate, longDate, prettyTime, today } from '@/lib/dates'

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
//
// The width is a CSS variable rather than a number because it has to shrink on
// a phone — a 100px strip out of a 390px screen is a quarter of the page spent
// on a handle. Everything that needs it (the strip itself, the room the cards
// leave for the parked tab, how far the front panel travels) reads --tab-w, so
// the whole interaction rescales from the one declaration on the box below and
// none of it needs to measure the window.
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

// The lock with its shackle swung open — same body, so the two read as one
// object in two states rather than two different icons. Only the left leg still
// meets the body; the right end floats, which is the whole of "open".
function UnlockIcon({ className = '' }) {
	return (
		<svg
			viewBox="0 0 24 24"
			className={className}
			aria-hidden="true"
		>
			<path
				d="M8 10.5V7a4 4 0 0 1 8 0"
				fill="none"
				stroke="currentColor"
				strokeWidth="2.5"
				strokeLinecap="round"
			/>
			<rect x="4" y="10" width="16" height="11" rx="3" fill="currentColor" />
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

// The corner icon says where you stand with this lab, and there are only three
// answers:
//
//   attended  you were checked in, so the lab is yours — green, and the only
//             one of the three that's open
//   open      it's happening today, so check-in is live: bring the QR on your
//             pass and an officer scans you in
//   locked    yours, but shut — either it hasn't come round yet (you're RSVP'd
//             for a future date) or it's been and gone without you
const currentIcons = {
	attended: <UnlockIcon className={`${ICON_CLASS} text-green-dark`} />,
	open: <CalendarIcon className={`${ICON_CLASS} text-blue`} />,
	locked: <LockIcon className={`${ICON_CLASS} text-red`} />,
}

// The upcoming section has no status icon — it gets the rsvp button instead.

// Its own centered row along the bottom of an upcoming card.
//
// `waitlist` means every seat is already spoken for, so a seat taken here sits
// past the cap — the lab still accepts you, the counter just runs over (21/20).
// Nothing is ever disabled: a full lab offers the waitlist instead.
// `attended` is not a state of this button, it's the absence of one: once you've
// been checked in there is no RSVP left to cancel, so the card says so instead
// of offering a toggle the API would refuse. Everything else is a real control.
function RsvpButton({ going, waitlist, attended, onClick }) {
	if (attended) {
		return (
			<span
				title="You were checked in to this lab"
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
			// the card underneath opens the lab; pressing this shouldn't
			onClick={(event) => {
				event.stopPropagation()
				onClick()
			}}
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

// GET /api/labs hands back every lab with two extras worked out server-side:
// `taken`, the seats gone, and `mine`, this member's own attendance row on it
// (null when they have nothing to do with it).
//
// One list in state, both panels derived from it. That's what makes an RSVP
// show up in "current" the instant you press the button: the same row feeds
// both sides, so patching `mine` moves the card without a second request.
function toCard(lab) {
	return {
		id: lab.labId,
		title: lab.title,
		// kept as 'YYYY-MM-DD' — it compares against today as plain text, and
		// the card formats it for display
		date: isoDate(lab.date),
		time: lab.startTime ?? '',
		location: lab.location ?? '',
		image: lab.image,
		taken: lab.taken,
		capacity: lab.capacity,
		mine: lab.mine,
	}
}

// Which panel a lab belongs to, and what its corner icon says.
//
//   current   anything that is yours or is happening: a lab you're confirmed
//             for, one running today, and every one that has already been. A
//             waitlist place is NOT yours yet, so it doesn't qualify.
//   upcoming  everything still ahead, whether or not you're going — it's the
//             browse-and-sign-up side, and a lab you've joined stays on it so
//             you can still change your mind.
//
// A lab can be on both, and usually is once you've RSVP'd: it's yours (current)
// and it hasn't happened yet (upcoming).
function panels(rows) {
	const now = today()
	const current = []
	const upcoming = []

	for (const lab of rows) {
		const isToday = lab.date === now
		const past = lab.date < now
		// a confirmed seat. 'waitlisted' deliberately isn't one — you don't have
		// a place until somebody drops out
		const going = lab.mine === 'rsvped' || lab.mine === 'attended'

		// Listed field by field rather than spread: a current card is a photo, a
		// name, a date and the icon, and nothing else. Carrying `taken` and
		// `capacity` across would put a seat counter on it — there's nothing
		// left to sign up for here, so the number would only be noise.
		if (past || isToday || going) {
			current.push({
				id: lab.id,
				title: lab.title,
				date: lab.date,
				time: lab.time,
				location: lab.location,
				image: lab.image,
				status: lab.mine === 'attended'
					? 'attended'
					: isToday ? 'open' : 'locked',
			})
		}

		if (!past && !isToday) {
			upcoming.push({
				...lab,
				going,
				waitlisted: lab.mine === 'waitlisted',
				attended: lab.mine === 'attended',
			})
		}
	}

	// current reads newest first, so the lab you just signed up for — or the one
	// running today — is at the front rather than buried under the club's back
	// catalogue. Upcoming is soonest first, which is the order you'd sign up in.
	current.sort((a, b) => b.date.localeCompare(a.date))
	upcoming.sort((a, b) => a.date.localeCompare(b.date))
	return { current, upcoming }
}

// ---- pieces ----------------------------------------------------------------

// `availability` is optional: pass it and it rides on the title's line, pinned
// to the right edge of the card. Sections that have no seat count (a lab that's
// already running) just leave it out and the title takes the full width.
//
// Clicking the card opens the lab (`onOpen`, /labs/view). Its `action` (the
// rsvp button) is the one thing on it that doesn't — it stops the click on its
// way out. The current section passes a plain `icon` instead, which is a status
// marker, not a control.
function LabCard({ title, lines, image, icon, action, availability, onOpen }) {
	return (
		<div
			role="link"
			tabIndex={0}
			onClick={onOpen}
			onKeyDown={(event) => {
				if (event.key === 'Enter') onOpen()
			}}
			className="
				group
				relative
				cursor-pointer
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
						">
							{availability}
						</span>
					)}
				</div>

				{/* date, time and room, a row each, with the icon at the bottom
				    right — the one bit that differs between sections. The gap and
				    the icon's inset are tight because the cards get narrow once
				    the grid drops to two or three across — every pixel spent here
				    is one the lines lose to their ellipsis. */}
				<div className="
					flex
					items-end
					justify-between
					gap-1.5
				">
					<div className="min-w-0">
						{lines.map((line) => (
							<p
								key={line}
								className="
									font-vietnam
									text-black/70
									text-sm
									truncate
								"
							>
								{line}
							</p>
						))}
					</div>
					<span className="
						shrink-0
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
	const router = useRouter()

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
				{items.map((lab) => (
					<LabCard
						key={lab.id}
						title={lab.title}
						/* the row carries 'YYYY-MM-DD' so it can be compared
						   against today; the card is where it becomes prose */
						lines={[longDate(lab.date), prettyTime(lab.time), lab.location].filter(Boolean)}
						image={lab.image}
						icon={icons?.[lab.status]}
						action={renderAction?.(lab)}
						availability={
							lab.capacity == null ? null : `${lab.taken}/${lab.capacity}`
						}
						onOpen={() => router.push(`/labs/view?id=${lab.id}`)}
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

export default function MemberLabs() {
	const [showUpcoming, setShowUpcoming] = useState(false)

	// Every lab, once. Both panels are derived from this — see `panels` — so a
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
		labsApi
			.list()
			.then((list) => live && setRows(list.map(toCard)))
			.catch((err) => live && setError(err.message))
		return () => { live = false }
	}, [])

	const { current, upcoming } = useMemo(() => panels(rows), [rows])

	// Applied to the row first and rolled back if the call is refused. Because
	// both panels read off that one row, an RSVP does two things at once with no
	// extra work: the button turns green, and the lab appears in "current" under
	// a lock — it's yours now, it just hasn't come round yet.
	//
	// Whether the seat taken is a real one or a waitlist place is the server's
	// call, not this page's: `code` in the reply says which. A waitlist place is
	// not a seat, so it neither moves the counter nor puts the lab in "current".
	const toggleRsvp = async (lab) => {
		if (busy.has(lab.id)) return
		setBusy((prev) => new Set(prev).add(lab.id))
		setError(null)

		const leaving = lab.going || lab.waitlisted
		const patch = (changes) =>
			setRows((prev) =>
				prev.map((row) => (row.id === lab.id ? { ...row, ...changes } : row))
			)

		// what the row said before, to put back if the call is refused
		const before = { mine: lab.mine, taken: lab.taken }

		patch(
			leaving
				? { mine: null, taken: lab.taken - (lab.going ? 1 : 0) }
				: { mine: 'rsvped', taken: lab.taken + 1 }
		)

		try {
			if (leaving) {
				await labsApi.unrsvp(lab.id)
			} else {
				const reply = await labsApi.rsvp(lab.id)
				if (reply?.code === 'WAITLISTED' || reply?.code === 'ALREADY_WAITLISTED') {
					patch({ mine: 'waitlisted', taken: lab.taken })
				}
			}
		} catch (err) {
			patch(before)
			setError(err.message)
		} finally {
			setBusy((prev) => {
				const next = new Set(prev)
				next.delete(lab.id)
				return next
			})
		}
	}

	// A lab is full when every seat is gone and none of them is yours — that's
	// what makes the button offer the waitlist instead of an rsvp.
	const upcomingRows = upcoming.map((lab) => ({
		...lab,
		// no capacity = unlimited seats, so never full
		waitlist: lab.waitlisted || (!lab.going && lab.capacity != null && lab.taken >= lab.capacity),
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
			    shell's scroll column already has; below that the shell is part of
			    a page that grows with its content, so the box has to name a
			    height itself — the window less the menu bar and the padding
			    around it — or it collapses to nothing and takes the panels with
			    it. `dvh` because mobile browsers move the bottom bar around. */}
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
						bg-salmon
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
						color="text-salmon-dark"
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
								text-salmon-dark
							">
								{error}
							</p>
						)}
						<LabGrid
							items={upcomingRows}
							renderAction={(lab) => (
								<RsvpButton
									going={lab.going || lab.waitlisted}
									waitlist={lab.waitlist}
									attended={lab.attended}
									onClick={() => toggleRsvp(lab)}
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
						bg-salmon-light
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
						color="text-salmon-med"
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
						<LabGrid items={current} icons={currentIcons} />
					</div>
				</section>
			</div>
		</DashboardShell>
	)
}
