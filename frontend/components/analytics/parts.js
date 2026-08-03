'use client'

import { useEffect, useRef, useState } from 'react'
import { STATUS_PILL, money, prettyDate, sum } from '@/lib/finances'

// The pieces both analytics pages are built out of — the card, the pills, the
// charts, the dialog shell. They live here rather than in either page because
// an officer and the treasurer are looking at the same books: whatever the
// balance line or a donut does, it should do identically on both, and the only
// difference between the two pages should be what they let you touch.

// ---- icons -----------------------------------------------------------------

export function ArrowIcon({ up = true, className = '' }) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="3"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			{up ? <path d="M12 19V6M6 12l6-6 6 6" /> : <path d="M12 5v13M6 12l6 6 6-6" />}
		</svg>
	)
}

export function ChevronIcon({ className = '' }) {
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
			<path d="M6 9l6 6 6-6" />
		</svg>
	)
}

export function PlusIcon({ className = '' }) {
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
			<path d="M12 6v12M6 12h12" />
		</svg>
	)
}

export function CloseIcon({ className = '' }) {
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

export function CheckIcon({ className = '' }) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="3.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			<path d="M5 12.5l4.5 4.5L19 7" />
		</svg>
	)
}

export function PencilIcon({ className = '' }) {
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
			<path d="M4 20h4l10-10-4-4L4 16z" />
			<path d="M14 6l4 4" />
		</svg>
	)
}

export function TrashIcon({ className = '' }) {
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
			<path d="M4 7h16" />
			<path d="M9.5 7V5h5v2" />
			<path d="M6.5 7l.8 12.5h9.4L17.5 7" />
			<path d="M10.5 10.5v6M13.5 10.5v6" />
		</svg>
	)
}

export function FilterIcon({ className = '' }) {
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
			<path d="M3.5 5.5h17l-6.5 7.5v6l-4 2.5v-8.5z" />
		</svg>
	)
}

// Points up when ascending, down when descending. Dimmed and pointing both ways
// on the columns that aren't currently sorted, so every sortable header says so
// without shouting over the one that's active.
export function SortArrow({ state, className = '' }) {
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
			{state !== 'desc' && <path d="M7 11l5-5 5 5" />}
			{state !== 'asc' && <path d="M7 13l5 5 5-5" />}
		</svg>
	)
}

export function ReceiptIcon({ className = '' }) {
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
			<path d="M6 3.5h12v17l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5z" />
			<path d="M9 8h6M9 11.5h6M9 15h3.5" />
		</svg>
	)
}

export function EarningsIcon({ className = '' }) {
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
			<circle cx="12" cy="12" r="8.5" />
			<path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.4 0-2.5.8-2.5 2s1.1 1.8 2.5 2 2.5.6 2.5 2-1.1 2-2.5 2c-1 0-2-.5-2.5-1.5" />
			<path d="M12 6.5v11" />
		</svg>
	)
}

export function SpendingIcon({ className = '' }) {
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
			<path d="M3.5 5.5h2.2l2 10.5h10.3" />
			<path d="M6.6 8.5h13l-1.4 5.5H7.7" />
			<circle cx="9.5" cy="19.5" r="1.2" />
			<circle cx="17" cy="19.5" r="1.2" />
		</svg>
	)
}

export function BalanceIcon({ className = '' }) {
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
			<path d="M3.5 8.5a2 2 0 012-2h11a2 2 0 012 2v9a2 2 0 01-2 2h-11a2 2 0 01-2-2z" />
			<path d="M16.5 11h3.5v4h-3.5a2 2 0 010-4z" />
			<path d="M6 6.5l9-3" />
		</svg>
	)
}

// ---- small pieces ----------------------------------------------------------

export function Card({ className = '', children }) {
	return (
		<section className={`
			rounded-[16px]
			bg-white
			p-6
			shadow-[0_0_20px_rgba(0,0,0,0.15)]
			${className}
		`}>
			{children}
		</section>
	)
}

export function CardTitle({ children }) {
	return (
		<h2 className="
			font-vietnam
			font-semibold
			text-[18px]
			text-black
		">
			{children}
		</h2>
	)
}

export function CardNote({ children }) {
	return (
		<p className="
			mt-1
			font-vietnam
			text-sm
			text-black/50
		">
			{children}
		</p>
	)
}

export function StatusPill({ status }) {
	return (
		<span className={`
			inline-flex
			items-center
			rounded-full
			px-3
			py-1
			font-vietnam
			font-semibold
			text-xs
			whitespace-nowrap
			${STATUS_PILL[status] ?? 'bg-black/10 text-black/60'}
		`}>
			{status}
		</span>
	)
}

