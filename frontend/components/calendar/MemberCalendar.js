'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import DashboardShell from '@/components/dashboards/DashboardShell'
import { eventCategories, events as eventsApi, labs as labsApi } from '@/lib/api'
import { buildMonths, dayBadge, typesIn } from '@/lib/calendar'
import { JoinMeetingButton } from '@/components/events/MeetingLink'
import { thisMonth } from '@/lib/dates'
import { hiddenTracks } from '@/lib/roles'
import { DUE_CELL, DueLine, useDuesDeadlines } from '@/components/calendar/DuesDeadlines'

// /calendar for a user or member: month view of labs + events, read only.
//
// Two columns: the month title and the legends on the left, the month grid on
// the right. Every day that has something on it gets a filled badge — the badge
// colour is the *track* (who it's for), and the two lines underneath are the
// kind of thing and its name. The arrows under the title step the month; the
// grid rebuilds itself from whatever month it lands on.

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

// The chip list before the API answers — the tags the club ships with. Once
// the fetch lands this is replaced by what's actually on the calendar plus
// whatever tags officers have added since (see typesIn in lib/calendar).
const TYPES = [
	'Lab',
	'GBM',
	'Workshop',
	'Social',
	'Pop-Up',
	'Fundraiser',
	'Volunteering',
	'Photoshoot',
	'Deadline',
]

// Who the day is for. This is the colour dimension: the badge on the day and
// the pill in the legend share these classes, so they can never drift apart.
//
// `hollow` is the same colour as an outline, for a key pill switched off: the
// ring is inset so the pill keeps its size, and the text takes the colour (a
// darker shade of it for yellow and green, which don't read on cream).
//
// `fill` is the pill's colour as a value and `dark` marks the ones with black
// text — for the split badge of a day shared by several tracks (dayBadge in
// lib/calendar), which is painted with a gradient rather than a class.
const TRACKS = {
	members: { label: 'members', pill: 'bg-orange text-white', hollow: 'ring-orange text-orange', fill: 'var(--color-orange)' },
	officers: { label: 'e-board', pill: 'bg-yellow text-black', hollow: 'ring-yellow text-yellow-dark', fill: 'var(--color-yellow)', dark: true },
	open: { label: 'open to all', pill: 'bg-green text-black', hollow: 'ring-green text-green-dark', fill: 'var(--color-green)', dark: true },
	online: { label: 'online', pill: 'bg-blue text-white', hollow: 'ring-blue text-blue', fill: 'var(--color-blue)' },
	board: { label: 'EB board', pill: 'bg-[#6B4FBF] text-white', hollow: 'ring-[#6B4FBF] text-[#6B4FBF]', fill: '#6B4FBF' },
	jboard: { label: 'j-board', pill: 'bg-[#D6488F] text-white', hollow: 'ring-[#D6488F] text-[#D6488F]', fill: '#D6488F' },
}

// Officer-only, EB-board and j-board days aren't a member's business: they're
// kept out of the grid and off the legend here. This is only the view side of
// that rule — the API filters them out before they ever reach the page.
const VISIBLE_TRACKS = Object.keys(TRACKS).filter((track) => !hiddenTracks('member').includes(track))

// Where the days come from now: labs and events, folded into one month map by
// lib/calendar. Officer-only events never arrive here at all — the API filters
// them out for a member, so VISIBLE_TRACKS below is a second line of defence
// rather than the only one.


// Sunday-first weeks covering the month, with the neighbouring days that fill
// out the first and last row. Weeks that are entirely next month are dropped,
// so the grid ends on the row holding the last of the month.
function monthWeeks(year, month) {
	const firstWeekday = new Date(year, month, 1).getDay()
	const weeks = []
	for (let week = 0; week < 6; week++) {
		const days = []
		for (let day = 0; day < 7; day++) {
			const date = new Date(year, month, week * 7 + day + 1 - firstWeekday)
			days.push({
				number: date.getDate(),
				inMonth: date.getMonth() === month,
			})
		}
		weeks.push(days)
	}
	return weeks.filter((week) => week.some((day) => day.inMonth))
}

// 'en-US' is pinned rather than left to the browser so the server and client
// render the same name.
function monthName(year, month) {
	return new Date(year, month, 1).toLocaleString('en-US', { month: 'long' })
}

function monthKey(year, month) {
	return `${year}-${String(month + 1).padStart(2, '0')}`
}

// ---- pieces ----------------------------------------------------------------

function ChevronIcon({ back = false, className = '' }) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			<path d={back ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
		</svg>
	)
}

