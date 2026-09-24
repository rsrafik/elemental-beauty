'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { parseSections, stepsOf } from '@/lib/labContent'

// The instruction tab of the full lab. Two modes, swapped with the button at
// the top:
//
//   regular    every part with its numbered steps, one long list
//   flashcard  one step at a time on a card — "1a", "1b", … — that slides
//              sideways to the next one, with a table of contents to jump
//              between parts and a fullscreen version of the same deck
//
// Every size here is in the design's pixels (the page zooms the lot; see
// Scaled in LabViewParts). The fullscreen deck is drawn on its own 1712×1004
// mockup and zooms itself to the screen.

// The slide between cards: the site's ease-out, long enough to read as a
// card moving rather than the text changing.
const SLIDE_MS = 450
const SLIDE_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

// The flashcard's width. The mockup's is 563; this one runs wider, so the deck
// fills more of the column.
// The table of contents keeps the mockup's relation to it — 4.3 past the card
// on each side, 69.5 between its two columns.
const CARD_W = 720

// The regular list's width (and the toggle's block). The mockup's is 635.
const LIST_W = 760
const TOC_W = CARD_W + 2 * 4.3
const TOC_GAP = 69.5
const TOC_COL = (TOC_W - TOC_GAP) / 2

// Toggle and table-of-contents buttons: a flat pill pressed into the page —
// darkest along the top edge, fading to almost nothing at the bottom.
const PRESSED = 'shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.4)]'

// ---- icons -----------------------------------------------------------------

function Chevron({ direction, className }) {
	return (
		<svg
			viewBox="0 0 10 16"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.6"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			<path d={direction === 'left' ? 'M8 1.5 1.8 8 8 14.5' : 'M2 1.5 8.2 8 2 14.5'} />
		</svg>
	)
}

// The fullscreen deck's collapse icon, as the mockup draws it: four solid L's
// with their corners pointing in, 6px bars on a 56×57 square, square ends.
function CollapseIcon({ className }) {
	return (
		<svg
			viewBox="0 0 56 57"
			fill="currentColor"
			className={className}
			aria-hidden="true"
		>
			<rect x="9" y="0" width="6" height="16" />
			<rect x="0" y="10" width="15" height="6" />
			<rect x="40" y="0" width="6" height="16" />
			<rect x="40" y="10" width="16" height="6" />
			<rect x="9" y="41" width="6" height="16" />
			<rect x="0" y="41" width="15" height="6" />
			<rect x="40" y="41" width="6" height="16" />
			<rect x="40" y="41" width="16" height="6" />
		</svg>
	)
}

// The card's expand icon: four corner brackets pointing out.
function CornersIcon({ className }) {
	const arms = ['M1 6V1h5', 'M17 6V1h-5', 'M1 11v5h5', 'M17 11v5h-5']
	return (
		<svg
			viewBox="0 0 18 17"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			className={className}
			aria-hidden="true"
		>
			{arms.map((d) => <path key={d} d={d} />)}
		</svg>
	)
}

// ---- fullscreen ------------------------------------------------------------

function subscribeFullscreen(onChange) {
	document.addEventListener('fullscreenchange', onChange)
	return () => document.removeEventListener('fullscreenchange', onChange)
}

function useFullscreenElement() {
	return useSyncExternalStore(
		subscribeFullscreen,
		() => document.fullscreenElement,
		() => null
	)
}

function subscribeResize(onChange) {
	window.addEventListener('resize', onChange)
	return () => window.removeEventListener('resize', onChange)
}

function useWindowSize() {
	const width = useSyncExternalStore(subscribeResize, () => window.innerWidth, () => 1712)
	const height = useSyncExternalStore(subscribeResize, () => window.innerHeight, () => 1004)
	return { width, height }
}

// ---- regular mode ----------------------------------------------------------

function RegularList({ parts }) {
	return (
		<div className="
			flex
			flex-col
			gap-[22.6px]
			font-vietnam
			text-[13.5px]
			leading-[22.6px]
			text-black
		">
			{parts.map((part, p) => (
				<section key={p}>
					{part.heading && (
						<h3 className="font-semibold">
							Part {p + 1} - {part.heading}
						</h3>
					)}
					<ol>
						{part.items.map((step, i) => (
							// the number hangs in its own 19px gutter so a wrapped
							// line lines up with the text, not the number
							<li
								key={i}
								className="
									relative
									pl-[19px]
								"
							>
								<span className="
									absolute
									left-0
								">
									{i + 1}.
								</span>
								{step}
							</li>
						))}
					</ol>
				</section>
			))}
		</div>
	)
}