// The year, sitting in a card's top-right corner. A label, not a control — the
// picker that changes it is up in the page header.
export function YearTag({ year }) {
	return (
		<span className="
			rounded-full
			bg-cream
			px-4
			py-1.5
			font-vietnam
			font-semibold
			text-sm
			text-black
			whitespace-nowrap
		">
			{year}
		</span>
	)
}

// A category as it reads outside a chart: its colour as a dot, then its name.
export function CategoryTag({ category, color }) {
	return (
		<span className="
			inline-flex
			items-center
			gap-2
			font-vietnam
			text-sm
			text-black/70
			whitespace-nowrap
		">
			<span
				className="
					w-2.5
					h-2.5
					shrink-0
					rounded-full
				"
				style={{ backgroundColor: color }}
			/>
			{category}
		</span>
	)
}

// A real <select> so it keeps the keyboard and the phone's native picker; the
// chevron is drawn alongside because `appearance-none` takes the browser's own
// away.
export function Select({ value, onChange, options, label }) {
	return (
		<div className="relative">
			<select
				value={value}
				onChange={(event) => onChange(event.target.value)}
				aria-label={label}
				className="
					appearance-none
					rounded-[10px]
					border
					border-black/20
					bg-white
					pl-4
					pr-9
					py-1.5
					font-vietnam
					text-sm
					text-black
					outline-none
					cursor-pointer
					transition-colors
					duration-200
					ease-out
					hover:border-black/60
					focus:border-black
				"
			>
				{options.map((option) => (
					<option key={option} value={option}>
						{option}
					</option>
				))}
			</select>
			<ChevronIcon className="
				pointer-events-none
				absolute
				right-3
				top-1/2
				w-3.5
				h-3.5
				-translate-y-1/2
				text-black/45
			" />
		</div>
	)
}

// How far along. Anything over 100% is pinned to full so a card can't draw
// outside itself.
export function ProgressBar({ value, tint }) {
	return (
		<div className="
			h-2
			w-full
			overflow-hidden
			rounded-full
			bg-black/[0.08]
		">
			<div
				className={`
					h-full
					rounded-full
					transition-[width]
					duration-500
					ease-out
					${tint}
				`}
				style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
			/>
		</div>
	)
}

// ---- sorting and filtering -------------------------------------------------

// A real checkbox kept for the keyboard and screen readers, with the visible
// box drawn next to it. Same shape as the roster's, which is where anyone using
// this app will have met it first.
function Checkbox({ checked, onChange, label }) {
	return (
		<label className="
			inline-flex
			items-center
			justify-center
			cursor-pointer
		">
			<input
				type="checkbox"
				checked={checked}
				onChange={onChange}
				aria-label={label}
				className="peer sr-only"
			/>
			<span className={`
				w-[18px]
				h-[18px]
				flex
				items-center
				justify-center
				rounded-[5px]
				border
				transition-colors
				duration-150
				ease-out
				peer-focus-visible:ring-2
				peer-focus-visible:ring-blue-med
				peer-focus-visible:ring-offset-2
				${checked
					? 'bg-blue-med border-blue-med text-white'
					: 'bg-white border-black/30 hover:border-black/60'}
			`}>
				{checked && <CheckIcon className="w-3 h-3" />}
			</span>
		</label>
	)
}

// One sortable column head. First click sorts ascending, clicking the column
// that's already sorted flips the direction.
export function SortHeader({ label, column, sort, onSort, align = 'left', className = '' }) {
	const active = sort.key === column
	const state = active ? sort.dir : 'none'

	return (
		<th
			scope="col"
			className={`
				px-2
				py-3
				${align === 'right' ? 'text-right' : 'text-left'}
				${className}
			`}
		>
			<button
				type="button"
				onClick={() => onSort(column)}
				aria-label={`Sort by ${label}`}
				className="
					group
					inline-flex
					items-center
					gap-1.5
					font-vietnam
					font-bold
					text-[12px]
					uppercase
					tracking-[0.08em]
					text-black
					whitespace-nowrap
					cursor-pointer
				"
			>
				{label}
				<SortArrow
					state={state}
					className={`
						w-3
						h-3
						shrink-0
						transition-opacity
						duration-150
						ease-out
						${active ? 'opacity-100' : 'opacity-40 group-hover:opacity-70'}
					`}
				/>
			</button>
		</th>
	)
}

