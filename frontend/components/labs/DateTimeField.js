'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { INSET } from '@/components/labs/EditorParts'

// The edit page's "date" box: the browser's own date-and-time input, which
// can still be typed into, with the design's grey calendar icon at its right
// end in place of the browser's. The icon opens a small calendar and time
// picker underneath it.
//
// The value is what <input type="datetime-local"> speaks: 'YYYY-MM-DDTHH:MM',
// or '' for nothing. A date with no time picked yet is held as 00:00, which
// the editor already reads as "no start time".
//
// The picker is portalled to <body> so the middle column's scroll box can't
// clip it; `zoom` is the page's, so it comes out the same size as everything
// else, and its position is divided back by it (zoom scales top/left too).

const WIDTH = 236
const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))
const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1))

const pad = (n) => String(n).padStart(2, '0')

function todayParts() {
	const now = new Date()
	return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() }
}

// '2026-09-06T17:00' -> { date: '2026-09-06', hour: 5, minute: '00', pm: true }
function split(value) {
	const [date = '', time = ''] = value.split('T')
	if (!time || time === '00:00') return { date, hour: '', minute: '', pm: true }
	const [h, m] = time.split(':').map(Number)
	return { date, hour: String(h % 12 === 0 ? 12 : h % 12), minute: pad(m), pm: h >= 12 }
}

function join(date, hour, minute, pm) {
	if (!date) return ''
	if (!hour) return `${date}T00:00`
	let h = Number(hour) % 12
	if (pm) h += 12
	return `${date}T${pad(h)}:${minute || '00'}`
}

export function CalendarIcon({ className }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
			<rect x="3.5" y="5" width="17" height="15.5" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
			<path d="M3.5 9.5h17" stroke="currentColor" strokeWidth="1.6" />
			<path d="M8 3.2v3.6M16 3.2v3.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
			{[8, 12, 16].flatMap((x) => [13, 16.8].map((y) => (
				<circle key={`${x}-${y}`} cx={x} cy={y} r="1.05" fill="currentColor" />
			)))}
		</svg>
	)
}

function Arrow({ flip, onClick, label }) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={label}
			className="
				w-[24px]
				h-[24px]
				rounded-full
				flex
				items-center
				justify-center
				text-black
				cursor-pointer
				transition-colors
				duration-150
				hover:bg-black/[0.06]
			"
		>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={`w-[14px] h-[14px] ${flip ? 'rotate-180' : ''}`} aria-hidden="true">
				<path d="M14.5 6.5L9 12l5.5 5.5" />
			</svg>
		</button>
	)
}

const SELECT = `
	h-[26px]
	rounded-[5px]
	border
	border-orange
	bg-white
	px-[4px]
	font-vietnam
	text-[13px]
	text-black
	outline-none
	cursor-pointer
`

