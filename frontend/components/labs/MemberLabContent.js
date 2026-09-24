'use client'

import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { metaLine, useDesignZoom } from '@/components/labs/LabViewParts'
import SkeuoButton from '@/components/labs/SkeuoButton'
import LabMaterials from '@/components/labs/LabMaterials'
import LabLesson from '@/components/labs/LabLesson'
import LabInstructions from '@/components/labs/LabInstructions'

// The full lab, once the member has passed the quiz. Two columns:
//
//   left    the photo, the date line, the title and description, and the
//           three raised buttons that pick what's on the right
//   right   materials (ingredients + equipment cards), lesson (the PDF) or
//           instruction (the steps, as a list or as flashcards)
//
// Laid out in the design's pixels and zoomed to the window like the other
// stages (see Scaled in LabViewParts). The one difference: this page runs to
// the right edge of the window — the lesson viewer nearly touches it — so it
// takes back the 32px the shell pads the scroll column with on that side.
//
// Positions are measured off the mockups. Anything on the left is placed from
// the sidebar's edge; anything on the right from the window's edge — the
// mockups' sidebar sits 11px further right than the site's, so that's the
// only way both sides land where they're drawn.

// how much smaller the three tab buttons are than the mockup's
const TAB_SCALE = 0.85

const TABS = [
	['materials', 'materials'],
	['lesson', 'lesson'],
	['instructions', 'instruction'],
]

// the shell's padding round the scroll column (DashboardShell + the bleed in
// MemberLabView), in real pixels — it doesn't scale with the design
const SHELL_PAD = 32
const LG = 1024

// The lesson viewer runs from its spot under the header to the bottom of the
// window. Its top is this far down the page, in design pixels.
const LESSON_TOP = 74.4

// ---- the right-hand column -------------------------------------------------
//
// In the mockups everything on the right shares one column: the lesson
// viewer's, 650.4px wide, from 22.8px past the left column to 19.4px short of
// the window's edge. The materials cards (576.6 wide) and the flashcards
// (571.6) are centred in it, and the instruction list (635) too.
//
// So the right side is laid out at exactly those sizes and then zoomed as one
// piece until that column is as wide as the space it actually has — the cards
// keep the share of it they have in the design however wide the window is,
// rather than staying a fixed size in a column that's grown around them.
const VIEW_W = 650.4

// ...but only as far as the height allows. The mockup's page is 834 tall, and
// the shell's padding takes 64 of that; the right column may grow until that
// 770 fills the window's height and no further, so the cards and the table of
// contents always end inside the window the way they do in the mockup.
const VIEW_H = 834 - 64

// ...and then a little smaller than that — at full size the right column read
// as too big next to the left one. The lesson viewer still runs edge to edge;
// it's its toolbar and everything in the other two tabs that shrink.
const VIEW_SCALE = 0.9
const VIEW_LEFT = 22.8
const VIEW_RIGHT = 19.4
const LEFT_COL = 331.2

// where the scroll column starts: the shell's 32px padding, the 327px
// sidebar and the 24px gap after it
const SHELL_LEFT = 383

function subscribe(onChange) {
	window.addEventListener('resize', onChange)
	return () => window.removeEventListener('resize', onChange)
}

function useViewport() {
	const width = useSyncExternalStore(subscribe, () => window.innerWidth, () => 1418)
	const height = useSyncExternalStore(subscribe, () => window.innerHeight, () => 834)
	return { width, height }
}

// The description is sized for the design's seven lines. A longer one would
// push the three buttons off the bottom of the screen, so it stops at seven
// and opens on request.
const DESCRIPTION_LINES = 7

function Description({ text }) {
	const ref = useRef(null)
	const [open, setOpen] = useState(false)
	// whether the clamp is actually cutting anything off — measured, so a short
	// description never grows a "read more" that opens onto nothing
	const [long, setLong] = useState(false)

	useLayoutEffect(() => {
		const el = ref.current
		if (!el) return
		const observer = new ResizeObserver(() => {
			if (el.scrollHeight > el.clientHeight + 1) setLong(true)
		})
		observer.observe(el)
		return () => observer.disconnect()
	}, [text])

	return (
		<div className="mt-[17.2px]">
			<p
				ref={ref}
				className="
					font-vietnam
					text-[15px]
					leading-[18px]
					text-black
					whitespace-pre-line
				"
				style={open ? undefined : {
					display: '-webkit-box',
					WebkitBoxOrient: 'vertical',
					WebkitLineClamp: DESCRIPTION_LINES,
					overflow: 'hidden',
				}}
			>
				{text}
			</p>
			{long && (
				<button
					type="button"
					onClick={() => setOpen((o) => !o)}
					className="
						mt-1
						font-vietnam
						font-semibold
						text-[13px]
						text-black/[0.53]
						cursor-pointer
						hover:text-black
					"
				>
					{open ? 'show less' : 'read more'}
				</button>
			)}
		</div>
	)
}