// ---- flashcards ------------------------------------------------------------

// The strip of cards behind the white window. Every card is laid out once,
// side by side, and the strip slides — so going from one step to the next
// is the card actually moving over, not the text swapping.
function Track({ steps, index, renderCard, className = '' }) {
	return (
		<div className={`
			absolute
			inset-0
			overflow-hidden
			${className}
		`}>
			<div
				className="
					flex
					h-full
				"
				style={{
					transform: `translateX(-${index * 100}%)`,
					transition: `transform ${SLIDE_MS}ms ${SLIDE_EASE}`,
				}}
			>
				{steps.map((step, i) => (
					<div
						key={i}
						aria-hidden={i !== index}
						className="
							relative
							w-full
							h-full
							shrink-0
						"
					>
						{renderCard(step)}
					</div>
				))}
			</div>
		</div>
	)
}

function NavButton({ direction, onClick, disabled, size, chevron }) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			aria-label={direction === 'left' ? 'Previous step' : 'Next step'}
			className="
				flex
				items-center
				justify-center
				rounded-full
				bg-green
				text-black
				cursor-pointer
				transition-[transform,opacity]
				duration-200
				ease-out
				hover:scale-105
				active:scale-95
				disabled:opacity-40
				disabled:cursor-default
				disabled:hover:scale-100
			"
			style={{ width: size, height: size }}
		>
			<Chevron
				direction={direction}
				className={chevron}
			/>
		</button>
	)
}

// One card's face in the normal-size deck — the design's 530×415 white
// window: badge in the corner, title and step centred in the middle.
function CardFace({ step }) {
	return (
		<>
			<span className="
				absolute
				left-[27px]
				top-[22px]
				w-[49px]
				h-[49px]
				rounded-full
				bg-green
				flex
				items-center
				justify-center
				font-vietnam
				font-semibold
				text-[26px]
				leading-none
				text-black
			">
				{step.label}
			</span>
			<div className="
				absolute
				inset-0
				flex
				flex-col
				items-center
				justify-center
				px-[40px]
				text-center
			">
				{step.title && (
					<h3 className="
						font-vietnam
						font-semibold
						text-[25px]
						leading-[30px]
						text-black
					">
						{step.title}
					</h3>
				)}
				<p className="
					mt-[37.3px]
					max-w-[290px]
					font-vietnam
					text-[14.5px]
					leading-[23.4px]
					text-black
				">
					{step.text}
				</p>
			</div>
		</>
	)
}

// The same card, drawn on the fullscreen mockup's 1712×1004 frame.
function FullscreenFace({ step }) {
	return (
		<>
			<span className="
				absolute
				left-[53px]
				top-[38px]
				w-[96px]
				h-[96px]
				rounded-full
				bg-green
				flex
				items-center
				justify-center
				font-vietnam
				font-semibold
				text-[53.5px]
				leading-none
				text-black
			">
				{step.label}
			</span>
			<div className="
				absolute
				inset-0
				flex
				flex-col
				items-center
				justify-center
				px-[80px]
				pb-[43.6px]
				text-center
			">
				{step.title && (
					<h3 className="
						font-vietnam
						font-semibold
						text-[48.5px]
						leading-[58px]
						text-black
					">
						{step.title}
					</h3>
				)}
				<p className="
					mt-[43.8px]
					max-w-[700px]
					font-vietnam
					text-[29px]
					leading-[47px]
					text-black
				">
					{step.text}
				</p>
			</div>
		</>
	)
}

