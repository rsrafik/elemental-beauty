'use client'

import { useEffect, useState } from 'react'
import { useDismiss } from '@/lib/dismiss'
import DashboardShell from '@/components/dashboards/DashboardShell'

// /calendar for officer / treasurer / admin: the member month view, plus the
// button that puts something new on it.
//
// Two columns: the month title, the add button and the legends on the left, the
// month grid on the right. Every day that has something on it gets a filled
// badge — the badge colour is the *track* (who it's for), and the lines
// underneath are the kind of thing, its name and its start time.
//
// Labs are deliberately missing from the category dropdown: they carry sign-ups
// and check-in, so they get scheduled from /labs rather than from here.

// Where the calendar opens.
const YEAR = 2026
const MONTH = 7 // 0-indexed: August

// Height of the sheet, in px: a six-week grid plus its weekday header. Both
// columns are held to it, so a five-week month leaves empty space under the
// last row instead of dragging the title and the legends up with it. It's a
// floor rather than a fixed height here, because a day can hold more than one
// thing once officers start adding to it.
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

// What the new-event dropdown offers: the current tag list minus labs, which
// are scheduled from /labs. The list is editable on this page, so this runs
// against the live tags rather than the constant above.
function categoriesFrom(types) {
	return types.filter((type) => type !== 'Lab')
}

// Who the day is for. This is the colour dimension: the badge on the day and
// the pill in the legend share these classes, so they can never drift apart.
const TRACKS = {
	members: { label: 'members', pill: 'bg-orange text-white' },
	officers: { label: 'officers', pill: 'bg-yellow text-black' },
	open: { label: 'open to all', pill: 'bg-green text-black' },
	online: { label: 'online', pill: 'bg-blue text-white' },
}

// Officers-only days never reach the member calendar, which filters them out.
// This page shows all four tracks, since officers are the ones scheduling them.
const TRACK_KEYS = Object.keys(TRACKS)

// Keyed 'YYYY-MM', then by day of the month. Placeholder rows until /calendar
// is wired to the API. A day holds either one entry or a list of them.
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

// ---- dates -----------------------------------------------------------------

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

// '2026-08-30' -> { key: '2026-08', day: 30, ... }. Split by hand rather than
// through Date, which reads a bare date string as UTC and can hand back the day
// before depending on the timezone.
function splitDateInput(value) {
	const [year, month, day] = value.split('-').map(Number)
	return { key: `${year}-${String(month).padStart(2, '0')}`, day, year, month }
}

// '13:30' -> '1:30pm'
function prettyTime(value) {
	if (!value) return null
	const [hours, minutes] = value.split(':').map(Number)
	const suffix = hours < 12 ? 'am' : 'pm'
	const hour = hours % 12 === 0 ? 12 : hours % 12
	return `${hour}:${String(minutes).padStart(2, '0')}${suffix}`
}

// A day holds one entry or several; read it as a list either way.
function listFor(map, day) {
	const value = map[day]
	if (!value) return []
	return Array.isArray(value) ? value : [value]
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

function PlusIcon({ className = '' }) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
			strokeLinecap="round"
			className={className}
			aria-hidden="true"
		>
			<path d="M12 5v14M5 12h14" />
		</svg>
	)
}

function CloseIcon({ className = '' }) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
			strokeLinecap="round"
			className={className}
			aria-hidden="true"
		>
			<path d="M6 6l12 12M18 6L6 18" />
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

// ---- the tag list ----------------------------------------------------------
//
// The three shapes below all have to sit at the same height, or the row of tags
// goes ragged: same px-4 py-1.5, same text-sm, and a border on every one of
// them (the add pill's border matches its own fill so it still reads as solid).

