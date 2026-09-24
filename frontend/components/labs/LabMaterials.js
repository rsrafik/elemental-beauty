'use client'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { parseSections } from '@/lib/labContent'

// The materials tab of the full lab: an ingredients card with its tab hanging
// off the bottom-left, then an equipment card with its tab standing up on the
// top-right. All sizes are the design's pixels (the page zooms the lot).
//
// Each card's sections flow like the mockup's: down the left column until it's
// full, then over to the right — which is what CSS columns do with a fixed
// height and `column-fill: auto`. A lab with more than two columns' worth
// would spill into a third column out of sight, so if that happens the card
// stops holding its height and balances the two columns instead.

const LINE = 14.4

// The mockup's columns hold 19 lines exactly. Zoomed twice over (the page's
// zoom and the right column's), rounding can make the 19th overflow by a
// fraction of a pixel and push a whole section across, so the column gets a
// sliver of room it can't fit another line into.
const COLUMN_HEIGHT = 19 * LINE + 2

function Sections({ text, className = '' }) {
	const sections = useMemo(() => parseSections(text), [text])
	const ref = useRef(null)
	const [spills, setSpills] = useState(false)

	// Measured by the observer rather than in the effect itself, and latched:
	// once the card has let go of its height the columns stop overflowing, and
	// flipping back would only make it overflow again.
	useLayoutEffect(() => {
		const el = ref.current
		if (!el) return
		const observer = new ResizeObserver(() => {
			if (el.scrollWidth > el.clientWidth + 1) setSpills(true)
		})
		observer.observe(el)
		return () => observer.disconnect()
	}, [sections])

	if (sections.length === 0) {
		return (
			<p className={`
				font-vietnam
				text-[12px]
				text-black/50
				${className}
			`}>
				Nothing listed yet.
			</p>
		)
	}

	return (
		<div
			ref={ref}
			className={`
				font-vietnam
				text-[12px]
				text-black
				${className}
			`}
			style={{
				columnCount: 2,
				columnGap: 21.5,
				columnFill: spills ? 'balance' : 'auto',
				height: spills ? 'auto' : COLUMN_HEIGHT,
				lineHeight: `${LINE}px`,
			}}
		>
			{sections.map((section, s) => (
				<div
					key={s}
					className="[break-inside:avoid]"
					// one empty line between sections — as a top margin, so it
					// disappears at the top of a column instead of pushing the
					// section down
					style={{ marginTop: s === 0 ? 0 : LINE }}
				>
					{section.heading && (
						<p className="font-semibold">{section.heading}</p>
					)}
					<ul>
						{section.items.map((item, i) => (
							<li
								key={i}
								className="
									relative
									pl-[15.6px]
								"
							>
								<span
									aria-hidden="true"
									className="
										absolute
										left-[1.5px]
									"
								>
									•
								</span>
								{item}
							</li>
						))}
					</ul>
				</div>
			))}
		</div>
	)
}

function TabLabel({ children, className = '' }) {
	return (
		<div className={`
			w-[137px]
			h-[38.3px]
			flex
			items-center
			justify-center
			font-vietnam
			font-semibold
			text-[18px]
			leading-none
			text-black
			${className}
		`}>
			{children}
		</div>
	)
}

// The mockup's cards are 576.6 wide; these run a little wider than that, so
// the two lists get more room and wrap less. Heights are the mockup's.
export default function LabMaterials({ ingredients, equipment }) {
	return (
		<div className="w-[630px] max-w-full">
			{/* ingredients: body, then its tab hanging off the bottom-left
			    corner — the corner it hangs from is the one square one */}
			<div className="
				rounded-[10px]
				rounded-bl-none
				bg-salmon/90
				px-[15px]
				py-[13px]
			">
				<div className="
					rounded-[7px]
					bg-cream
					min-h-[306px]
					pt-[16.3px]
					pb-[16.3px]
					pl-[21.8px]
					pr-[21.3px]
				">
					<Sections text={ingredients} />
				</div>
			</div>
			<TabLabel className="
				rounded-b-[5px]
				bg-salmon/90
			">
				ingredients
			</TabLabel>

			{/* equipment: its tab stands up off the top-right corner */}
			<TabLabel className="
				mt-[1.4px]
				ml-auto
				rounded-t-[5px]
				bg-green
			">
				equipment
			</TabLabel>
			<div className="
				rounded-[10px]
				rounded-tr-none
				bg-green
				px-[15px]
				py-[13px]
			">
				<div className="
					rounded-[7px]
					bg-cream
					min-h-[306px]
					pt-[16.3px]
					pb-[16.3px]
					pl-[17.6px]
					pr-[25.5px]
				">
					<Sections text={equipment} />
				</div>
			</div>
		</div>
	)
}