// The fullscreen deck. It lives in its own box on <body> (so none of the
// page's zoom or layout reaches it) that only shows while it's the fullscreen
// element, and it zooms its 1712×1004 frame to fit whatever screen it's on.
function FullscreenDeck({ host, steps, index, go, onExit }) {
	const { width, height } = useWindowSize()
	const zoom = Math.min(width / 1712, height / 1004)

	return createPortal(
		<div
			className="
				w-full
				h-full
				bg-cream
			"
		>
			<div
				className="
					bg-salmon/90
					flex
				"
				style={{
					zoom,
					width: width / zoom,
					height: height / zoom,
					padding: '41px 37px 36px 40px',
				}}
			>
				<div className="
					relative
					flex-1
					rounded-[35px]
					bg-white
					overflow-hidden
				">
					<Track
						steps={steps}
						index={index}
						renderCard={(step) => <FullscreenFace step={step} />}
					/>

					<div className="
						absolute
						left-0
						right-0
						bottom-[19px]
						flex
						items-center
						justify-center
						gap-[26px]
					">
						<NavButton
							direction="left"
							onClick={() => go(index - 1)}
							disabled={index === 0}
							size={70}
							chevron="w-[14px] h-[23px]"
						/>
						<span className="
							font-vietnam
							text-[20px]
							text-black
							tabular-nums
						">
							{index + 1}/{steps.length}
						</span>
						<NavButton
							direction="right"
							onClick={() => go(index + 1)}
							disabled={index === steps.length - 1}
							size={70}
							chevron="w-[14px] h-[23px]"
						/>
					</div>

					<button
						type="button"
						onClick={onExit}
						aria-label="Exit fullscreen"
						className="
							absolute
							right-[32px]
							bottom-[26px]
							w-[56px]
							h-[57px]
							text-black
							cursor-pointer
							transition-transform
							duration-200
							ease-out
							hover:scale-110
						"
					>
						<CollapseIcon className="w-full h-full" />
					</button>
				</div>
			</div>
		</div>,
		host
	)
}

