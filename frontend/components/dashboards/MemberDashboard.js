'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/dashboards/Sidebar'
import ElementistPass from '@/components/dashboards/ElementistPass'
import { useRole, useSession, useSignOut } from '@/lib/session'
import { navFor, showInstagramFor } from '@/lib/nav'
import { announcements as announcementsApi, members, labs as labsApi, events as eventsApi } from '@/lib/api'
import { isoDate, today } from '@/lib/dates'

function StatCard({ title, value, bg, valueColor }) {
	return (
		<div className={`
			rounded-[20px]
			sm:rounded-[30px]
			p-4
			sm:p-6
			min-h-[110px]
			sm:min-h-[150px]
			flex
			flex-col
            items-center
			text-center
			${bg}
            shadow-[-4px_4px_8px_rgba(0,0,0,0.5)]
		`}>
			<p className="
				font-vietnam
				font-semibold
				text-sm
				sm:text-lg
				text-black
			">
				{title}
			</p>
			<p className={`
				font-beachday
				text-[36px]
				sm:text-[50px]
				mt-auto
				${valueColor}
			`}>
				{value}
			</p>
		</div>
	)
}

// `items` is what's on that day — [{ key, title, href }]. One item makes the
// whole stamp a link to it; with more, each title is its own link. None reads
// "none", as it always has.
function Stamp({ day, date, items = [], style, rotate = 0, onOpen }) {
	// Position + rotation live on this one wrapper. Everything inside
	// (stamp, pin, text) rotates with it automatically — no per-item angles.
	//
	// `center` = horizontal distance (px) of the stamp's center from the green
	// panel's center x-axis. 0 = dead center, negative = left, positive = right.
	// (90px below is half the stamp width, 180 / 2.)
	const { center = 0, ...pos } = style
	const sign = center < 0 ? '-' : '+'
	// rotate lives on the outer div (inline), so hover:scale goes on the inner
	// wrapper — otherwise the inline transform would override the scale.
	return (
		<div
			className={`group absolute hover:z-20 ${items.length === 1 ? 'cursor-pointer' : ''}`}
			role={items.length === 1 ? 'link' : undefined}
			tabIndex={items.length === 1 ? 0 : undefined}
			aria-label={items.length === 1 ? `${items[0].title}, ${day} ${date}` : undefined}
			onClick={items.length === 1 ? () => onOpen(items[0].href) : undefined}
			onKeyDown={items.length === 1 ? (event) => {
				if (event.key === 'Enter') onOpen(items[0].href)
			} : undefined}
			style={{
				...pos,
				width: `${STAMP_W}px`,
				height: `${STAMP_H}px`,
				left: `calc(50% - ${STAMP_W / 2}px ${sign} ${Math.abs(center)}px)`,
				// shrunk about its own centre, so it stays exactly where it's placed —
				// by how much comes from --stamp-scale on the pile (see STAMP_SCALE)
				transform: `rotate(${rotate}deg) scale(var(--stamp-scale, 1))`,
			}}
		>
			<div className="
				relative
				w-full
				h-full
				transition-transform
				duration-200
				ease-out
				group-hover:scale-105
			">
				{/* white base stays fully opaque — the yellow just fades in on top,
				    so the stamp never goes see-through and reveals the ones behind */}
				<img
					src="/stamp.png"
					alt=""
					className="
						absolute
						inset-0
						w-full
						h-full
						select-none
					"
				/>
				<img
					src="/stamp-yellow.png"
					alt=""
					className="
						absolute
						inset-0
						w-full
						h-full
						select-none
						opacity-0
						transition-opacity
						duration-200
						group-hover:opacity-100
					"
				/>
				<img
					src="/pin.png"
					alt=""
					className="
						absolute
						top-[20px]
						left-1/2
						-translate-x-1/2
						w-9
						select-none
					"
				/>
				<div className="
					absolute
					inset-0
					flex
					flex-col
					items-center
					justify-center
					px-6
					text-center
				">
					<p className="
						font-beautifulbg
						text-[30px]
						text-black
					">
						{day} <span className="
							text-lg
							align-baseline
						">{date}</span>
					</p>
					<div className="
						font-handrawn
						text-[20px]
						text-black
						mt-3
						leading-tight
						w-full
						flex
						flex-col
						gap-1
					">
						{items.length === 0 && <p>none</p>}
						{items.length === 1 && <p className="line-clamp-2">{items[0].title}</p>}
						{/* a busy day: each title opens its own — up to three, then
						    a count, so the stamp never overflows */}
						{items.length > 1 && items.slice(0, 3).map((item) => (
							<button
								key={item.key}
								type="button"
								onClick={() => onOpen(item.href)}
								className="
									truncate
									cursor-pointer
									hover:underline
								"
							>
								{item.title}
							</button>
						))}
						{items.length > 3 && (
							<p className="text-[16px] text-black/60">+{items.length - 3} more</p>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}

// ---- data ------------------------------------------------------------------

// Per-stamp layout inside the group box (GROUP_W × GROUP_H, centered in the panel).
//   top    = px distance from the top of the group.
//   center = px distance of the stamp's center from the panel's center x-axis
//            (0 = centered, negative = left, positive = right).
//   rotate = tilt in degrees.
//
// The stamps sit as far out as the group will hold them — the pile fills the
// panel's width rather than huddling in the middle with a band of green spare
// down each side.
//
// The group is deliberately bigger than the pile drawn in it, and the padding
// is not decoration — it's what stops a hover from moving anything else on the
// page.
//
// A stamp is tilted, and hovering grows it 5%. A rotated box's rendered
// footprint is wider and taller than the box itself, so the pile spills past
// the group's edges, and hovering makes it spill further — measured at the
// widest: 35.4px left, 11.3px right, 20.5px below, with 5.9px to spare on top.
// Anything a transform paints outside its container still counts toward the
// scrollable overflow of every ancestor, so that spill is not free: it changes
// the scroll geometry of the box the sidebar is `sticky` inside, and a sticky
// element re-pins when its scroll container's geometry moves. That's a hover on
// the far right of the page nudging the menu on the far left.
//
// PAD_X / PAD_Y are the fix. They make the group big enough to contain the pile
// at its hovered size, so the footprint is the group's own — fixed — and hover
// changes nothing outside itself.
//
// The padding has to be symmetric. The group is centred in the panel, so
// growing it by p on one side moves its centre by p/2 and drags every stamp
// with it; growing both sides leaves the centre where it was. That's also why
// `center` values below are untouched (they're measured from the centre, which
// hasn't moved) while every `top` gains PAD_Y (measured from the top edge,
// which has).
const STAMP_W = 200
const STAMP_H = 262

// In the main layout (2xl: menu | content | upcoming side by side) the stamps
// are drawn a little under full size, each in place — the layout below is
// still measured at full size, so nothing moves and the pile only gains
// breathing room. Stacked (lg and down, phones included) they stay full size.
const STAMP_SCALE = '[--stamp-scale:1] 2xl:[--stamp-scale:0.9]'

// enough for the widest spill on each axis, with a little margin
const PAD_X = 40
const PAD_Y = 24

const GROUP_W = 430 + PAD_X * 2      // 510
const GROUP_H = 880 + PAD_Y * 2      // 928

// Where each weekday's stamp sits in the pile — Monday first.
const STAMP_LAYOUT = [
	{ day: 'Mon.', style: { top: `${30 + PAD_Y}px`, center: -95 }, rotate: -11 },
	{ day: 'Tues.', style: { top: `${160 + PAD_Y}px`, center: 100 }, rotate: 7 },
	{ day: 'Wed.', style: { top: `${320 + PAD_Y}px`, center: -100 }, rotate: -23 },
	{ day: 'Thurs.', style: { top: `${480 + PAD_Y}px`, center: 112 }, rotate: 4 },
	{ day: 'Fri.', style: { top: `${625 + PAD_Y}px`, center: -70 }, rotate: -4 },
]

const pad = (n) => String(n).padStart(2, '0')

// Monday–Friday of this week, as 'YYYY-MM-DD' in the viewer's own timezone.
// On a Saturday or Sunday this week's weekdays are all gone, so it's next
// week's instead.
function weekdays() {
	const now = new Date()
	const offset = now.getDay() === 0 ? 1 : now.getDay() === 6 ? 2 : 1 - now.getDay()
	return Array.from({ length: 5 }, (_, i) => {
		const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset + i)
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
	})
}

// The five stamps, filled in: each weekday's date, and the labs and events on
// it that are still to come — anything from a day that's already gone this
// week has happened, so that day reads "none". Today's all still count: a lab
// this evening is the most upcoming thing there is.
//
// A lab opens the same page its card on /labs does (sign up, check-in, quiz or
// the lab itself — /labs/view works out which). Events don't have a page of
// their own for members yet, so an event opens /events.
function buildWeek(labs, events) {
	const now = today()
	const rows = [
		...labs.map((lab) => ({
			key: `lab-${lab.labId}`,
			date: isoDate(lab.date),
			time: lab.startTime ?? '',
			title: lab.title,
			href: `/labs/view?id=${lab.labId}`,
		})),
		...events.map((event) => ({
			key: `event-${event.eventId}`,
			date: isoDate(event.date),
			time: event.startTime ?? '',
			title: event.title,
			href: '/events',
		})),
	]
	return weekdays().map((date, i) => ({
		...STAMP_LAYOUT[i],
		date: String(Number(date.slice(8))),
		items: date < now
			? []
			: rows
				.filter((row) => row.date === date)
				.sort((a, b) => a.time.localeCompare(b.time)),
	}))
}

// ---- page ------------------------------------------------------------------

export default function MemberDashboard() {
	const role = useRole()
	const signOut = useSignOut()
	const { user } = useSession()

	// The banner shows the latest announcement and nothing else, so the API is
	// asked for exactly one. `undefined` is still loading and `null` is loaded
	// with nothing to show — two different things, and the panel shouldn't flash
	// "nothing new" on its way to the real one.
	const [announcement, setAnnouncement] = useState(undefined)

	// points + the four counts behind them. GET /members/me computes the counts
	// off the junction tables, so this is one call rather than four.
	const [profile, setProfile] = useState(null)

	// this week's stamps — the dates straight away, what's on them once the
	// labs and events have loaded
	const router = useRouter()
	const [week, setWeek] = useState(() => buildWeek([], []))

	useEffect(() => {
		let live = true

		Promise.all([labsApi.list(), eventsApi.list()])
			.then(([labs, events]) => live && setWeek(buildWeek(labs, events)))
			.catch(() => {})

		announcementsApi
			.list(1)
			.then((rows) => live && setAnnouncement(rows[0] ?? null))
			.catch(() => {})

		members
			.me()
			.then((me) => live && setProfile(me))
			.catch(() => {})

		// the fetches outlive a fast navigation away; this is what stops them
		// setting state on a component that's already gone
		return () => { live = false }
	}, [])

	const stats = profile?.stats
	const points = profile?.points ?? user?.points ?? 0

	return (
		// Three widths, and the layout gives up a column at each one.
		//
		//   2xl   menu | content | upcoming, side by side, window never scrolls
		//   lg    menu | (content over upcoming) — the green panel goes full
		//         width under the content instead of standing against the right
		//         edge, because three columns need ~1536px before the middle one
		//         gets squeezed to nothing
		//   base  all of it stacked under the menu bar, page scrolls
		<main className="
			bg-cream
			w-full
			min-h-screen
			2xl:h-screen
			overflow-x-clip
			2xl:overflow-hidden
			p-4
			sm:p-6
			lg:p-8
			flex
			flex-col
			lg:flex-row
			gap-6
			lg:gap-8
			2xl:gap-15
		">
			<Sidebar
				items={navFor(role)}
				showInstagram={showInstagramFor(role)}
				onLogout={signOut}
			/>

			{/* everything that isn't the menu. It's one column of its own so the
			    content and the green panel can sit side by side at 2xl and stack
			    below it without the menu joining in. */}
			<div className="
				flex-1
				min-w-0
				min-h-0
				flex
				flex-col
				2xl:flex-row
				gap-6
				2xl:gap-15
			">

			{/* center column. page-enter / page-stagger are the entrance (see
			    globals.css): the column drifts up and its panels rise in
			    sequence, so arriving here reads as movement rather than a swap. */}
			<section className="
				page-enter
				page-stagger
				flex-1
				min-w-0
				flex
				flex-col
				2xl:justify-center
				gap-5
			">
				{/* announcements */}
				<div className="
					relative
					bg-white
					border-[5px]
					border-orange
					rounded-tl-[30px]
					sm:rounded-tl-[50px]
                    rounded-br-[30px]
					sm:rounded-br-[50px]
					px-5
					sm:px-8
					py-4
					sm:py-5
				">
					<p className="
						font-vietnam
						text-[16px]
						sm:text-[18px]
                        font-semibold
						text-black
					">
						announcements
					</p>
					<p className="
						font-handrawn
						text-2xl
						sm:text-4xl
						text-black
						mt-2
					">
						{/* undefined is still loading; null is loaded and empty. The
						    two say different things and the panel shouldn't flash the
						    empty one on its way to the real one. */}
						{announcement === null
							? 'Nothing new right now.'
							: announcement?.body ?? ' '}
					</p>
				</div>

				{/* elementist pass (click to flip) */}
				<ElementistPass />

				{/* stats + points cloud.

				    The cloud sits over the middle of the four cards at every width, so
				    the gutter it sits in is what has to change: it stays a little
				    wider than the cloud so the two read as one piece rather than
				    the cloud landing on top of the numbers. */}
				<div className="relative">
					<div className="
                    lg:mt-5
						grid
						grid-cols-2
						gap-x-10
						sm:gap-x-16
						lg:gap-x-[90px]
						gap-y-4
						lg:gap-y-6
					">
						{/* an em dash until the counts land, so the four cards keep
						    their size instead of popping from 0 to the real number */}
						<StatCard title="past labs" value={stats?.pastLabs ?? '—'} bg="bg-green" valueColor="text-green-dark" />
						<StatCard title="rsvp'd labs" value={stats?.rsvpLabs ?? '—'} bg="bg-yellow-light" valueColor="text-yellow-dark" />
						<StatCard title="past events" value={stats?.pastEvents ?? '—'} bg="bg-salmon-light" valueColor="text-salmon-dark" />
						<StatCard title="rsvp'd events" value={stats?.rsvpEvents ?? '—'} bg="bg-orange" valueColor="text-orange-dark" />
					</div>
					{/* cloud overlapping the grid center */}
					<div className="
						absolute
						inset-0
						flex
						items-center
						justify-center
						pointer-events-none
					">
						<div className="
							relative
							w-32
							sm:w-44
							lg:w-60
						">
							<img
								src="/cloud-1.png"
								alt=""
								className="
									w-full
									select-none

								"
							/>
							<div className="
								absolute
								inset-0
								flex
								flex-col
								items-center
								justify-center
							">
								<p className="
									font-vietnam
                                    font-semibold
									text-[17px]
									sm:text-[20px]
									text-black
								">
									points
								</p>
								<p className="
									font-beachday
									font-bold
									text-2xl
									sm:text-3xl
									text-salmon-med
									leading-none
								">
									{points}
								</p>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* right column: upcoming. It comes in from off the right edge rather
			    than rising with the center column — two planes moving in
			    different directions is where the depth comes from. */}
			<section
				style={{ '--slide': '140px' }}
				className="
					panel-slide
					2xl:w-[500px]
					shrink-0
					-ml-4
					sm:-ml-6
					lg:ml-0
					-mr-4
					sm:-mr-6
					lg:-mr-8
					-mb-4
					sm:-mb-6
					lg:-mb-8
					2xl:-mt-8
					bg-green
					rounded-tl-[60px]
					lg:rounded-tl-[100px]
					rounded-tr-[60px]
					2xl:rounded-tr-none
					2xl:rounded-bl-[100px]
					p-6
					sm:p-8
					flex
					flex-col
					shadow-[inset_7px_5px_6px_rgba(0,0,0,0.25)]
				"
			>
				<h2 className="
					font-canobis
					text-green-dark
					text-4xl
					sm:text-5xl
					text-center
					mb-4
                    [-webkit-text-stroke:1px_black]
				">
					UPCOMING
				</h2>
				<div className="
					flex-1
					min-h-0
					flex
					items-center
					justify-center
				">
					{/* The stamps are placed by hand in a GROUP_W × GROUP_H box, so
					    the group can't reflow — it scales to the width it's been
					    given instead. The box outside it has to carry the scaled
					    size, because a transform doesn't change the space an element
					    takes up and the panel would otherwise keep reserving the full
					    unscaled group whatever the scale.

					    One number drives both: --s is the scale, the inner group
					    wears it, and the outer box is the group's size times it. They
					    were six hand-written pixel values that had to be recomputed
					    together every time the group changed size — and silently drew
					    a box of the wrong size if anyone forgot.

					    0.79 is what fits a 390px phone edge to edge; the wider the
					    panel gets before it becomes a column of its own at 2xl, the
					    larger the pile is drawn, so the green never ends up as a
					    broad empty margin either side of it. */}
					{/* shrink-0 because this box is now wider than the column it sits
					    in — the padding that keeps the hovered pile inside it is
					    padding, and a flex item that shrinks would give exactly that
					    back. Shrinking it also drags the pile sideways: the stamps are
					    placed at 50% of the group, so a narrower box moves the edge
					    the group is pinned to without moving the group's own centre.
					    What overflows is empty padding, and `main` clips it. */}
					<div
						className="
							relative
							shrink-0
							[--s:0.79]
							sm:[--s:1.15]
							2xl:[--s:1]
						"
						style={{
							width: `calc(${GROUP_W}px * var(--s))`,
							height: `calc(${GROUP_H}px * var(--s))`,
						}}
					>
						<div
							className={`
								absolute
								top-0
								left-0
								origin-top-left
								${STAMP_SCALE}
							`}
							style={{
								width: `${GROUP_W}px`,
								height: `${GROUP_H}px`,
								scale: 'var(--s)',
							}}
						>
							{week.map((s) => (
								<Stamp key={s.day} {...s} onOpen={(href) => router.push(href)} />
							))}
						</div>
					</div>
				</div>
			</section>
			</div>
		</main>
	)
}