// Ticking nothing means everything, which is also what the funnel starts as —
// so "show all" is just untick everything. Same control the roster filters
// roles with, pointed at whichever column the table in question filters on.
export function ColumnFilter({ label, options, picked, onChange }) {
	const [open, setOpen] = useState(false)
	const wrapper = useRef(null)

	useEffect(() => {
		if (!open) return
		const onDown = (event) => {
			if (!wrapper.current?.contains(event.target)) setOpen(false)
		}
		const onKey = (event) => {
			if (event.key === 'Escape') setOpen(false)
		}
		window.addEventListener('mousedown', onDown)
		window.addEventListener('keydown', onKey)
		return () => {
			window.removeEventListener('mousedown', onDown)
			window.removeEventListener('keydown', onKey)
		}
	}, [open])

	const toggle = (value) =>
		onChange(
			picked.includes(value)
				? picked.filter((kept) => kept !== value)
				: [...picked, value]
		)

	const filtering = picked.length > 0

	return (
		<div ref={wrapper} className="relative">
			<button
				type="button"
				onClick={() => setOpen((was) => !was)}
				aria-label={`Filter by ${label}`}
				aria-expanded={open}
				className={`
					w-10
					h-10
					flex
					items-center
					justify-center
					rounded-full
					border
					cursor-pointer
					transition-all
					duration-200
					ease-out
					hover:-translate-y-0.5
					hover:shadow-lg
					hover:shadow-black/10
					active:translate-y-0
					active:shadow-none
					${filtering
						? 'bg-blue-med border-blue-med text-white'
						: 'bg-white border-black/20 text-black'}
				`}
			>
				<FilterIcon className="w-[18px] h-[18px]" />
			</button>

			{open && (
				<div className="
					absolute
					right-0
					top-12
					z-40
					w-56
					rounded-[14px]
					bg-white
					p-3
					shadow-[0_10px_30px_rgba(0,0,0,0.2)]
				">
					<p className="
						font-vietnam
						text-[11px]
						uppercase
						tracking-[0.12em]
						text-black/50
						px-1
						pb-2
					">
						{label}
					</p>

					<div className="
						flex
						flex-col
						gap-0.5
					">
						{options.map((option) => (
							<label
								key={option.value}
								className="
									flex
									items-center
									gap-2.5
									rounded-[8px]
									px-2
									py-1.5
									font-vietnam
									text-sm
									text-black
									cursor-pointer
									transition-colors
									duration-150
									ease-out
									hover:bg-cream
								"
							>
								<Checkbox
									checked={picked.includes(option.value)}
									onChange={() => toggle(option.value)}
									label={option.label}
								/>
								{option.node ?? option.label}
							</label>
						))}
					</div>

					<button
						type="button"
						onClick={() => onChange([])}
						disabled={!filtering}
						className={`
							mt-2
							w-full
							rounded-full
							py-1.5
							font-vietnam
							font-semibold
							text-xs
							transition-colors
							duration-150
							ease-out
							${filtering
								? 'text-black/70 cursor-pointer hover:bg-cream'
								: 'text-black/25 cursor-not-allowed'}
						`}
					>
						show all
					</button>
				</div>
			)}
		</div>
	)
}

export const FIELD = `
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

export function Label({ children }) {
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

// The two buttons at the foot of every dialog. `ready` false greys the primary
// one out rather than hiding it, so the form always shows what it's waiting for.
export function DialogActions({ onCancel, submitLabel, ready = true, tint = 'bg-salmon' }) {
	return (
		<div className="
			mt-8
			flex
			justify-end
			gap-3
		">
			<button
				type="button"
				onClick={onCancel}
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
						? `${tint}
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
				{submitLabel}
			</button>
		</div>
	)
}