function TypeChip({ label, onRemove }) {
	return (
		<span className="
			inline-flex
			items-center
			gap-2
			rounded-full
			border
			border-black/70
			px-4
			py-1.5
			font-vietnam
			text-sm
			text-black
		">
			{label}
			<button
				type="button"
				onClick={onRemove}
				aria-label={`Remove ${label}`}
				className="
					w-4
					h-4
					shrink-0
					flex
					items-center
					justify-center
					rounded-full
					text-black/45
					cursor-pointer
					transition-colors
					duration-200
					ease-out
					hover:bg-black
					hover:text-cream
				"
			>
				<CloseIcon className="w-2.5 h-2.5" />
			</button>
		</span>
	)
}

// Always the last thing in the row.
function AddChip({ onClick }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="
				inline-flex
				items-center
				gap-1.5
				rounded-full
				border
				border-salmon
				bg-salmon
				px-4
				py-1.5
				font-vietnam
				text-sm
				text-cream
				cursor-pointer
				transition-all
				duration-200
				ease-out
				hover:-translate-y-0.5
				hover:shadow-lg
				hover:shadow-black/10
				active:translate-y-0
				active:shadow-none
			"
		>
			<PlusIcon className="w-3 h-3" />
			add
		</button>
	)
}

// The empty pill that takes the new tag's name. Enter turns it into a chip and
// Escape throws it away; clicking off keeps whatever was typed.
function ChipInput({ value, onChange, onCommit, onCancel }) {
	return (
		<span className="
			inline-flex
			items-center
			rounded-full
			border
			border-black/70
			px-4
			py-1.5
		">
			<input
				autoFocus
				value={value}
				onChange={(event) => onChange(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === 'Enter') {
						event.preventDefault()
						onCommit()
					}
					if (event.key === 'Escape') onCancel()
				}}
				onBlur={onCommit}
				placeholder="new tag"
				aria-label="New tag"
				className="
					w-24
					bg-transparent
					font-vietnam
					text-sm
					text-black
					outline-none
					placeholder:text-black/35
				"
			/>
		</span>
	)
}