function Picker({ value, onChange, onClose, anchor, rect, zoom }) {
	const ref = useRef(null)
	const { date, hour, minute, pm } = split(value)
	const today = todayParts()
	const [view, setView] = useState(() => {
		const [y, m] = date.split('-').map(Number)
		return y && m ? { year: y, month: m - 1 } : { year: today.year, month: today.month }
	})

	// closes on a click anywhere else, or Escape
	useEffect(() => {
		const onDown = (event) => {
			if (!ref.current?.contains(event.target) && !anchor.current?.contains(event.target)) onClose()
		}
		const onKey = (event) => {
			if (event.key === 'Escape') onClose()
		}
		window.addEventListener('pointerdown', onDown)
		window.addEventListener('keydown', onKey)
		window.addEventListener('resize', onClose)
		return () => {
			window.removeEventListener('pointerdown', onDown)
			window.removeEventListener('keydown', onKey)
			window.removeEventListener('resize', onClose)
		}
	}, [anchor, onClose])

	const style = {
		position: 'fixed',
		zoom,
		top: (rect.bottom + 6 * zoom) / zoom,
		left: rect.right / zoom - WIDTH,
		width: WIDTH,
	}

	const first = new Date(view.year, view.month, 1).getDay()
	const count = new Date(view.year, view.month + 1, 0).getDate()
	const cells = [...Array(first).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)]
	const title = new Date(view.year, view.month, 1)
		.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
		.toLowerCase()
	const move = (step) =>
		setView(({ year, month }) => {
			const next = new Date(year, month + step, 1)
			return { year: next.getFullYear(), month: next.getMonth() }
		})

	const pick = (day) => onChange(join(`${view.year}-${pad(view.month + 1)}-${pad(day)}`, hour, minute, pm))
	// a time with no date yet goes on today, so it has somewhere to live
	const dateOrToday = date || `${today.year}-${pad(today.month + 1)}-${pad(today.day)}`
	const setTime = (patch) => {
		const next = { hour, minute, pm, ...patch }
		onChange(join(dateOrToday, next.hour, next.hour ? next.minute || '00' : '', next.pm))
	}

	return createPortal(
		<div
			ref={ref}
			role="dialog"
			aria-label="Pick a date and time"
			style={style}
			className="
				menu-open
				z-50
				rounded-[10px]
				bg-cream
				border
				border-orange
				p-[12px]
				shadow-[0_10px_30px_rgba(0,0,0,0.2)]
				[transform-origin:top_right]
			"
		>
			<div className="
				flex
				items-center
				justify-between
			">
				<Arrow onClick={() => move(-1)} label="Previous month" />
				<p className="
					font-vietnam
					font-semibold
					text-[14px]
					text-black
				">
					{title}
				</p>
				<Arrow flip onClick={() => move(1)} label="Next month" />
			</div>

			<div className="
				mt-[8px]
				grid
				grid-cols-7
				text-center
				font-vietnam
				font-semibold
				text-[11px]
				text-black/40
			">
				{DAYS.map((d, i) => <span key={i}>{d}</span>)}
			</div>
			<div className="
				mt-[4px]
				grid
				grid-cols-7
				gap-y-[2px]
			">
				{cells.map((day, i) => {
					if (!day) return <span key={`blank-${i}`} />
					const iso = `${view.year}-${pad(view.month + 1)}-${pad(day)}`
					const selected = iso === date
					const isToday = view.year === today.year && view.month === today.month && day === today.day
					return (
						<button
							key={day}
							type="button"
							onClick={() => pick(day)}
							aria-pressed={selected}
							className={`
								mx-auto
								w-[28px]
								h-[28px]
								rounded-full
								font-vietnam
								text-[13px]
								cursor-pointer
								transition-colors
								duration-150
								${selected
									? 'bg-orange text-white font-semibold'
									: `text-black hover:bg-orange/15 ${isToday ? 'ring-1 ring-orange' : ''}`}
							`}
						>
							{day}
						</button>
					)
				})}
			</div>

			<div className="
				mt-[10px]
				pt-[10px]
				border-t
				border-black/10
				flex
				items-center
				gap-[6px]
			">
				<span className="
					mr-auto
					font-vietnam
					font-semibold
					text-[13px]
					text-black
				">
					time
				</span>
				<select
					value={hour}
					onChange={(event) => setTime({ hour: event.target.value })}
					aria-label="Hour"
					className={SELECT}
				>
					<option value="">--</option>
					{HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
				</select>
				<span className="font-vietnam text-[13px]">:</span>
				<select
					value={hour ? minute || '00' : ''}
					onChange={(event) => setTime({ minute: event.target.value, hour: hour || '12' })}
					aria-label="Minute"
					className={SELECT}
				>
					{!hour && <option value="">--</option>}
					{/* a minute that isn't on the 5s (typed in) still shows */}
					{minute && !MINUTES.includes(minute) && <option value={minute}>{minute}</option>}
					{MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
				</select>
				<div className="
					flex
					rounded-[5px]
					border
					border-orange
					overflow-hidden
				">
					{[['AM', false], ['PM', true]].map(([label, isPm]) => (
						<button
							key={label}
							type="button"
							onClick={() => setTime({ pm: isPm, hour: hour || '12' })}
							aria-pressed={hour !== '' && pm === isPm}
							className={`
								h-[24px]
								px-[6px]
								font-vietnam
								font-semibold
								text-[11px]
								cursor-pointer
								transition-colors
								duration-150
								${hour !== '' && pm === isPm ? 'bg-orange text-white' : 'bg-white text-black hover:bg-orange/10'}
							`}
						>
							{label}
						</button>
					))}
				</div>
			</div>

			<div className="
				mt-[12px]
				flex
				justify-between
			">
				<button
					type="button"
					onClick={() => onChange('')}
					className={`
						h-[26px]
						px-[12px]
						rounded-[7px]
						font-vietnam
						font-semibold
						text-[12px]
						text-black
						${INSET}
					`}
				>
					clear
				</button>
				<button
					type="button"
					onClick={onClose}
					className={`
						h-[26px]
						px-[14px]
						rounded-[7px]
						font-vietnam
						font-semibold
						text-[12px]
						text-black
						${INSET}
					`}
				>
					done
				</button>
			</div>
		</div>,
		document.body
	)
}

export default function DateTimeField({ id, value, onChange, className, zoom }) {
	const anchor = useRef(null)
	// the box's position when the picker was opened, or null while it's shut
	const [open, setOpen] = useState(null)

	return (
		<div ref={anchor} className="relative">
			<input
				id={id}
				type="datetime-local"
				value={value}
				onChange={(event) => onChange(event.target.value)}
				className={`
					${className}
					pr-[28px]
					[&::-webkit-calendar-picker-indicator]:hidden
				`}
			/>
			<button
				type="button"
				onClick={() => setOpen((was) => (was ? null : anchor.current.getBoundingClientRect()))}
				aria-label="Open calendar"
				aria-expanded={Boolean(open)}
				className="
					absolute
					right-[4px]
					top-1/2
					-translate-y-1/2
					w-[22px]
					h-[22px]
					flex
					items-center
					justify-center
					text-[#BDBDBD]
					cursor-pointer
					transition-colors
					duration-150
					hover:text-orange
				"
			>
				<CalendarIcon className="w-[20px] h-[20px]" />
			</button>
			{open && (
				<Picker
					value={value}
					onChange={onChange}
					onClose={() => setOpen(null)}
					anchor={anchor}
					rect={open}
					zoom={zoom}
				/>
			)}
		</div>
	)
}
