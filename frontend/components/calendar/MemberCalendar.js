'use client'

import { useState } from 'react'
import DashboardShell from '@/components/dashboards/DashboardShell'

// /calendar for a user or member: month view of labs + events, read only.
//
// Two columns: the month title and the legends on the left, the month grid on
// the right. Every day that has something on it gets a filled badge — the badge
// colour is the *track* (who it's for), and the two lines underneath are the
// kind of thing and its name. The arrows under the title step the month; the
// grid rebuilds itself from whatever month it lands on.

// Where the calendar opens.
const YEAR = 2026
const MONTH = 7 // 0-indexed: August

// Height of the sheet, in px: a six-week grid plus its weekday header. Both
// columns are held to it, so a five-week month leaves empty space under the
// last row instead of dragging the title and the legends up with it — stepping
// through the months never moves anything but the days themselves.
const SHEET_H = 815

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

// The kinds of thing that turn up on the calendar. Shown as the chip list and
// again as the small caption over each entry, so the two read as one legend.
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
const TRACKS = {
	members: { label: 'members', pill: 'bg-orange text-white' },
	officers: { label: 'officers', pill: 'bg-yellow text-black' },
	open: { label: 'open to all', pill: 'bg-green text-black' },
	online: { label: 'online', pill: 'bg-blue text-white' },
}

// Officer-only days aren't a member's business: they're kept out of the grid
// and off the legend here. This is only the view side of that rule — the API
// should be filtering them out before they ever reach the page.
const VISIBLE_TRACKS = Object.keys(TRACKS).filter((track) => track !== 'officers')

// Keyed 'YYYY-MM', then by day of the month. Placeholder rows until /calendar
// is wired to the API — one entry per day is all the grid has room for. A month
// that isn't in here just draws an empty sheet.
const entries = {
	'2026-08': {
		1: { type: 'Social', title: 'Kickoff Mixer', track: 'open' },
		4: { type: 'GBM', title: 'First Meeting', track: 'members' },
		6: { type: 'Lab', title: 'Bubbles & Beakers', track: 'members' },
		8: { type: 'Pop-Up', title: 'Vendor Booth', track: 'open' },
		11: { type: 'Lab', title: 'Lip Gloss', track: 'members' },
		13: { type: 'Workshop', title: 'Skincare 101', track: 'online' },
		15: { type: 'Social', title: 'Glow Night', track: 'members' },
		18: { type: 'Lab', title: 'Bronzer', track: 'members' },
		20: { type: 'Deadline', title: 'Dues Due', track: 'online' },
		21: { type: 'GBM', title: 'Officer Sync', track: 'officers' },
		23: { type: 'Volunteering', title: 'Beach Cleanup', track: 'open' },
		25: { type: 'Photoshoot', title: 'Member Portraits', track: 'members' },
		27: { type: 'Fundraiser', title: 'Bake Sale', track: 'open' },
		29: { type: 'Lab', title: 'Lipstick', track: 'members' },
		31: { type: 'GBM', title: 'Month Recap', track: 'members' },
	},
	'2026-09': {
		2: { type: 'GBM', title: 'Fall Kickoff', track: 'members' },
		5: { type: 'Lab', title: 'Blush', track: 'members' },
		9: { type: 'Workshop', title: 'Brush Care', track: 'online' },
		12: { type: 'Lab', title: 'Highlighter', track: 'members' },
		17: { type: 'Fundraiser', title: 'Bake Sale', track: 'open' },
		19: { type: 'Lab', title: 'Body Butter', track: 'members' },
		24: { type: 'Photoshoot', title: 'Officer Headshots', track: 'officers' },
		26: { type: 'Lab', title: 'Lip Scrub', track: 'members' },
		30: { type: 'Deadline', title: 'Points Due', track: 'online' },
	},
	'2026-07': {
		4: { type: 'Social', title: 'Summer Meetup', track: 'open' },
		15: { type: 'Workshop', title: 'Ingredient Basics', track: 'online' },
		22: { type: 'Lab', title: 'Sunscreen', track: 'members' },
		29: { type: 'GBM', title: 'Planning Session', track: 'officers' },
	},
}

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

function Pill({ children, className = '' }) {
	return (
		<span className={`
			rounded-full
			px-4
			py-1.5
			font-vietnam
			font-semibold
			text-xs
			uppercase
			tracking-[0.12em]
			${className}
		`}>
			{children}
		</span>
	)
}

