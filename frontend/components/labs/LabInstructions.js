'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { parseInstructions, stepsOf } from '@/lib/labContent'

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

// ---- warnings --------------------------------------------------------------

// A step's warnings, in red under it — the lines an officer marked with Tab in
// the editor (see lib/labContent.js). The same in the list and on the cards;
// only the size and spacing the caller passes differ.
function Warnings({ list, className = '' }) {
	if (!list?.length) return null
	return (
		<div className={className}>
			{list.map((warning, i) => (
				<p key={i} className="text-red">
					<span className="font-semibold">WARNING:</span> {warning}
				</p>
			))}
		</div>
	)
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
								<Warnings list={part.warnings[i]} />
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

// A card's text: title, step and warnings, in a box that scrolls when a step
// is too long for the card.
//
// The box is the whole inner card, top edge to bottom edge, so a long step
// scrolls the full height of it and slides under the badge (drawn after it,
// on top). Its padding keeps the text clear of the badge and the buttons
// while it's at rest, and the text centres in what's left while it fits —
// `my-auto` rather than `justify-center`, which would push the top of a
// too-tall block out of reach above the box.
//
// While there's more below, the bottom fades out and a "scroll" pill sits
// over it (a tap on it scrolls on); once there's something above, the top
// fades too. Phones hide scrollbars until you scroll, so without these a long
// step would just look cut off. `size` is 'card' or 'full' — the normal deck
// or the fullscreen one, whose arrows sit along the bottom, so its pill sits
// above them.
const SCROLL_SIZES = {
	card: {
		box: 'px-[40px] pt-[80px] pb-[56px]',
		fadeTop: 'h-[80px]',
		fadeBottom: 'h-[72px]',
		pill: 'bottom-[12px] gap-[4px] px-[10px] py-[4px] text-[11px]',
		chevron: 'w-[8px] h-[8px]',
	},
	full: {
		box: 'px-[80px] pt-[150px] pb-[170px]',
		fadeTop: 'h-[150px]',
		fadeBottom: 'h-[200px]',
		pill: 'bottom-[106px] gap-[8px] px-[20px] py-[8px] text-[22px]',
		chevron: 'w-[16px] h-[16px]',
	},
}

function ScrollingText({ size, children }) {
	const sizes = SCROLL_SIZES[size]
	const ref = useRef(null)
	const [above, setAbove] = useState(false)
	const [below, setBelow] = useState(false)
	// Whether the fades animate yet. Not on the way in: a long step has to
	// arrive with its fade and pill already there — sliding in with the card
	// rather than fading up after it lands — so they only animate once the
	// card has been drawn, for scrolling.
	const [settled, setSettled] = useState(false)

	const measure = useCallback(() => {
		const el = ref.current
		if (!el) return
		setAbove(el.scrollTop > 1)
		setBelow(el.scrollHeight - el.scrollTop - el.clientHeight > 1)
	}, [])

	// Measured again whenever the box or the text changes size — the card
	// turning wider, the web font arriving. The observer reports after layout
	// and before the browser paints, and flushSync puts the answer on screen
	// in that same frame, so the card is never drawn without its fade first
	// (a plain state update would land a frame late). Every card in the deck
	// is laid out at once, off to the side, so they're all measured before
	// they slide in.
	useLayoutEffect(() => {
		const el = ref.current
		if (!el) return
		let live = true
		const observer = new ResizeObserver(() => flushSync(measure))
		observer.observe(el)
		observer.observe(el.firstElementChild)
		document.fonts?.ready.then(() => live && measure())
		// two frames: the first one's callbacks run before the observer's
		let frame = requestAnimationFrame(() => {
			frame = requestAnimationFrame(() => live && setSettled(true))
		})
		return () => {
			live = false
			cancelAnimationFrame(frame)
			observer.disconnect()
		}
	}, [measure])

	const scrollOn = () => {
		const el = ref.current
		el?.scrollBy({ top: el.clientHeight * 0.6, behavior: 'smooth' })
	}

	return (
		<>
			<div
				ref={ref}
				onScroll={measure}
				className={`
					absolute
					inset-0
					overflow-y-auto
					overscroll-contain
					flex
					flex-col
					text-center
					${sizes.box}
				`}
			>
				<div className="
					my-auto
					flex
					flex-col
					items-center
				">
					{children}
				</div>
			</div>

			<div
				aria-hidden="true"
				className={`
					pointer-events-none
					absolute
					inset-x-0
					top-0
					bg-gradient-to-b
					from-white
					to-transparent
					${settled ? 'transition-opacity duration-200' : ''}
					${sizes.fadeTop}
					${above ? 'opacity-100' : 'opacity-0'}
				`}
			/>
			<div
				aria-hidden="true"
				className={`
					pointer-events-none
					absolute
					inset-x-0
					bottom-0
					bg-gradient-to-t
					from-white
					via-white/80
					to-transparent
					${settled ? 'transition-opacity duration-200' : ''}
					${sizes.fadeBottom}
					${below ? 'opacity-100' : 'opacity-0'}
				`}
			/>
			<button
				type="button"
				onClick={scrollOn}
				tabIndex={below ? 0 : -1}
				aria-hidden={!below}
				className={`
					absolute
					left-1/2
					-translate-x-1/2
					flex
					items-center
					rounded-full
					bg-green
					font-vietnam
					font-semibold
					leading-none
					text-black
					cursor-pointer
					${settled ? 'transition-opacity duration-200' : ''}
					${sizes.pill}
					${below ? 'opacity-100' : 'opacity-0 pointer-events-none'}
				`}
			>
				scroll
				{/* the right-pointing chevron, turned to point down */}
				<Chevron
					direction="right"
					className={`
						${sizes.chevron}
						rotate-90
						motion-safe:animate-bounce
					`}
				/>
			</button>
		</>
	)
}

// One card's face in the normal-size deck — the design's 530×415 white
// window: badge in the corner, title and step centred in the middle.
function CardFace({ step }) {
	return (
		<>
			<ScrollingText size="card">
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
				<Warnings
					list={step.warnings}
					className="
						mt-[10px]
						max-w-[290px]
						font-vietnam
						text-[14.5px]
						leading-[23.4px]
					"
				/>
			</ScrollingText>
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
		</>
	)
}

// The same card, drawn on the fullscreen mockup's 1712×1004 frame — its text
// scrolling the same way.
function FullscreenFace({ step }) {
	return (
		<>
			<ScrollingText size="full">
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
				<Warnings
					list={step.warnings}
					className="
						mt-[20px]
						max-w-[700px]
						font-vietnam
						text-[29px]
						leading-[47px]
					"
				/>
			</ScrollingText>
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
		</>
	)
}

// The fullscreen deck. It lives in its own box on <body> (so none of the
// page's zoom or layout reaches it) that only shows while it's fullscreen,
// and it zooms its 1712×1004 frame to fit whatever screen it's on. A screen
// taller than it is wide (a phone held upright) would shrink that frame to a
// quarter and the text to nothing, so there the frame is only PORTRAIT_W wide
// and runs as tall as the screen.
const PORTRAIT_W = 720

function FullscreenDeck({ host, steps, index, go, onExit }) {
	const { width, height } = useWindowSize()
	const zoom = height > width
		? Math.min(width / PORTRAIT_W, height / 1004)
		: Math.min(width / 1712, height / 1004)

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
	// An iPhone has no Fullscreen API for anything but <video>, so there the
	// box is pinned over the whole window instead (the `filling` class in
	// globals.css) — the same deck, short of hiding the browser's own bars.
	const [filling, setFilling] = useState(false)
	const fullscreen = (useFullscreenElement() === host && host !== null) || filling
	useEffect(() => {
		if (!host || !filling) return
		host.classList.add('filling')
		const html = document.documentElement
		const overflow = html.style.overflow
		html.style.overflow = 'hidden'
		return () => {
			host.classList.remove('filling')
			html.style.overflow = overflow
		}
	}, [host, filling])

	const go = (next) => setIndex(Math.max(0, Math.min(steps.length - 1, next)))

	// arrow keys step through the deck, in or out of fullscreen — unless the
	// keypress is somebody typing in a field
	useEffect(() => {
		const onKey = (event) => {
			if (event.target.closest?.('input, textarea, select, [contenteditable]')) return
			if (event.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
			if (event.key === 'ArrowRight') setIndex((i) => Math.min(steps.length - 1, i + 1))
			if (event.key === 'Escape') setFilling(false)
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [steps.length])

	const enterFullscreen = () => {
		if (!host) return
		if (host.requestFullscreen) host.requestFullscreen().catch(() => setFilling(true))
		else setFilling(true)
	}
	const exitFullscreen = () => {
		setFilling(false)
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
	// 2 on the left, 3 and 4 on the right. Below `lg` there isn't the width
	// for two, so it's one column, the full width of the deck.
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
							auto-rows-[38.3px]
							gap-y-[9.2px]
							lg:grid-flow-col
							lg:grid-cols-[repeat(2,var(--toc-col))]
							lg:grid-rows-[repeat(var(--toc-rows),38.3px)]
							lg:gap-x-[var(--toc-gap)]
						"
						style={{
							'--toc-rows': rows,
							'--toc-col': `${TOC_COL}px`,
							'--toc-gap': `${TOC_GAP}px`,
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
	const parts = useMemo(() => parseInstructions(text), [text])
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
