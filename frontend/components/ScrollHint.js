'use client'

import { useLayoutEffect, useRef, useState } from 'react'

// The flashcards' "scroll" pill, for any popup whose card scrolls: a dark
// gradient along the bottom edge and the green pill with its bouncing chevron,
// while there's more below. Scrolled to the end, or a popup that fits, and
// both fade away. A tap on the pill scrolls on, as on the flashcards
// (ScrollingText in components/labs/LabInstructions.js).
//
// Drop it in as the last child of the box that scrolls — it finds that box
// itself (its parent), so there's no ref to pass:
//
//   <div className="max-h-[85dvh] overflow-y-auto p-8 ...">
//     ...
//     <ScrollHint />
//   </div>
//
// It's a zero-height sticky row pinned to the box's bottom edge, so it rides
// along as the card scrolls and takes up no room. The box's padding would hold
// it short of the edge (a sticky child's offset is measured inside the
// padding), so it reads the padding and reaches back out over it — to the
// bottom and to both sides — whatever padding a popup happens to have.
//
// A sticky row can't leave the end of the content, though, and the padding
// comes after the content: over the last stretch of scrolling (the padding's
// height) the row rose with the content, leaving a strip of card under the
// gradient. So in that stretch the overlay is pushed back down by however far
// the row has risen (`lift`), and stays on the edge until the very end — where
// it fades out, sliding down as it goes.
//
// All of that happens inside a clipped frame whose bottom is the card's bottom
// edge at the end of the scroll. Nothing in it may reach past that edge: an
// overlay hanging below the content counts as more to scroll, which made "is
// there more below?" flip back to yes the moment it slid away, so it came
// back, which took the room away again — it flashed in and out at the bottom.

function Chevron({ className }) {
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
			<path d="M2 1.5 8.2 8 2 14.5" />
		</svg>
	)
}

export default function ScrollHint() {
	const ref = useRef(null)
	// how far there is still to scroll, in px
	const [left, setLeft] = useState(0)
	const [pad, setPad] = useState({ bottom: 0, left: 0, right: 0 })

	useLayoutEffect(() => {
		const box = ref.current?.parentElement
		if (!box) return

		const measure = () => {
			setLeft(Math.max(0, box.scrollHeight - box.scrollTop - box.clientHeight))
			const style = getComputedStyle(box)
			const next = {
				bottom: parseFloat(style.paddingBottom) || 0,
				left: parseFloat(style.paddingLeft) || 0,
				right: parseFloat(style.paddingRight) || 0,
			}
			setPad((was) => (was.bottom === next.bottom && was.left === next.left && was.right === next.right ? was : next))
		}

		// the box changing size (the window, sm: padding) and anything in it
		// changing size (a list loading, a section opening, the font arriving)
		const sizes = new ResizeObserver(measure)
		const watch = () => {
			sizes.disconnect()
			sizes.observe(box)
			for (const child of box.children) sizes.observe(child)
		}
		const changes = new MutationObserver(() => {
			watch()
			measure()
		})
		watch()
		changes.observe(box, { childList: true, subtree: true })
		box.addEventListener('scroll', measure, { passive: true })
		let live = true
		document.fonts?.ready.then(() => live && measure())
		measure()

		return () => {
			live = false
			sizes.disconnect()
			changes.disconnect()
			box.removeEventListener('scroll', measure)
		}
	}, [])

	const below = left > 1
	// how far the sticky row has risen off the edge (see the top)
	const lift = Math.max(0, pad.bottom - left)

	const scrollOn = () => {
		const box = ref.current?.parentElement
		box?.scrollBy({ top: box.clientHeight * 0.6, behavior: 'smooth' })
	}

	return (
		<div
			ref={ref}
			className="
				sticky
				z-10
				h-0
				pointer-events-none
			"
			style={{ bottom: -pad.bottom, marginLeft: -pad.left, marginRight: -pad.right }}
		>
			{/* the clipped frame: from above the gradient down to the end of the
			    box's padding, which is as far as the box scrolls anyway */}
			<div
				className="
					absolute
					inset-x-0
					overflow-clip
				"
				style={{ bottom: -pad.bottom, height: 96 + pad.bottom }}
			>
			{/* held on the edge while there's more to see, and only then — the
			    very end — fading out and sliding down out of the frame; back at
			    once on the way up */}
			<div
				aria-hidden={!below}
				className={`
					absolute
					inset-x-0
					h-24
					${below ? 'opacity-100' : 'opacity-0 transition-[opacity,translate] duration-300 ease-out'}
				`}
				style={{ bottom: pad.bottom - lift, translate: below ? 'none' : '0 24px' }}
			>
				<div className="
					absolute
					inset-0
					bg-gradient-to-t
					from-black/25
					via-black/10
					to-transparent
				" />
				<button
					type="button"
					onClick={scrollOn}
					tabIndex={below ? 0 : -1}
					className={`
						absolute
						bottom-[14px]
						left-1/2
						-translate-x-1/2
						flex
						items-center
						gap-[5px]
						rounded-full
						bg-green
						px-[12px]
						py-[5px]
						font-vietnam
						font-semibold
						text-[12px]
						leading-none
						text-black
						shadow-[0_2px_8px_rgba(0,0,0,0.2)]
						cursor-pointer
						${below ? 'pointer-events-auto' : 'pointer-events-none'}
					`}
				>
					scroll
					{/* the flashcards' right-pointing chevron, turned to point down
					    (`rotate`, its own property, so the bounce's transform keeps it) */}
					<Chevron
						className={`
							w-[9px]
							h-[9px]
							rotate-90
							${below ? 'motion-safe:animate-bounce' : ''}
						`}
					/>
				</button>
			</div>
			</div>
		</div>
	)
}