// One square of the grid. Out-of-month days keep their number but lose the
// badge, which is what makes the month itself read as a block.
function Day({ number, inMonth, entry }) {
	const badge = entry ? TRACKS[entry.track].pill : 'bg-black text-cream'
	return (
		<div className="
			group
			min-h-[112px]
			pt-3
			pr-2
		">
			<span className={`
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
					? `${badge} group-hover:scale-110`
					: 'text-black/40'}
			`}>
				{number}
			</span>

			{entry && (
				<div className="mt-3">
					<p className="
						font-vietnam
						text-[10px]
						uppercase
						tracking-[0.12em]
						text-black/45
					">
						{entry.type}
					</p>
					<p className="
						font-vietnam
						text-sm
						leading-tight
						text-black
						mt-0.5
					">
						{entry.title}
					</p>
				</div>
			)}
		</div>
	)
}

// ---- page ------------------------------------------------------------------

export default function MemberCalendar() {
	// Which month is on screen. Stepping goes through Date so December rolls
	// into January of the next year on its own.
	const [view, setView] = useState({ year: YEAR, month: MONTH })

	const step = (delta) =>
		setView(({ year, month }) => {
			const moved = new Date(year, month + delta, 1)
			return { year: moved.getFullYear(), month: moved.getMonth() }
		})

	const weeks = monthWeeks(view.year, view.month)
	const monthEntries = entries[monthKey(view.year, view.month)] ?? {}

	// Officer-only days read as empty here, same as a day with nothing on it.
	const visible = (entry) =>
		entry && VISIBLE_TRACKS.includes(entry.track) ? entry : null

	return (
		// my-auto rather than justify-center: it centers the sheet in the page but
		// still lets a tall month scroll from its top instead of clipping it.
		<DashboardShell className="
			flex
			flex-col
		">
			{/* SHEET_H fixes the height of the row, so neither column is at the mercy
			    of how many week rows the month happens to have. items-stretch then
			    hands that same height to both, which is what lets the title sit on
			    the top edge and the legends on the bottom one. */}
			<div
				className="
					my-auto
					flex
					items-stretch
					gap-12
					pr-2
				"
				style={{ height: `${SHEET_H}px` }}
			>
				{/* left column: month at the top, legends pushed to the bottom */}
				<div className="
					w-[340px]
					shrink-0
					flex
					flex-col
				">
					<h1 className="
						font-canobis
						text-black
						text-[76px]
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
							text-[42px]
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
					    the title on a short month. */}
					<div className="
						mt-auto
						pt-12
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

						<div className="
							mt-4
							flex
							flex-wrap
							justify-center
							gap-2
						">
							{TYPES.map((type) => (
								<span
									key={type}
									className="
										rounded-full
										border
										border-black/70
										px-4
										py-1.5
										font-vietnam
										text-sm
										text-black
									"
								>
									{type}
								</span>
							))}
						</div>

						{/* colour key: the badge colour says who the day is for */}
						<div className="
							mt-10
							flex
							flex-wrap
							gap-2
						">
							{VISIBLE_TRACKS.map((key) => (
								<Pill key={key} className={TRACKS[key].pill}>
									{TRACKS[key].label}
								</Pill>
							))}
						</div>
					</div>
				</div>

				{/* right column: the month grid */}
				<div className="
					flex-1
					min-w-0
				">
					<div className="
						grid
						grid-cols-7
						gap-2
					">
						{WEEKDAYS.map((day) => (
							<div
								key={day}
								className="
									bg-salmon
									rounded-full
									py-1.5
									text-center
								"
							>
								<span className="
									font-vietnam
									font-semibold
									text-cream
									text-sm
									uppercase
									tracking-[0.15em]
								">
									{day}
								</span>
							</div>
						))}
					</div>

					{weeks.map((week, i) => (
						<div
							key={i}
							className="
								grid
								grid-cols-7
								gap-2
								border-b
								border-black/20
								pb-4
							"
						>
							{week.map((day) => (
								<Day
									key={`${i}-${day.number}`}
									number={day.number}
									inMonth={day.inMonth}
									entry={day.inMonth ? visible(monthEntries[day.number]) : null}
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
				</div>
			</div>
		</DashboardShell>
	)
}