// The shell every dialog on these pages sits in: backdrop, escape, the card
// that swallows its own clicks so only the backdrop closes, and the title row
// with its close button. `as` is 'form' for anything being filled in, so the
// enter key submits from any field.
export function Dialog({ title, note, onClose, onSubmit, children, width = 'w-[560px]' }) {
	useEffect(() => {
		const onKey = (event) => {
			if (event.key === 'Escape') onClose()
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [onClose])

	const Body = onSubmit ? 'form' : 'div'

	return (
		<div
			className="
				fixed
				inset-0
				z-50
				flex
				items-center
				justify-center
				bg-black/40
				p-8
			"
			onClick={onClose}
		>
			<Body
				onClick={(event) => event.stopPropagation()}
				onSubmit={onSubmit}
				role="dialog"
				aria-modal="true"
				aria-label={title}
				className={`
					${width}
					max-h-[85vh]
					overflow-y-auto
					bg-cream
					rounded-[20px]
					p-8
					shadow-[0_10px_40px_rgba(0,0,0,0.35)]
				`}
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
						{title}
					</h2>
					<button
						type="button"
						onClick={onClose}
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

				{note && (
					<p className="
						font-vietnam
						text-sm
						text-black/50
						mt-2
					">
						{note}
					</p>
				)}

				{children}
			</Body>
		</div>
	)
}

// Deleting a ledger row is the one thing on these pages that can't be undone
// from the page itself, so it gets asked about by name.
export function ConfirmDialog({ title, body, confirmLabel, onCancel, onConfirm }) {
	return (
		<Dialog title={title} onClose={onCancel} width="w-[440px]">
			<p className="
				font-vietnam
				text-sm
				text-black/60
				mt-3
			">
				{body}
			</p>

			<div className="
				mt-8
				flex
				justify-end
				gap-3
			">
				<button
					type="button"
					onClick={onCancel}
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
					onClick={onConfirm}
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
					{confirmLabel}
				</button>
			</div>
		</Dialog>
	)
}

// ---- the three cards along the top -----------------------------------------

function TrendTag({ change, good }) {
	const up = change >= 0
	const helping = (up && good === 'up') || (!up && good === 'down')

	return (
		<span className={`
			inline-flex
			items-center
			gap-1
			rounded-full
			px-2
			py-0.5
			font-vietnam
			font-semibold
			text-[11px]
			${helping ? 'bg-green/40 text-green-dark' : 'bg-salmon-lightest text-salmon-dark'}
		`}>
			<ArrowIcon up={up} className="w-2.5 h-2.5" />
			{Math.abs(change).toFixed(1)}%
		</span>
	)
}

// `good` is which direction is the good one: spending less than last month is
// an improvement, earning less isn't.
export function StatCard({ label, stat, icon, tint, good }) {
	const up = stat.delta >= 0

	return (
		<Card>
			<div className="
				flex
				items-center
				gap-2.5
			">
				<span className={`
					w-8
					h-8
					shrink-0
					flex
					items-center
					justify-center
					rounded-full
					text-black/70
					${tint}
				`}>
					{icon}
				</span>
				<CardTitle>{label}</CardTitle>
			</div>

			<div className="
				mt-4
				flex
				items-end
				gap-2
			">
				<p className="
					font-vietnam
					font-bold
					text-[30px]
					leading-none
					text-black
					tabular-nums
				">
					{money(stat.value)}
				</p>
				{stat.change !== null && <TrendTag change={stat.change} good={good} />}
			</div>

			<p className="
				mt-2
				font-vietnam
				text-sm
				text-black/50
			">
				<span className="text-black/70">
					{up ? '+' : '−'}{money(Math.abs(stat.delta))}
				</span>
				{' '}than last month
			</p>
		</Card>
	)
}

// ---- balance summary -------------------------------------------------------

// Roughly 2:1 — the card it sits in is a fixed height, and a wider box than
// this leaves the chart floating in the middle of it with air above and below.
const CHART = {
	width: 760,
	height: 380,
	padTop: 18,
	padRight: 18,
	padBottom: 34,
	padLeft: 64,
}

// Axis labels: $0, $1.25k, $2.5k — the chart is read for shape, not for cents.
function axisLabel(value) {
	if (value === 0) return '$0'
	if (value < 1000) return `$${Math.round(value)}`
	return `$${Number((value / 1000).toFixed(2))}k`
}

// A step the eye can divide: the axis runs 0 to step*4, so the four gridlines
// always land on round money instead of on 1,115 and its multiples.
function axisScale(peak) {
	if (!(peak > 0)) return { step: 250, max: 1000 }
	const raw = peak / 4
	const power = Math.pow(10, Math.floor(Math.log10(raw)))
	const scaled = raw / power
	const nice = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 10].find((candidate) => scaled <= candidate) ?? 10
	const step = nice * power
	return { step, max: step * 4 }
}

// A cubic through every point, with the handles dropped on the midpoint of each
// gap. Enough to round the corners off without letting the curve overshoot a
// month it never actually hit.
function linePath(points) {
	if (points.length === 0) return ''
	let path = `M ${points[0].x} ${points[0].y}`
	for (let i = 1; i < points.length; i++) {
		const previous = points[i - 1]
		const point = points[i]
		const middle = (previous.x + point.x) / 2
		path += ` C ${middle} ${previous.y}, ${middle} ${point.y}, ${point.x} ${point.y}`
	}
	return path
}

export function BalanceChart({ series }) {
	// Resting on the last month rather than on nothing, so the card always has a
	// number on it — hovering only moves the read-out along.
	const [hover, setHover] = useState(null)

	const { step, max } = axisScale(Math.max(...series.map((point) => point.value)))
	const plotWidth = CHART.width - CHART.padLeft - CHART.padRight
	const plotHeight = CHART.height - CHART.padTop - CHART.padBottom
	const baseline = CHART.padTop + plotHeight
	const gap = plotWidth / (series.length - 1)

	const points = series.map((point, i) => ({
		...point,
		x: CHART.padLeft + i * gap,
		y: CHART.padTop + (1 - point.value / max) * plotHeight,
	}))

	const reading = hover ?? points.length - 1
	const active = points[reading]
	const ticks = [0, 1, 2, 3, 4].map((i) => i * step)

	// The read-out is 150 wide and sits over its point; clamping it to the plot
	// keeps january's and july's from hanging off the card.
	const tipWidth = 150
	const tipLeft = Math.min(
		Math.max(active.x - tipWidth / 2, CHART.padLeft),
		CHART.width - CHART.padRight - tipWidth
	)
	// above the point unless the month is a high one, where there's no room for
	// it up there and pinning it to the top edge would sit it on the dot
	const roomAbove = active.y - 62 >= CHART.padTop
	const tipTop = roomAbove ? active.y - 62 : active.y + 16

	return (
		<svg
			viewBox={`0 0 ${CHART.width} ${CHART.height}`}
			className="
				w-full
				h-auto
				max-h-full
				select-none
			"
			onMouseLeave={() => setHover(null)}
			role="img"
			aria-label="Balance at the close of each month"
		>
			<defs>
				<linearGradient id="balance-fill" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stopColor="#FF8A78" stopOpacity="0.45" />
					<stop offset="100%" stopColor="#FF8A78" stopOpacity="0" />
				</linearGradient>
			</defs>

			{/* gridlines and the money they stand for */}
			{ticks.map((tick) => {
				const y = CHART.padTop + (1 - tick / max) * plotHeight
				return (
					<g key={tick}>
						<line
							x1={CHART.padLeft}
							y1={y}
							x2={CHART.width - CHART.padRight}
							y2={y}
							stroke="rgba(0,0,0,0.12)"
							strokeWidth="1"
							strokeDasharray="4 6"
						/>
						<text
							x={CHART.padLeft - 12}
							y={y + 4}
							textAnchor="end"
							className="
								font-vietnam
								fill-black/40
								text-[11px]
							"
						>
							{axisLabel(tick)}
						</text>
					</g>
				)
			})}

			<path
				d={`${linePath(points)} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`}
				fill="url(#balance-fill)"
			/>
			<path
				d={linePath(points)}
				fill="none"
				stroke="#E35944"
				strokeWidth="2.5"
				strokeLinecap="round"
			/>

			{/* the month being read: a dropped line, a dot, and the amount */}
			<line
				x1={active.x}
				y1={active.y}
				x2={active.x}
				y2={baseline}
				stroke="rgba(0,0,0,0.35)"
				strokeWidth="1"
				strokeDasharray="3 4"
			/>
			<circle
				cx={active.x}
				cy={active.y}
				r="6"
				fill="#FFFBEB"
				stroke="#E35944"
				strokeWidth="2.5"
			/>

			<g>
				<rect
					x={tipLeft}
					y={tipTop}
					width={tipWidth}
					height="46"
					rx="10"
					fill="#171717"
				/>
				<text
					x={tipLeft + tipWidth / 2}
					y={tipTop + 20}
					textAnchor="middle"
					className="
						font-vietnam
						fill-white
						text-[14px]
						font-semibold
					"
				>
					{money(active.value)}
				</text>
				<text
					x={tipLeft + tipWidth / 2}
					y={tipTop + 36}
					textAnchor="middle"
					className="
						font-vietnam
						fill-white/60
						text-[11px]
					"
				>
					balance | {active.month}
				</text>
			</g>

			{/* month names, and the invisible column each one answers to */}
			{points.map((point, i) => (
				<g key={point.month}>
					<text
						x={point.x}
						y={CHART.height - 10}
						textAnchor="middle"
						className={`
							font-vietnam
							text-[12px]
							${i === reading ? 'fill-black font-semibold' : 'fill-black/45'}
						`}
					>
						{point.month}
					</text>
					<rect
						x={point.x - gap / 2}
						y={CHART.padTop}
						width={gap}
						height={plotHeight + 24}
						fill="transparent"
						onMouseEnter={() => setHover(i)}
					/>
				</g>
			))}
		</svg>
	)
}

// The card the chart sits in, held to a fixed height so the tall list beside it
// scrolls inside its own card rather than dragging the row down and leaving the
// chart sitting in a white field.
export function BalanceCard({ series, year, note }) {
	return (
		<Card className="
			flex
			flex-col
			lg:col-span-2
			lg:h-[460px]
		">
			<div className="
				flex
				items-start
				justify-between
				gap-4
			">
				<div>
					<CardTitle>balance summary</CardTitle>
					<CardNote>{note}</CardNote>
				</div>
				<YearTag year={year} />
			</div>

			<div className="
				mt-4
				flex-1
				min-h-0
				flex
				items-center
			">
				<BalanceChart series={series} />
			</div>
		</Card>
	)
}

// ---- income and expense summaries ------------------------------------------

// Small enough that the legend beside it keeps the room to spell out
// "fundraisers" when two summaries are sharing a 1280 window.
const DONUT = { size: 168, radius: 60, thickness: 22 }
const CIRCUMFERENCE = 2 * Math.PI * DONUT.radius

// Hovering a slice or its legend row dims the other three, which is the only
// way to tell two neighbouring slices apart at a glance.
function Donut({ slices, total, hovered, onHover }) {
	// Each arc starts where the ones before it finished. Read off the slices
	// ahead of time rather than counted up inside the map, which would be a
	// running total reassigned from a callback React is free to re-run.
	const arcs = slices.map((slice, index) => {
		const length = (amount) => (total > 0 ? (amount / total) * CIRCUMFERENCE : 0)
		return {
			...slice,
			length: length(slice.amount),
			offset: length(sum(slices.slice(0, index).map((earlier) => earlier.amount))),
		}
	})

	return (
		<svg
			viewBox={`0 0 ${DONUT.size} ${DONUT.size}`}
			className="
				w-[168px]
				h-[168px]
				shrink-0
			"
			onMouseLeave={() => onHover(null)}
			role="img"
			aria-label="Share of the total by category"
		>
			<g transform={`rotate(-90 ${DONUT.size / 2} ${DONUT.size / 2})`}>
				{arcs.map((arc) => (
					<circle
						key={arc.key}
						cx={DONUT.size / 2}
						cy={DONUT.size / 2}
						r={DONUT.radius}
						fill="none"
						stroke={arc.color}
						strokeWidth={hovered === arc.key ? DONUT.thickness + 6 : DONUT.thickness}
						strokeDasharray={`${Math.max(arc.length - 2, 0)} ${CIRCUMFERENCE}`}
						strokeDashoffset={-arc.offset}
						strokeLinecap="butt"
						opacity={hovered !== null && hovered !== arc.key ? 0.3 : 1}
						onMouseEnter={() => onHover(arc.key)}
						className="
							cursor-pointer
							transition-all
							duration-200
							ease-out
						"
					/>
				))}
			</g>

			<text
				x={DONUT.size / 2}
				y={DONUT.size / 2 - 4}
				textAnchor="middle"
				className="
					font-vietnam
					fill-black/45
					text-[12px]
				"
			>
				total
			</text>
			<text
				x={DONUT.size / 2}
				y={DONUT.size / 2 + 18}
				textAnchor="middle"
				className="
					font-vietnam
					fill-black
					text-[20px]
					font-bold
				"
			>
				{money(total, false)}
			</text>
		</svg>
	)
}

// The figure the bar is measured against. A label until the treasurer clicks
// the pencil, an input while they're changing it — nobody else is handed the
// pencil, so for an officer it stays a label.
function GoalAmount({ value, onChange }) {
	const [draft, setDraft] = useState(null)
	const input = useRef(null)

	useEffect(() => {
		if (draft !== null) input.current?.select()
	}, [draft])

	const commit = () => {
		const amount = Number(draft)
		if (Number.isFinite(amount) && amount > 0) onChange(amount)
		setDraft(null)
	}

	if (!onChange) return <span className="text-black/70">{money(value, false)}</span>

	if (draft !== null) {
		return (
			<input
				ref={input}
				type="number"
				min="0"
				step="50"
				value={draft}
				onChange={(event) => setDraft(event.target.value)}
				onBlur={commit}
				onKeyDown={(event) => {
					if (event.key === 'Enter') {
						event.preventDefault()
						commit()
					}
					if (event.key === 'Escape') setDraft(null)
				}}
				aria-label="Amount"
				className="
					w-24
					rounded-[6px]
					border
					border-black
					bg-white
					px-2
					py-0.5
					font-vietnam
					text-sm
					text-black
					tabular-nums
					outline-none
				"
			/>
		)
	}

	return (
		<button
			type="button"
			onClick={() => setDraft(String(value))}
			className="
				group
				inline-flex
				items-center
				gap-1
				rounded-[6px]
				px-1
				font-vietnam
				text-sm
				text-black/70
				cursor-pointer
				transition-colors
				duration-150
				ease-out
				hover:bg-cream
				hover:text-black
			"
		>
			{money(value, false)}
			<PencilIcon className="
				w-3
				h-3
				opacity-40
				transition-opacity
				duration-150
				ease-out
				group-hover:opacity-100
			" />
		</button>
	)
}

// `onGoal` is what makes this the treasurer's copy of the card: with it the
// target is editable, without it the same card is a read-out.
export function SummaryCard({ title, categories, totals, total, goal, goalNote, onGoal, tint, year }) {
	const [hovered, setHovered] = useState(null)

	const slices = categories.map((category) => ({
		...category,
		amount: totals[category.key] ?? 0,
	}))

	return (
		<Card>
			<div className="
				flex
				items-start
				justify-between
				gap-4
			">
				<CardTitle>{title}</CardTitle>
				<YearTag year={year} />
			</div>

			<div className="
				mt-4
				flex
				items-center
				gap-5
			">
				<Donut
					slices={slices}
					total={total}
					hovered={hovered}
					onHover={setHovered}
				/>

				{/* the name and its share share the top line, the money sits under
				    them — side by side the label loses to the amount as soon as the
				    card narrows, and truncates away to nothing */}
				<div className="
					flex-1
					min-w-0
					flex
					flex-col
					gap-3
				">
					{slices.map((slice) => (
						<button
							key={slice.key}
							type="button"
							onMouseEnter={() => setHovered(slice.key)}
							onMouseLeave={() => setHovered(null)}
							className={`
								rounded-[8px]
								px-2
								py-1
								text-left
								cursor-pointer
								transition-colors
								duration-150
								ease-out
								hover:bg-cream
								${hovered === slice.key ? 'bg-cream' : ''}
							`}
						>
							<span className="
								flex
								items-center
								gap-2
							">
								<span
									className="
										w-2.5
										h-2.5
										shrink-0
										rounded-full
									"
									style={{ backgroundColor: slice.color }}
								/>
								<span className="
									flex-1
									min-w-0
									font-vietnam
									text-sm
									text-black/60
									truncate
								">
									{slice.label}
								</span>
								<span className="
									shrink-0
									font-vietnam
									text-xs
									text-black/40
									tabular-nums
								">
									{total > 0 ? Math.round((slice.amount / total) * 100) : 0}%
								</span>
							</span>

							<span className="
								block
								pl-[18px]
								font-vietnam
								font-bold
								text-[17px]
								text-black
								tabular-nums
							">
								{money(slice.amount)}
							</span>
						</button>
					))}
				</div>
			</div>

			<div className="mt-5">
				<div className="
					flex
					items-center
					justify-between
					gap-3
				">
					<p className="
						font-vietnam
						text-sm
						text-black/55
					">
						of the <GoalAmount value={goal} onChange={onGoal} /> {goalNote}
					</p>
					<p className="
						font-vietnam
						font-bold
						text-sm
						text-black
						tabular-nums
					">
						{goal > 0 ? Math.round((total / goal) * 100) : 0}%
					</p>
				</div>
				<div className="mt-2">
					<ProgressBar value={goal > 0 ? (total / goal) * 100 : 0} tint={tint} />
				</div>
			</div>
		</Card>
	)
}

// ---- grant tracker ---------------------------------------------------------

// `onEdit` is the treasurer's version again: with it every row is a button that
// opens the grant for changing, without it the list is a read-out.
export function GrantTracker({ grants, onEdit, onAdd }) {
	// Newest deadline first: what's still in flight is what anyone opens this
	// card to look at, and last year's awards sit underneath it.
	const listed = [...grants].sort((a, b) => b.due.localeCompare(a.due))

	const awarded = sum(grants.filter((grant) => grant.status === 'awarded').map((grant) => grant.amount))
	const requested = sum(grants.map((grant) => grant.amount))
	const waiting = sum(
		grants
			.filter((grant) => grant.status === 'under review' || grant.status === 'drafting')
			.map((grant) => grant.amount)
	)

	const Row = onEdit ? 'button' : 'div'

	return (
		<Card className="
			flex
			flex-col
			lg:h-[460px]
		">
			<div className="
				flex
				items-start
				justify-between
				gap-3
			">
				<CardTitle>grant tracker</CardTitle>
				{onAdd ? (
					<button
						type="button"
						onClick={onAdd}
						className="
							group
							flex
							shrink-0
							items-center
							gap-1.5
							rounded-full
							bg-green
							pl-2.5
							pr-4
							py-1.5
							font-vietnam
							font-semibold
							text-xs
							text-green-dark
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
							w-3.5
							h-3.5
							transition-transform
							duration-200
							ease-out
							group-hover:rotate-90
						" />
						add
					</button>
				) : (
					<span className="
						font-vietnam
						text-xs
						text-black/45
						whitespace-nowrap
					">
						{grants.length} applications
					</span>
				)}
			</div>

			<p className="
				mt-4
				font-vietnam
				font-bold
				text-[26px]
				leading-none
				text-black
				tabular-nums
			">
				{money(awarded)}
			</p>
			<p className="
				mt-1.5
				font-vietnam
				text-sm
				text-black/50
			">
				awarded of {money(requested, false)} applied for
			</p>

			<div className="mt-3">
				<ProgressBar
					value={requested > 0 ? (awarded / requested) * 100 : 0}
					tint="bg-green"
				/>
			</div>

			<p className="
				mt-2
				font-vietnam
				text-xs
				text-black/45
			">
				{money(waiting, false)} still waiting on an answer
			</p>

			{/* the name gets the whole top line to itself — sharing it with the
			    status pill leaves it too little to say which grant this is. min-h-0
			    is what lets the list scroll inside the card instead of stretching
			    it past the chart it sits next to */}
			<div className="
				mt-5
				flex-1
				min-h-0
				flex
				flex-col
				gap-2.5
				overflow-y-auto
			">
				{listed.map((grant) => (
					<Row
						key={grant.id}
						{...(onEdit
							? { type: 'button', onClick: () => onEdit(grant), 'aria-label': `Edit ${grant.name}` }
							: {})}
						className={`
							shrink-0
							rounded-[12px]
							bg-cream
							px-4
							py-3
							text-left
							transition-transform
							duration-200
							ease-out
							hover:-translate-y-0.5
							${onEdit ? 'cursor-pointer' : ''}
						`}
					>
						<div className="
							flex
							items-baseline
							justify-between
							gap-3
						">
							<p className="
								min-w-0
								flex-1
								font-vietnam
								font-semibold
								text-sm
								text-black
								truncate
							">
								{grant.name}
							</p>
							<span className="
								shrink-0
								font-vietnam
								font-bold
								text-sm
								text-black
								tabular-nums
							">
								{money(grant.amount, false)}
							</span>
						</div>

						<div className="
							mt-1.5
							flex
							items-center
							justify-between
							gap-3
						">
							<p className="
								min-w-0
								flex-1
								font-vietnam
								text-xs
								text-black/45
								truncate
							">
								{grant.org} · due {prettyDate(grant.due)}
							</p>
							<StatusPill status={grant.status} />
						</div>
					</Row>
				))}

				{grants.length === 0 && (
					<p className="
						py-8
						text-center
						font-vietnam
						text-sm
						text-black/45
					">
						no applications yet
					</p>
				)}
			</div>
		</Card>
	)
}

// ---- page frame ------------------------------------------------------------

// The controls that sit on the cream above the cards — the year picker, and
// anything else a page wants up there. No page title: the sidebar already says
// which page this is, and the cards name themselves.
//
// No top padding, so the picker's top edge lands on the sidebar's: the shell
// gives both columns the same p-8 and they start on the same line.
export function PageControls({ children }) {
	return (
		<div className="
			flex
			flex-wrap
			items-center
			justify-end
			gap-3
		">
			{children}
		</div>
	)
}

// The three cards along the top, which read the same on both pages: this month
// in, this month out, and what's in the account right now.
export function MonthStats({ stats }) {
	return (
		<div className="
			grid
			grid-cols-1
			gap-6
			md:grid-cols-3
		">
			<StatCard
				label="earnings"
				stat={stats.earnings}
				icon={<EarningsIcon className="w-4 h-4" />}
				tint="bg-green"
				good="up"
			/>
			<StatCard
				label="spending's"
				stat={stats.spendings}
				icon={<SpendingIcon className="w-4 h-4" />}
				tint="bg-salmon"
				good="down"
			/>
			<StatCard
				label="current balance"
				stat={stats.balance}
				icon={<BalanceIcon className="w-4 h-4" />}
				tint="bg-blue-light"
				good="up"
			/>
		</div>
	)
}