// The two month steppers under the title.
function StepButton({ back = false, label, onClick }) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={label}
			className="
				group
				w-11
				h-11
				shrink-0
				flex
				items-center
				justify-center
				rounded-full
				bg-black
				text-cream
				cursor-pointer
				transition-all
				duration-200
				ease-out
				hover:-translate-y-0.5
				hover:shadow-lg
				hover:shadow-black/20
				active:translate-y-0
				active:shadow-none
			"
		>
			<ChevronIcon
				back={back}
				className={`
					w-5
					h-5
					transition-transform
					duration-200
					ease-out
					${back ? 'group-hover:-translate-x-0.5' : 'group-hover:translate-x-0.5'}
				`}
			/>
		</button>
	)
}

// A pill in the colour key, which doubles as a filter: filled, that track's
// days are on the grid; clicked, it hollows out to an outline and they're
// hidden. Click again to bring them back.
function Pill({ track, on, onToggle }) {
	return (
		<button
			type="button"
			aria-pressed={on}
			onClick={onToggle}
			className={`
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
				${on ? TRACKS[track].pill : `bg-transparent ring-2 ring-inset ${TRACKS[track].hollow}`}
			`}
		>
			{TRACKS[track].label}
		</button>
	)
}

// Whether `number` in the month on screen is today — its badge glows.
function isToday(view, number) {
	const now = new Date()
	return view.year === now.getFullYear() && view.month === now.getMonth() && number === now.getDate()
}

// One square of the grid. Out-of-month days keep their number but lose the
// badge, which is what makes the month itself read as a block. The badge is
// coloured by everything showing on the day, not just the entry written
// under it — split between the tracks when there are several (dayBadge).
//
// `wave` is the cell's row plus its column, handed to the entrance animation as
// --wave: every cell on the same diagonal arrives together and each diagonal
// follows the one before it, so the month washes in from the top-left corner.
//
// `dues` are the viewer's unpaid due dates that land on it: the box goes light
// red and each says what's owed by when (DuesDeadlines).
function Day({ number, inMonth, entries: dayEntries = [], dues = [], wave = 0, today = false }) {
	const entry = dayEntries[0] ?? null
	const badge = dayBadge(dayEntries, TRACKS)
	return (
		<div
			style={{ '--wave': wave }}
			className={`
				calendar-cell
				group
				min-h-[42px]
				md:min-h-[90px]
				lg:min-h-[112px]
				flex
				md:block
				items-center
				justify-center
				pt-0
				md:pt-3
				pr-0
				md:pr-2
				${dues.length ? DUE_CELL : ''}
			`}
		>
			<span
				style={inMonth ? badge.style : undefined}
				className={`
					w-7
					h-7
					flex
					items-center
					justify-center
					rounded-full
					font-vietnam
					font-semibold
					text-xs
					transition-transform
					duration-200
					ease-out
					${inMonth
						? `${badge.className} group-hover:scale-110`
						: 'text-black/40'}
					${today ? 'calendar-today' : ''}
				`}
			>
				{number}
			</span>

			{/* A seven-column month on a phone gives each day about 45px, which is
			    room for the badge and nothing else — so below `md` the cell is just
			    the badge and its colour, and what's actually on those days is listed
			    under the grid instead (see Agenda). */}
			{entry && (
				<div className="
					hidden
					md:block
					mt-3
				">
					<p className="
						font-vietnam
						text-[10px]
						uppercase
						tracking-[0.12em]
						text-black/45
					">
						{entry.type}
					</p>
					<EntryTitle entry={entry} />
					<JoinMeetingButton url={entry.meetingUrl} tone={TRACKS[entry.track]?.pill} className="mt-1.5" />
				</div>
			)}
			{dues.length > 0 && (
				<div className="
					hidden
					md:block
					mt-2
					space-y-1
				">
					{dues.map((due) => <DueLine key={`${due.kind}-${due.id}`} due={due} />)}
				</div>
			)}
		</div>
	)
}

// The name of what's on a day, linking to its own page (the lab's or the
// event's) where the description, the time and the rsvp button are.
function EntryTitle({ entry }) {
	const className = `
		block
		font-vietnam
		text-sm
		leading-tight
		text-black
		mt-0.5
	`
	if (!entry.href) return <p className={className}>{entry.title}</p>
	return (
		<Link
			href={entry.href}
			className={`
				${className}
				underline
				decoration-black/20
				underline-offset-2
				transition-colors
				duration-200
				hover:decoration-black
			`}
		>
			{entry.title}
		</Link>
	)
}