function Flashcards({ parts }) {
	const steps = useMemo(() => stepsOf(parts), [parts])
	const [index, setIndex] = useState(0)
	const current = steps[index]

	// The fullscreen deck's box — made once, kept on <body> for as long as the
	// deck is on the page, and hidden unless it's what's fullscreen.
	const [host] = useState(() => {
		if (typeof document === 'undefined') return null
		const el = document.createElement('div')
		el.className = 'flashcard-fullscreen'
		return el
	})
	useEffect(() => {
		if (!host) return
		document.body.appendChild(host)
		return () => host.remove()
	}, [host])
	const fullscreen = useFullscreenElement() === host && host !== null

	const go = (next) => setIndex(Math.max(0, Math.min(steps.length - 1, next)))

	// arrow keys step through the deck, in or out of fullscreen — unless the
	// keypress is somebody typing in a field
	useEffect(() => {
		const onKey = (event) => {
			if (event.target.closest?.('input, textarea, select, [contenteditable]')) return
			if (event.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
			if (event.key === 'ArrowRight') setIndex((i) => Math.min(steps.length - 1, i + 1))
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [steps.length])

	const enterFullscreen = () => host?.requestFullscreen?.().catch(() => {})
	const exitFullscreen = () => {
		if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
	}

	if (steps.length === 0) {
		return (
			<p className="
				font-vietnam
				text-[13.5px]
				text-black/50
			">
				No steps yet.
			</p>
		)
	}

	// Table of contents: down the first column, then the second — parts 1 and
	// 2 on the left, 3 and 4 on the right.
	const rows = Math.ceil(parts.length / 2)
	const firstStepOf = (p) => steps.findIndex((step) => step.part === p)

	return (
		<div
			className="max-w-full"
			style={{ width: TOC_W, '--card-w': `${CARD_W}px` }}
		>
			{/* the card: salmon frame, white window, the deck sliding behind it */}
			<div className="
				mx-auto
				w-[var(--card-w)]
				max-w-full
				h-[439.7px]
				rounded-[10px]
				bg-salmon/90
				pt-[13.5px]
				pr-[16.3px]
				pb-[11.3px]
				pl-[16.3px]
			">
				<div className="
					relative
					h-full
					rounded-[10px]
					bg-white
					overflow-hidden
				">
					<Track
						steps={steps}
						index={index}
						renderCard={(step) => <CardFace step={step} />}
					/>
					<button
						type="button"
						onClick={enterFullscreen}
						aria-label="Fullscreen"
						className="
							absolute
							right-[14.2px]
							bottom-[12.1px]
							w-[18.4px]
							h-[17px]
							text-black
							cursor-pointer
							transition-transform
							duration-200
							ease-out
							hover:scale-110
						"
					>
						<CornersIcon className="w-full h-full" />
					</button>
				</div>
			</div>

			<div className="
				mt-[19.2px]
				mx-auto
				w-[var(--card-w)]
				max-w-full
				flex
				items-center
				justify-center
				gap-[25.5px]
			">
				<NavButton
					direction="left"
					onClick={() => go(index - 1)}
					disabled={index === 0}
					size={49}
					chevron="w-[10px] h-[16px]"
				/>
				<span className="
					font-vietnam
					text-[14.5px]
					text-black
					tabular-nums
				">
					{index + 1}/{steps.length}
				</span>
				<NavButton
					direction="right"
					onClick={() => go(index + 1)}
					disabled={index === steps.length - 1}
					size={49}
					chevron="w-[10px] h-[16px]"
				/>
			</div>

			{parts.length > 0 && (
				<nav
					aria-label="Table of contents"
					className="mt-[23px]"
				>
					<p className="
						pl-[9.9px]
						font-vietnam
						font-semibold
						text-[16px]
						leading-[20px]
						text-black
					">
						Table of Contents
					</p>
					<p className="
						pl-[9.9px]
						mt-[6.3px]
						font-vietnam
						text-[10px]
						leading-[12px]
						text-black/50
					">
						click to jump to section
					</p>
					<div
						className="
							mt-[19.2px]
							grid
							grid-flow-col
							gap-y-[9.2px]
						"
						style={{
							gridTemplateRows: `repeat(${rows}, 38.3px)`,
							gridTemplateColumns: `repeat(2, ${TOC_COL}px)`,
							columnGap: TOC_GAP,
						}}
					>
						{parts.map((part, p) => {
							const here = current?.part === p
							return (
								<button
									key={p}
									type="button"
									onClick={() => go(firstStepOf(p))}
									aria-current={here ? 'step' : undefined}
									className={`
										h-[38.3px]
										rounded-[4px]
										px-[10px]
										text-left
										font-vietnam
										text-[15.5px]
										text-black
										truncate
										cursor-pointer
										transition-colors
										duration-200
										ease-out
										${PRESSED}
										${here ? 'bg-[#FFF5C4]' : 'bg-cream hover:bg-[#FFF5C4]/50'}
									`}
								>
									{p + 1}. {part.heading}
								</button>
							)
						})}
					</div>
				</nav>
			)}

			{host && fullscreen && (
				<FullscreenDeck
					host={host}
					steps={steps}
					index={index}
					go={go}
					onExit={exitFullscreen}
				/>
			)}
		</div>
	)
}

// ---- tab -------------------------------------------------------------------

export default function LabInstructions({ text }) {
	const parts = useMemo(() => parseSections(text), [text])
	const [flashcards, setFlashcards] = useState(false)

	// The toggle and the list share one block, centred in the column — wider
	// than the mockup's 635 so the steps fill more of it; the deck centres on
	// its own.
	return (
		<div style={{ '--list-w': `${LIST_W}px` }}>
			<div className="
				w-[var(--list-w)]
				max-w-full
				mx-auto
			">
			<button
				type="button"
				onClick={() => setFlashcards((on) => !on)}
				className={`
					-ml-[1.4px]
					w-[160px]
					h-[30.5px]
					rounded-[4px]
					bg-cream
					font-vietnam
					font-semibold
					text-[16px]
					leading-none
					text-black
					cursor-pointer
					transition-transform
					duration-200
					ease-out
					active:scale-[0.98]
					${PRESSED}
				`}
			>
				{flashcards ? 'regular mode' : 'flashcard mode'}
			</button>
			</div>

			{parts.length === 0 ? (
				<p className="
					mt-[32px]
					font-vietnam
					text-[13.5px]
					text-black/50
					text-center
				">
					This lab doesn&apos;t have instructions yet.
				</p>
			) : flashcards ? (
				<div className="
					mt-[34px]
					flex
					justify-center
				">
					<Flashcards parts={parts} />
				</div>
			) : (
				<div className="
					mt-[32px]
					w-[var(--list-w)]
					max-w-full
					mx-auto
				">
					<RegularList parts={parts} />
				</div>
			)}
		</div>
	)
}