export default function MemberLabContent({ lab }) {
	const [tab, setTab] = useState('materials')
	const zoom = useDesignZoom()
	const { width, height } = useViewport()
	const wide = width >= LG

	// How much the right column is zoomed on top of the page's own zoom: the
	// width it has, in design pixels, over the width it has in the mockup —
	// or the height it has over the mockup's, whichever is smaller — taken
	// down by VIEW_SCALE.
	const viewZoom = wide
		? Math.min(
			((width - SHELL_LEFT) / zoom - LEFT_COL - VIEW_LEFT - VIEW_RIGHT) / VIEW_W,
			(height - 2 * SHELL_PAD) / zoom / VIEW_H
		) * VIEW_SCALE
		: 1

	// From the viewer's top to the bottom of the window, in the right column's
	// own (twice-zoomed) pixels — and the bottom padding it reaches through to
	// get there.
	const lessonHeight = wide
		? ((height - SHELL_PAD) / zoom - LESSON_TOP) / viewZoom
		: Math.round(height * 0.8)

	return (
		<div
			className="
				flex
				flex-col
				lg:flex-row
				gap-10
				lg:gap-0
			"
			style={{ zoom, marginRight: wide ? -SHELL_PAD / zoom : 0 }}
		>
			{/* ---- left: photo, header, the three buttons ------------------- */}
			<div className="
				lg:w-[331.2px]
				shrink-0
				lg:pl-[11.5px]
				lg:pt-[38.2px]
			">
				<div className="
					w-full
					max-w-[261px]
					aspect-[261/201.4]
					overflow-hidden
					rounded-[10px]
					bg-salmon-lightest
				">
					{lab.image && (
						<img
							src={lab.image}
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

				<p className="
					mt-[22px]
					font-vietnam
					font-semibold
					text-[15px]
					leading-[22px]
					text-black
					lg:whitespace-nowrap
				">
					{metaLine(lab)}
				</p>
				<h1 className="
					mt-[3.3px]
					lg:max-w-[288px]
					font-beachday
					text-[40px]
					sm:text-[54px]
					leading-[65.2px]
					text-salmon
					break-words
				">
					{lab.title}
				</h1>
				{lab.description && (
					<div className="lg:max-w-[288px]">
						<Description text={lab.description} />
					</div>
				)}

				{/* The three buttons, a little smaller than the mockup's 211×42 —
				    the whole stack is scaled together (glow and text too) and
				    stays centred under the photo. */}
				<div className="
					mt-[35.35px]
					lg:w-[261px]
					flex
					lg:justify-center
				">
				<div
					role="tablist"
					aria-label="Lab sections"
					className="
						w-[211px]
						flex
						flex-col
						gap-[16.5px]
					"
					style={{ zoom: TAB_SCALE }}
				>
					{TABS.map(([key, label]) => (
						<SkeuoButton
							key={key}
							role="tab"
							aria-selected={tab === key}
							selected={tab === key}
							onClick={() => setTab(key)}
							className="h-[42px]"
						>
							{label}
						</SkeuoButton>
					))}
				</div>
				</div>
			</div>

			{/* ---- right: whichever section is picked ----------------------
			    The padding is the column's edges and each tab's distance from
			    the top, both on the page's scale; what's inside is on the
			    column's own. */}
			<div
				role="tabpanel"
				className={`
					flex-1
					min-w-0
					lg:pl-[22.8px]
					lg:pr-[19.4px]
					${tab === 'materials' ? 'lg:pt-[36.1px]' : ''}
					${tab === 'lesson' ? 'lg:pt-[74.4px]' : ''}
					${tab === 'instructions' ? 'lg:pt-[13.4px]' : ''}
				`}
				// The lesson viewer runs to the window's bottom edge, and the
				// equipment card ends 23px short of it, inside the shell's 32px
				// padding, as in the mockup. Both reach through that padding
				// rather than having it push them into a scroll.
				style={(tab === 'lesson' || tab === 'materials') && wide
					? { marginBottom: -SHELL_PAD / zoom }
					: undefined}
			>
				<div style={{ zoom: viewZoom }}>
					{tab === 'materials' && (
						<div className="
							pb-[24px]
							lg:pb-0
							flex
							justify-center
						">
							<LabMaterials
								ingredients={lab.ingredients}
								equipment={lab.equipment}
							/>
						</div>
					)}

					{tab === 'lesson' && (
						lab.hasLesson ? (
							<LabLesson
								labId={lab.labId}
								fileName={lab.lessonPdfName}
								zoom={zoom * viewZoom}
								style={{ height: lessonHeight }}
							/>
						) : (
							<p className="
								font-vietnam
								text-[15px]
								text-black/[0.53]
								text-center
							">
								This lab doesn&apos;t have a lesson yet.
							</p>
						)
					)}

					{tab === 'instructions' && (
						<div className="
							pb-[24px]
							lg:pb-0
						">
							<LabInstructions text={lab.instructions} />
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