// What the cells can't say on a narrow screen. One row per day that has
// something on it, in date order, carrying the same badge colour the cell does
// so the list and the grid read as the same thing.
function Agenda({ days }) {
	if (!days.length) return null
	return (
		<div className="
			md:hidden
			mt-6
		">
			<div className="
				bg-salmon
				rounded-full
				py-2
				text-center
			">
				<span className="
					font-vietnam
					font-semibold
					text-cream
					text-sm
					uppercase
					tracking-[0.15em]
				">
					this month
				</span>
			</div>

			<ul className="
				mt-4
				flex
				flex-col
				gap-3
			">
				{days.map(({ number, entries: dayEntries, dues = [] }) => {
					const entry = dayEntries[0]
					const badge = dayBadge(dayEntries, TRACKS)
					return (
					<li
						key={number}
						className={`
							flex
							items-start
							gap-3
							${dues.length ? 'rounded-[10px] bg-red/10 p-2' : ''}
						`}
					>
						<span
							style={badge.style}
							className={`
								w-7
								h-7
								shrink-0
								flex
								items-center
								justify-center
								rounded-full
								font-vietnam
								font-semibold
								text-xs
								${badge.className}
							`}
						>
							{number}
						</span>
						<div className="min-w-0">
							{entry && (
								<>
									<p className="
										font-vietnam
										text-[10px]
										uppercase
										tracking-[0.12em]
										text-black/45
									">
										{entry.type}
									</p>
									<EntryTitle entry={entry} />
									<JoinMeetingButton url={entry.meetingUrl} tone={TRACKS[entry.track]?.pill} className="mt-1.5" />
								</>
							)}
							{dues.map((due) => <DueLine key={`${due.kind}-${due.id}`} due={due} className={entry ? 'mt-1' : 'mt-1.5'} />)}
						</div>
					</li>
					)
				})}
			</ul>
		</div>
	)
}

// ---- page ------------------------------------------------------------------