function ConfirmRemoveDialog({ label, onCancel, onConfirm }) {
	// dismiss plays the exit animation and then closes for real — lib/dismiss.js
	const { closing, dismiss } = useDismiss()
	const cancel = () => dismiss(onCancel)

	useEffect(() => {
		const onKey = (event) => {
			if (event.key === 'Escape') cancel()
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	})

	return (
		<div
			className={`
				fixed
				inset-0
				z-50
				flex
				items-center
				justify-center
				bg-black/40
				p-4
				sm:p-8
				${closing ? 'dialog-leaving' : 'dialog-open'}
			`}
			onClick={cancel}
		>
			{/* the card swallows clicks so only the backdrop itself closes */}
			<div
				onClick={(event) => event.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-label="Remove tag"
				className="
					w-full
					max-w-[420px]
					bg-cream
					rounded-[20px]
					p-8
					shadow-[0_10px_40px_rgba(0,0,0,0.35)]
				"
			>
				<h2 className="
					font-beachday
					text-black
					text-[32px]
					leading-none
				">
					remove tag?
				</h2>
				<p className="
					font-vietnam
					text-sm
					text-black/60
					mt-3
				">
					“{label}” comes off the list and out of the category dropdown. Days
					already marked {label} keep their caption.
				</p>

				<div className="
					mt-8
					flex
					justify-end
					gap-3
				">
					<button
						type="button"
						onClick={cancel}
						className="
							rounded-full
							border
							border-black/70
							px-6
							py-2
							font-vietnam
							font-semibold
							text-sm
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
						"
					>
						cancel
					</button>
					<button
						type="button"
						onClick={() => dismiss(onConfirm)}
						className="
							rounded-full
							bg-red
							px-6
							py-2
							font-vietnam
							font-semibold
							text-sm
							text-white
							cursor-pointer
							transition-all
							duration-200
							ease-out
							hover:-translate-y-0.5
							hover:shadow-lg
							hover:shadow-black/20
							hover:brightness-95
							active:translate-y-0
							active:shadow-none
						"
					>
						remove
					</button>
				</div>
			</div>
		</div>
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
// badge, which is what makes the month itself read as a block. The badge takes
// its colour from the first thing on the day.
// `wave` is the cell's row plus its column, handed to the entrance animation as
// --wave: every cell on the same diagonal arrives together and each diagonal
// follows the one before it, so the month washes in from the top-left corner.
function Day({ number, inMonth, entries: dayEntries, wave = 0 }) {
	const first = dayEntries[0]
	const badge = first ? TRACKS[first.track].pill : 'bg-black text-cream'
	return (
		<div
			style={{ '--wave': wave }}
			className="
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
			"
		>
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

			{/* A seven-column month on a phone gives each day about 45px, which is
			    room for the badge and nothing else — so below `md` the cell is just
			    the badge and its colour, and what's on those days is listed under
			    the grid instead (see Agenda). */}
			{dayEntries.map((entry, i) => (
				<div key={i} className="
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
					<p className="
						font-vietnam
						text-sm
						leading-tight
						text-black
						mt-0.5
					">
						{entry.title}
					</p>
					{entry.time && (
						<p className="
							font-vietnam
							text-xs
							text-black/50
							mt-0.5
						">
							{prettyTime(entry.time)}
						</p>
					)}
				</div>
			))}
		</div>
	)
}

// What the cells can't say on a narrow screen. Every entry the month holds, in
// date order, carrying the same badge colour its cell does so the list and the
// grid read as the same thing.
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
				{days.map(({ number, entries: dayEntries }) =>
					dayEntries.map((entry, i) => (
						<li
							key={`${number}-${i}`}
							className="
								flex
								items-start
								gap-3
							"
						>
							{/* the number only rides the first row of a day that holds
							    several, so a day reads as one block rather than repeating
							    itself down the list */}
							<span className={`
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
								${i === 0 ? TRACKS[entry.track].pill : 'opacity-0'}
							`}>
								{number}
							</span>
							<div className="min-w-0">
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
								{entry.time && (
									<p className="
										font-vietnam
										text-xs
										text-black/50
										mt-0.5
									">
										{prettyTime(entry.time)}
									</p>
								)}
							</div>
						</li>
					))
				)}
			</ul>
		</div>
	)
}

// ---- new event dialog ------------------------------------------------------

const FIELD = `
	w-full
	rounded-[10px]
	border
	border-black/25
	bg-white
	px-4
	py-2.5
	font-vietnam
	text-sm
	text-black
	outline-none
	transition-colors
	duration-200
	focus:border-black
`

function Label({ children }) {
	return (
		<span className="
			block
			font-vietnam
			text-[11px]
			uppercase
			tracking-[0.12em]
			text-black/50
			mb-1.5
		">
			{children}
		</span>
	)
}

// Mounted only while open, so every visit starts on a blank form.
//
// The picked image is held as an object URL for the preview. The calendar never
// draws it — it rides along so the events dashboard, which does show photos,
// has one once this is posting to the API.
function EventDialog({ categories, onClose, onSave }) {
	// dismiss plays the exit animation and then closes for real — lib/dismiss.js
	const { closing, dismiss } = useDismiss()
	const close = () => dismiss(onClose)

	const [form, setForm] = useState({
		title: '',
		date: '',
		time: '',
		category: categories[0] ?? '',
		track: 'members',
		description: '',
	})
	const [image, setImage] = useState(null) // { file, preview }

	const set = (field) => (event) =>
		setForm((prev) => ({ ...prev, [field]: event.target.value }))

	// Escape closes, same as the backdrop.
	useEffect(() => {
		const onKey = (event) => {
			if (event.key === 'Escape') close()
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	})

	const pickImage = (event) => {
		const file = event.target.files?.[0]
		if (!file) return
		setImage((prev) => {
			if (prev?.preview) URL.revokeObjectURL(prev.preview)
			return { file, preview: URL.createObjectURL(file) }
		})
	}

	const ready = form.title.trim() !== '' && form.date !== ''

	const submit = (event) => {
		event.preventDefault()
		if (!ready) return
		dismiss(() =>
			onSave({
				...form,
				title: form.title.trim(),
				description: form.description.trim(),
				image,
			})
		)
	}

	return (
		<div
			className={`
				fixed
				inset-0
				z-50
				flex
				items-center
				justify-center
				bg-black/40
				p-4
				sm:p-8
				${closing ? 'dialog-leaving' : 'dialog-open'}
			`}
			onClick={close}
		>
			{/* the card swallows clicks so only the backdrop itself closes */}
			<form
				onClick={(event) => event.stopPropagation()}
				onSubmit={submit}
				role="dialog"
				aria-modal="true"
				aria-label="New event"
				className="
					w-full
					max-w-[560px]
					max-h-[90dvh]
					overflow-y-auto
					max-h-[85vh]
					overflow-y-auto
					bg-cream
					rounded-[20px]
					p-8
					shadow-[0_10px_40px_rgba(0,0,0,0.35)]
				"
			>
				<div className="
					flex
					items-start
					justify-between
					gap-4
				">
					<h2 className="
						font-beachday
						text-black
						text-[38px]
						leading-none
					">
						new event
					</h2>
					<button
						type="button"
						onClick={close}
						aria-label="Close"
						className="
							w-9
							h-9
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
							hover:brightness-125
							active:scale-95
						"
					>
						<CloseIcon className="w-4 h-4" />
					</button>
				</div>

				<p className="
					font-vietnam
					text-sm
					text-black/50
					mt-2
				">
					Labs are scheduled from the labs page
				</p>

				<div className="
					mt-6
					flex
					flex-col
					gap-4
				">
					<label className="block">
						<Label>title</Label>
						<input
							type="text"
							value={form.title}
							onChange={set('title')}
							placeholder="Glow Night"
							className={FIELD}
						/>
					</label>

					<div className="
						grid
						grid-cols-1
						sm:grid-cols-2
						gap-4
					">
						<label className="block">
							<Label>date</Label>
							<input
								type="date"
								value={form.date}
								onChange={set('date')}
								className={FIELD}
							/>
						</label>
						<label className="block">
							<Label>time</Label>
							<input
								type="time"
								value={form.time}
								onChange={set('time')}
								className={FIELD}
							/>
						</label>
					</div>

					<div className="
						grid
						grid-cols-1
						sm:grid-cols-2
						gap-4
					">
						<label className="block">
							<Label>category</Label>
							<select
								value={form.category}
								onChange={set('category')}
								className={`${FIELD} cursor-pointer`}
							>
								{categories.map((category) => (
									<option key={category} value={category}>
										{category}
									</option>
								))}
							</select>
						</label>

						{/* picks the badge colour, and whether members see it at all —
						    an officers day stays off their calendar */}
						<label className="block">
							<Label>who it&apos;s for</Label>
							<select
								value={form.track}
								onChange={set('track')}
								className={`${FIELD} cursor-pointer`}
							>
								{TRACK_KEYS.map((key) => (
									<option key={key} value={key}>
										{TRACKS[key].label}
									</option>
								))}
							</select>
						</label>
					</div>

					<label className="block">
						<Label>description</Label>
						<textarea
							value={form.description}
							onChange={set('description')}
							rows={3}
							placeholder="What's happening, where to meet, what to bring."
							className={`${FIELD} resize-none`}
						/>
					</label>

					<div>
						<Label>image</Label>
						<div className="
							flex
							items-center
							gap-4
						">
							<div className="
								w-20
								h-20
								shrink-0
								rounded-[10px]
								overflow-hidden
								bg-white
								border
								border-black/25
							">
								{image && (
									<img
										src={image.preview}
										alt=""
										className="
											w-full
											h-full
											object-cover
										"
									/>
								)}
							</div>
							<label className="
								inline-flex
								items-center
								rounded-full
								border
								border-black/70
								px-4
								py-1.5
								font-vietnam
								text-sm
								text-black
								cursor-pointer
								transition-all
								duration-200
								ease-out
								hover:-translate-y-0.5
								hover:shadow-lg
								hover:shadow-black/10
							">
								{image ? 'change image' : 'choose image'}
								<input
									type="file"
									accept="image/*"
									onChange={pickImage}
									className="hidden"
								/>
							</label>
						</div>
					</div>
				</div>

				<div className="
					mt-8
					flex
					justify-end
					gap-3
				">
					<button
						type="button"
						onClick={close}
						className="
							rounded-full
							border
							border-black/70
							px-6
							py-2
							font-vietnam
							font-semibold
							text-sm
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
						"
					>
						cancel
					</button>
					<button
						type="submit"
						disabled={!ready}
						className={`
							rounded-full
							px-6
							py-2
							font-vietnam
							font-semibold
							text-sm
							transition-all
							duration-200
							ease-out
							${ready
								? `bg-orange
								   text-white
								   cursor-pointer
								   hover:-translate-y-0.5
								   hover:shadow-lg
								   hover:shadow-black/20
								   active:translate-y-0
								   active:shadow-none`
								: 'bg-black/10 text-black/40 cursor-not-allowed'}
						`}
					>
						add to calendar
					</button>
				</div>
			</form>
		</div>
	)
}

// ---- page ------------------------------------------------------------------

export default function OfficerCalendar() {
	// Which month is on screen. Stepping goes through Date so December rolls
	// into January of the next year on its own.
	const [view, setView] = useState({ year: YEAR, month: MONTH })
	const [dialogOpen, setDialogOpen] = useState(false)

	// Everything added from this page, in the same 'YYYY-MM' -> day shape as the
	// seeded rows. Local only until /calendar is wired to the API.
	const [added, setAdded] = useState({})

	// The tag list is editable here: TYPES is only its starting point. Removing
	// one takes it out of the row and out of the category dropdown; days already
	// captioned with it keep their caption. Local until there's an API.
	const [types, setTypes] = useState(TYPES)
	const [adding, setAdding] = useState(false)
	const [draft, setDraft] = useState('')
	const [pendingRemoval, setPendingRemoval] = useState(null)

	const startAdding = () => {
		setDraft('')
		setAdding(true)
	}

	// A blank name or one already on the list closes the input without adding
	// anything, so Enter on an empty pill is a cancel rather than a dead end.
	const commitDraft = () => {
		const name = draft.trim()
		const taken = types.some((type) => type.toLowerCase() === name.toLowerCase())
		if (name && !taken) setTypes((prev) => [...prev, name])
		setDraft('')
		setAdding(false)
	}

	const cancelDraft = () => {
		setDraft('')
		setAdding(false)
	}

	const removeType = () => {
		setTypes((prev) => prev.filter((type) => type !== pendingRemoval))
		setPendingRemoval(null)
	}

	const step = (delta) =>
		setView(({ year, month }) => {
			const moved = new Date(year, month + delta, 1)
			return { year: moved.getFullYear(), month: moved.getMonth() }
		})

	// Drop the new event on its day and jump the view to the month it landed in,
	// so it's never saved out of sight.
	const saveEvent = ({ title, date, time, category, track, description, image }) => {
		const { key, day, year, month } = splitDateInput(date)
		const entry = {
			type: category,
			title,
			track,
			time,
			description,
			image,
		}
		setAdded((prev) => ({
			...prev,
			[key]: {
				...(prev[key] ?? {}),
				[day]: [...listFor(prev[key] ?? {}, day), entry],
			},
		}))
		setView({ year, month: month - 1 })
		setDialogOpen(false)
	}

	const weeks = monthWeeks(view.year, view.month)
	const stamp = monthKey(view.year, view.month)
	const seeded = entries[stamp] ?? {}
	const mine = added[stamp] ?? {}

	// The same days the grid draws a badge for, in date order — what the narrow
	// layout lists under the month.
	const agendaDays = [
		...new Set([...Object.keys(seeded), ...Object.keys(mine)].map(Number)),
	]
		.sort((a, b) => a - b)
		.map((number) => ({
			number,
			entries: [...listFor(seeded, number), ...listFor(mine, number)],
		}))
		.filter(({ entries: dayEntries }) => dayEntries.length)

	return (
		// my-auto rather than justify-center: it centers the sheet in the page but
		// still lets a tall month scroll from its top instead of clipping it.
		<DashboardShell className="
			flex
			flex-col
		">
			{/* SHEET_H holds the height of the row, so neither column is at the mercy
			    of how many week rows the month happens to have. items-stretch then
			    hands that same height to both, which is what lets the title sit on
			    the top edge and the legends on the bottom one. */}
			<div
				className="
					xl:my-auto
					flex
					flex-col
					xl:flex-row
					items-stretch
					gap-8
					xl:gap-8
					2xl:gap-12
					xl:min-h-[var(--sheet-h)]
					pr-0
					xl:pr-2
				"
				style={{ '--sheet-h': `${SHEET_H}px` }}
			>
				{/* left column: month and add button up top, legends at the bottom.
				    calendar-side / calendar-grid bring the two columns in from
				    opposite edges (see globals.css) — the depth is in them moving
				    against each other, with the day cells washing across after. */}
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

					<button
						type="button"
						onClick={() => setDialogOpen(true)}
						className="
							group
							mt-8
							flex
							items-center
							justify-center
							gap-2
							rounded-full
							bg-orange
							py-3
							font-vietnam
							font-semibold
							text-white
							text-sm
							uppercase
							tracking-[0.15em]
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
						<PlusIcon className="
							w-4
							h-4
							transition-transform
							duration-200
							ease-out
							group-hover:rotate-90
						" />
						add event
					</button>

					{/* mt-auto drops both legends to the bottom of the column, so they
					    finish level with the last rule of the grid. pt-12 keeps them off
					    the button on a short month. Stacked there's no grid beside them
					    to finish level with, so they just follow the button. */}
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

						<div className="
							mt-4
							flex
							flex-wrap
							justify-center
							gap-2
						">
							{types.map((type) => (
								<TypeChip
									key={type}
									label={type}
									onRemove={() => setPendingRemoval(type)}
								/>
							))}

							{/* the add pill closes the row, and swaps places with the
							    input while a tag is being named */}
							{adding ? (
								<ChipInput
									value={draft}
									onChange={setDraft}
									onCommit={commitDraft}
									onCancel={cancelDraft}
								/>
							) : (
								<AddChip onClick={startAdding} />
							)}
						</div>

						{/* colour key: the badge colour says who the day is for */}
						<div className="
							mt-10
							flex
							flex-wrap
							gap-2
						">
							{TRACK_KEYS.map((trackKey) => (
								<Pill key={trackKey} className={TRACKS[trackKey].pill}>
									{TRACKS[trackKey].label}
								</Pill>
							))}
						</div>
					</div>
				</div>

				{/* right column: the month grid */}
				<div className="
					calendar-grid
					flex-1
					min-w-0
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
					    remount, and the wave would come through in patches. */}
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
							"
						>
							{week.map((day, column) => (
								<Day
									key={`${i}-${day.number}`}
									wave={i + column + 1}
									number={day.number}
									inMonth={day.inMonth}
									entries={
										day.inMonth
											? [
												...listFor(seeded, day.number),
												...listFor(mine, day.number),
											]
											: []
									}
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

			{dialogOpen && (
				<EventDialog
					categories={categoriesFrom(types)}
					onClose={() => setDialogOpen(false)}
					onSave={saveEvent}
				/>
			)}

			{pendingRemoval && (
				<ConfirmRemoveDialog
					label={pendingRemoval}
					onCancel={() => setPendingRemoval(null)}
					onConfirm={removeType}
				/>
			)}
		</DashboardShell>
	)
}
