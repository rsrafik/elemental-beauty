'use client'

import { useEffect, useState } from 'react'

// The dimmed, empty boxes a page shows while what goes in them is still on
// its way — the same shapes as the real cards, so nothing jumps when they
// land. Each one fades in on the diagonal (top-left first, bottom-right last)
// and pulses on that same offset until it's replaced; the timing is the
// .skeleton rule in app/globals.css, driven by --wave (row + column).

// Tailwind's breakpoints, for working out how many columns a grid has right now
const BREAKPOINTS = { sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 }

// `cols` as the grid's classes have it: { base: 1, sm: 2, xl: 3, '2xl': 4 }
// → how many across at this width. Before the page knows its width (the
// static export renders without one) it's the narrowest.
export function useColumns(cols) {
	const key = JSON.stringify(cols)
	const [count, setCount] = useState(cols.base ?? 1)
	useEffect(() => {
		const spec = JSON.parse(key)
		const steps = Object.entries(BREAKPOINTS)
			.filter(([name]) => spec[name])
			.map(([name, px]) => ({ query: window.matchMedia(`(min-width: ${px}px)`), n: spec[name] }))
		const pick = () => setCount(steps.reduce((n, step) => (step.query.matches ? step.n : n), spec.base ?? 1))
		pick()
		for (const step of steps) step.query.addEventListener('change', pick)
		return () => { for (const step of steps) step.query.removeEventListener('change', pick) }
	}, [key])
	return count
}

// a line of text that hasn't arrived
export function Bar({ className = '' }) {
	return <div className={`rounded-full bg-black/15 ${className}`} />
}

// One placeholder card in the shape of a lab or event card: the picture, the
// title, a few lines, and (on a member's card) the button row.
export function SkeletonCard({ wave = 0, tint = 'bg-salmon-lightest', lines = 3, action = false, surface = 'bg-white' }) {
	return (
		<div
			aria-hidden="true"
			className={`skeleton ${surface} rounded-[10px] p-3 pb-4 shadow-[0_4px_10px_rgba(0,0,0,0.15)]`}
			style={{ '--wave': wave }}
		>
			<div className={`aspect-[4/3] w-full rounded-[10px] ${tint}`} />
			<Bar className="mt-3 h-[17px] w-3/4" />
			{Array.from({ length: lines }, (_, i) => (
				<Bar key={i} className={`mt-2 h-3 ${['w-2/3', 'w-1/2', 'w-2/5'][i % 3]}`} />
			))}
			{action && <Bar className="mt-4 h-8 w-[110px]" />}
		</div>
	)
}

// `count` placeholder cards in a grid laid out by `className` (the real
// grid's own classes), `cols` being the same column counts as a map (see
// useColumns) so each card knows its row and column.
export function SkeletonGrid({ className, cols, count, card = {} }) {
	const across = useColumns(cols)
	return (
		<div className={className} role="status" aria-label="Loading">
			{Array.from({ length: count }, (_, i) => (
				<SkeletonCard key={i} wave={Math.floor(i / across) + (i % across)} {...card} />
			))}
		</div>
	)
}

// Rows of a table or a list that haven't arrived: `rows` of them, each
// `height` px tall, with a round avatar when `avatar` is on and `cells` bars
// across. The wave runs down the rows and across the bars.
export function SkeletonRows({ rows = 6, cells = 4, height = 57, avatar = false, className = '' }) {
	return (
		<div className={className} role="status" aria-label="Loading">
			{Array.from({ length: rows }, (_, row) => (
				<div key={row} className="flex items-center gap-4 px-4" style={{ height }}>
					{avatar && <div aria-hidden="true" className="skeleton w-9 h-9 shrink-0 rounded-full bg-black/15" style={{ '--wave': row }} />}
					{Array.from({ length: cells }, (_, cell) => (
						<div
							key={cell}
							aria-hidden="true"
							className={`skeleton h-3 rounded-full bg-black/15 ${cell === 0 ? 'w-40' : 'flex-1'}`}
							style={{ '--wave': row + cell + (avatar ? 1 : 0) }}
						/>
					))}
				</div>
			))}
		</div>
	)
}

// Boxes in a row or a grid of their own (dashboard tiles, analytics cards):
// `count` of them, each with `className` for its size and colour.
export function SkeletonTiles({ count = 3, cols = { base: 1 }, className = '', tile = 'h-24 rounded-[16px] bg-white' }) {
	const across = useColumns(cols)
	return (
		<div className={className} role="status" aria-label="Loading">
			{Array.from({ length: count }, (_, i) => (
				<div
					key={i}
					aria-hidden="true"
					className={`skeleton ${tile}`}
					style={{ '--wave': Math.floor(i / across) + (i % across) }}
				/>
			))}
		</div>
	)
}

// A lab's or event's own page before it's arrived: the words down the left
// (title, date line, a paragraph, the button) and the photo on the right —
// stacked on a phone. The wave runs down the words and lands on the photo.
export function SkeletonDetail({ tint = 'bg-salmon-lightest' }) {
	const bars = ['h-9 w-2/3', 'h-4 w-1/2', 'h-3 w-full', 'h-3 w-11/12', 'h-3 w-4/5', 'h-3 w-3/5']
	return (
		<div role="status" aria-label="Loading" className="
			flex
			flex-col-reverse
			lg:flex-row
			gap-8
			lg:pl-[48px]
			lg:pr-[64px]
			pt-6
			lg:pt-16
		">
			<div className="flex-1 min-w-0 flex flex-col gap-4">
				{bars.map((size, i) => (
					<div key={i} aria-hidden="true" className={`skeleton rounded-full bg-black/15 ${size}`} style={{ '--wave': i }} />
				))}
				<div aria-hidden="true" className="skeleton mt-4 h-11 w-[180px] rounded-full bg-black/15" style={{ '--wave': bars.length }} />
			</div>
			<div aria-hidden="true" className={`skeleton w-full lg:w-[46%] aspect-[4/3] rounded-[16px] ${tint}`} style={{ '--wave': 1 }} />
		</div>
	)
}

// A word or a number that hasn't arrived, in the middle of a line: a dimmed
// box about its size, pulsing on its place in the diagonal.
export function Pending({ wave = 0, className = 'h-[0.8em] w-[3em]' }) {
	return <span aria-hidden="true" className={`skeleton inline-block align-middle rounded-full bg-black/20 ${className}`} style={{ '--wave': wave }} />
}