export default function MemberCalendar() {
	// Which month is on screen. Stepping goes through Date so December rolls
	// into January of the next year on its own.
	const [view, setView] = useState(thisMonth)

	// Every lab and event in one map, keyed by month then day. Fetched once and
	// stepped through locally — the club's calendar is small enough that a
	// request per month would be more round trips than rows.
	const [months, setMonths] = useState({})
	const [types, setTypes] = useState(TYPES)
	// what they owe and by when, on the day it's due
	const dueOn = useDuesDeadlines()

	// The tags picked under "on the calendar". None picked is no filter; each
	// one clicked adds its tag to what's shown, and "clear filter" empties it.
	const [picked, setPicked] = useState([])
	const togglePick = (type) =>
		setPicked((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]))

	// The tracks switched off in the colour key — all on to start with. A day
	// only shows things on a track that's still on.
	const [offTracks, setOffTracks] = useState([])
	const toggleTrack = (track) =>
		setOffTracks((prev) => (prev.includes(track) ? prev.filter((t) => t !== track) : [...prev, track]))
	const tracksChanged = offTracks.length > 0

	useEffect(() => {
		let live = true
		Promise.all([labsApi.list(), eventsApi.list(), eventCategories.list()])
			.then(([labs, events, categories]) => {
				if (!live) return
				const built = buildMonths(labs, events)
				setMonths(built)
				setTypes(typesIn(built, categories))
			})
			.catch(() => {})
		return () => { live = false }
	}, [])

	const step = (delta) =>
		setView(({ year, month }) => {
			const moved = new Date(year, month + delta, 1)
			return { year: moved.getFullYear(), month: moved.getMonth() }
		})

	const weeks = monthWeeks(view.year, view.month)
	const stamp = monthKey(view.year, view.month)
	const monthEntries = months[stamp] ?? {}

	// This grid has room for one thing per day, so a day holding several shows
	// the first — which lib/calendar has already ordered by start time.
	//
	// Officer-only days read as empty here, same as a day with nothing on it.
	// The API has already dropped them for a member; this is the second line.
	//
	// With tags picked, a day shows the first thing on it that has one of them
	// — so a filtered-for workshop still shows on a day a GBM happens to start
	// earlier — and a day with none of them reads as empty.
	//
	// `visible` is every entry that passes, in order: the first is the one
	// written out, and all of them colour the badge.
	const visible = (day) => (day ?? []).filter((entry) =>
		VISIBLE_TRACKS.includes(entry.track) &&
		!offTracks.includes(entry.track) &&
		(picked.length === 0 || picked.includes(entry.type))
	)

	// The same days the grid shows a badge for, in date order — what the narrow
	// layout lists under the month.
	// (and any day something's due on, even with nothing else on it)
	const lastDay = new Date(view.year, view.month + 1, 0).getDate()
	const agendaDays = Array.from({ length: lastDay }, (_, i) => i + 1)
		.map((number) => ({ number, entries: visible(monthEntries[number]), dues: dueOn(view.year, view.month, number) }))
		.filter(({ entries, dues }) => entries.length || dues.length)

	return (
		// xl:overflow-visible: on a wide screen the page column doesn't scroll —
		// the grid does, in a box that reaches past it to the window's edges
		// (see the grid's column), which a scrolling page column would clip
		<DashboardShell className="
			flex
			flex-col
			xl:overflow-visible
		">
			{/* On a wide screen the row is exactly as tall as the sidebar beside
			    it (the page column shares its top and bottom edges), so neither
			    column is at the mercy of how many week rows or entries the month
			    has. items-stretch hands that height to both, which is what puts
			    the title on the sidebar's top edge and the legends on its bottom
			    one — and the grid's column scrolls within it. */}
			{/* The columns don't pair off until `xl`. At `lg` the sidebar has
			    already taken 327px of the window, and a 340px title column beside
			    that leaves the seven days about 30px each. */}
			<div
				className="
					xl:flex-1
					xl:min-h-0
					flex
					flex-col
					xl:flex-row
					items-stretch
					gap-8
					xl:gap-8
					2xl:gap-12
				"
			>
				{/* left column: month at the top, legends pushed to the bottom.
				    calendar-side / calendar-grid bring the two columns in from
				    opposite edges (see globals.css) — the depth is in them moving
				    against each other, with the day cells washing across after.
				    Stacked, they're a header above the grid instead. */}
				<div className="
					calendar-side
					w-full
					xl:w-[280px]
					2xl:w-[340px]
					shrink-0
					flex
					flex-col
				">
					<h1 className="
						font-canobis
						text-black
						text-[48px]
						sm:text-[60px]
						xl:text-[64px]
						2xl:text-[76px]
						leading-none
						select-none
					">
						{monthName(view.year, view.month)}
					</h1>

					{/* year and the two steppers share a line under the title */}
					<div className="
						mt-2
						flex
						items-center
						justify-between
						gap-4
					">
						<p className="
							font-vietnam
							font-semibold
							text-black/35
							text-[28px]
							sm:text-[34px]
							xl:text-[36px]
							2xl:text-[42px]
							leading-none
						">
							{view.year}
						</p>
						<div className="
							flex
							gap-2
						">
							<StepButton
								back
								label="Previous month"
								onClick={() => step(-1)}
							/>
							<StepButton
								label="Next month"
								onClick={() => step(1)}
							/>
						</div>
					</div>

					{/* mt-auto drops both legends to the bottom of the column, so they
					    finish level with the last rule of the grid. pt-12 keeps them off
					    the title on a short month. Stacked there's no grid beside them
					    to finish level with, so they just follow the title. */}
					<div className="
						xl:mt-auto
						pt-8
						xl:pt-12
					">
						<div className="
							bg-salmon
							rounded-full
							py-2
							text-center
						">
							<span className="
								font-vietnam
								font-semibold
								text-cream
								text-sm
								uppercase
								tracking-[0.15em]
							">
								on the calendar
							</span>
						</div>

						{/* each tag is a filter: pressed, the calendar shows only
						    days with that tag (or any of the pressed ones) */}
						<div className="
							mt-4
							flex
							flex-wrap
							justify-center
							gap-2
						">
							{types.map((type) => {
								const on = picked.includes(type)
								return (
									<button
										key={type}
										type="button"
										onClick={() => togglePick(type)}
										aria-pressed={on}
										className={`
											rounded-full
											border
											px-4
											py-1.5
											font-vietnam
											text-sm
											cursor-pointer
											transition-colors
											duration-150
											${on
												? 'border-black bg-black text-cream'
												: 'border-black/70 text-black hover:bg-black/5'}
										`}
									>
										{type}
									</button>
								)
							})}
						</div>

						{/* plain text, not another pill. It holds its line even
						    while there's nothing to clear, so the legend under it
						    doesn't jump when the first tag is picked. */}
						<div className="
							mt-2
							text-center
						">
							<button
								type="button"
								onClick={() => setPicked([])}
								tabIndex={picked.length ? 0 : -1}
								aria-hidden={!picked.length}
								className={`
									font-vietnam
									text-sm
									text-black/45
									cursor-pointer
									transition-colors
									duration-150
									hover:text-black/70
									${picked.length ? '' : 'invisible'}
								`}
							>
								clear filter
							</button>
						</div>

						{/* colour key: the badge colour says who the day is for, and
						    clicking a pill hides or shows that track — centred when
						    stacked, like the officer calendar's */}
						<div className="
							mt-6
							flex
							flex-wrap
							justify-center
							xl:justify-start
							gap-2
						">
							{VISIBLE_TRACKS.map((key) => (
								<Pill
									key={key}
									track={key}
									on={!offTracks.includes(key)}
									onToggle={() => toggleTrack(key)}
								/>
							))}
						</div>

						{/* back to how the key started, once it's been changed. Holds its
						    line while there's nothing to clear, same as the tags' one, so
						    the pills don't jump when it appears */}
						<div className="
							mt-2
							text-center
						">
							<button
								type="button"
								onClick={() => setOffTracks([])}
								tabIndex={tracksChanged ? 0 : -1}
								aria-hidden={!tracksChanged}
								className={`
									font-vietnam
									text-sm
									text-black/45
									cursor-pointer
									transition-colors
									duration-150
									hover:text-black/70
									${tracksChanged ? '' : 'invisible'}
								`}
							>
								clear filter
							</button>
						</div>
					</div>
				</div>

				{/* right column: the month grid — its own scroller on a wide
				    screen, with a little room on the right for the scrollbar.
				    The box reaches 32px past the row at both ends — the page's
				    padding (DashboardShell's lg:p-8), so out to the window's top
				    and bottom edges — and is padded by the same, so the month
				    starts level with the sidebar's top edge and ends level with
				    its bottom, but scrolls all the way to the window's.
				    A column, so the weeks can share out the height (see below).
				    A scroll box clips sideways too, so it also reaches 16px out
				    on the left (into the gap between the columns), padded back
				    by the same: room for the leftmost day's badge to grow on
				    hover, and for today's glow, without their edge being cut
				    off — the grid itself doesn't move. */}
				<div className="
					calendar-grid
					flex-1
					min-w-0
					xl:min-h-0
					xl:-my-8
					xl:py-8
					xl:-ml-4
					xl:pl-4
					xl:overflow-y-auto
					xl:pr-2
					xl:flex
					xl:flex-col
				">
					<div className="
						grid
						grid-cols-7
						gap-1
						sm:gap-2
					">
						{WEEKDAYS.map((day, column) => (
							<div
								key={day}
								style={{ '--wave': column }}
								className="
									calendar-cell
									bg-salmon
									rounded-full
									py-1
									sm:py-1.5
									text-center
									overflow-hidden
								"
							>
								<span className="
									font-vietnam
									font-semibold
									text-cream
									text-[10px]
									sm:text-xs
									lg:text-sm
									uppercase
									tracking-normal
									sm:tracking-[0.15em]
								">
									{day}
								</span>
							</div>
						))}
					</div>

					{/* the month is in the key, not just the row number: stepping to
					    another month is a fresh set of rows rather than the same seven
					    cells being relabelled, so every cell mounts again and the wave
					    runs across the new month the way it did on arrival. Keyed on the
					    row alone, only the cells whose date happened to change would
					    remount, and the wave would come through in patches.
					    On a wide screen the weeks split the height between them
					    evenly (flex-1 grows each from nothing), so the rules are
					    evenly spaced and the last one lands on the sidebar's bottom
					    edge. A week with more on it than its share is as tall as it
					    needs — and once they don't all fit, the column scrolls. */}
					{weeks.map((week, i) => (
						<div
							key={`${stamp}-${i}`}
							className="
								grid
								grid-cols-7
								gap-1
								sm:gap-2
								border-b
								border-black/20
								pb-2
								md:pb-4
								xl:flex-1
							"
						>
							{week.map((day, column) => (
								<Day
									key={`${i}-${day.number}`}
									wave={i + column + 1}
									number={day.number}
									inMonth={day.inMonth}
									today={day.inMonth && isToday(view, day.number)}
									entries={day.inMonth ? visible(monthEntries[day.number]) : []}
									dues={day.inMonth ? dueOn(view.year, view.month, day.number) : []}
								/>
							))}
						</div>
					))}

					{/* the second rule under the last week, as on the reference sheet */}
					<div className="
						mt-1
						border-b
						border-black/20
					" />

					<Agenda days={agendaDays} />
				</div>
			</div>
		</DashboardShell>
	)
}
