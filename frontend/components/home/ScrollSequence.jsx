'use client'

import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

// Scroll-driven image sequence — 192 stills painted to a <canvas>, scrubbed by
// scroll position while the section is pinned to the viewport.
//
// Canvas rather than an <img> whose src we swap: swapping src makes the browser
// decode on the paint path, which drops frames and flashes on a fast flick.
// Here every frame is decoded up front into an Image object, and scrubbing is
// just drawImage into a bitmap that's already the right size — no layout, no
// decode, no reflow, so the whole thing stays on the compositor.
//
// The pin is a real ScrollTrigger pin with pinSpacing on, so the sequence eats
// exactly END_DISTANCE of scroll and then hands off to whatever section comes
// next. Nothing downstream has to know this component exists.

const FRAME_COUNT = 192

// public/frames/hero/frame_001.jpg … frame_192.jpg. Nothing else cares about the
// format, so re-encoding the folder is a one-word change here. Keep it lossy —
// the same 192 frames as PNG are 255MB against 20MB as JPG, and every byte of
// that has to land before the preloader lets go.
const FRAME_EXT = 'jpg'
const FRAME_DIR = '/frames/hero'

// The frames are 16:9. A browser window almost never is, so something has to
// give — either bars or a crop. Every mode below scales width and height by the
// same factor, so 16:9 stays 16:9; they differ only in which one they pick.
//
//   'width'    always spans the full window width. Height follows from the
//              frame's own ratio: bars above and below on a window taller than
//              16:9, a centred vertical crop on one wider.
//   'contain'  whole frame always visible — but that means bars on the left and
//              right as soon as the window is wider than 16:9.
//   'cover'    fills the window in both directions, crops whatever overflows.
const FIT = 'width'

// What the bars are painted with under 'contain' — matches --color-cream, so
// they read as page background rather than as letterboxing.
const LETTERBOX = '#FFFBEB'

// How much scroll the sequence consumes once pinned. 400% of viewport height
// across 192 frames is roughly 2.5 frames per 100vh of scroll, which reads as
// deliberate without feeling sticky.
const END_DISTANCE = '+=400%'

// Retina looks better, but past 2x you're pushing 4x the pixels per draw for a
// difference nobody sees. Cap it.
const MAX_DPR = 2

const frameSrc = (i) => `${FRAME_DIR}/frame_${String(i + 1).padStart(3, '0')}.${FRAME_EXT}`

export default function ScrollSequence() {
	const rootRef = useRef(null)
	const pinRef = useRef(null)
	const canvasRef = useRef(null)
	const ctxRef = useRef(null)
	const imagesRef = useRef([])

	const [progress, setProgress] = useState(0)
	const [ready, setReady] = useState(false)
	const [overlayGone, setOverlayGone] = useState(false)

	// ---- preload -----------------------------------------------------------
	//
	// Every frame is requested at once. The sequence can't start until the last
	// one lands anyway, so there's no ordering to be clever about — the browser's
	// own connection pool does the queueing.

	useEffect(() => {
		let cancelled = false
		let settled = 0

		const images = new Array(FRAME_COUNT)

		const onSettled = () => {
			if (cancelled) return
			settled += 1
			setProgress(Math.round((settled / FRAME_COUNT) * 100))
			if (settled === FRAME_COUNT) setReady(true)
		}

		for (let i = 0; i < FRAME_COUNT; i += 1) {
			const img = new window.Image()
			img.decoding = 'async'
			// A 404 counts as settled too. Counting only successes means one
			// missing file leaves the preloader parked at 99% forever.
			img.onload = onSettled
			img.onerror = onSettled
			img.src = frameSrc(i)
			images[i] = img
		}

		imagesRef.current = images

		return () => {
			cancelled = true
			for (const img of images) {
				img.onload = null
				img.onerror = null
			}
		}
	}, [])

	// Hold the page still while frames come in, so nobody scrolls past the
	// sequence before it exists and lands in a blank gap.
	useEffect(() => {
		if (ready) return
		const previous = document.body.style.overflow
		document.body.style.overflow = 'hidden'
		return () => {
			document.body.style.overflow = previous
		}
	}, [ready])

	// ---- draw + scrub ------------------------------------------------------

	useEffect(() => {
		if (!ready) return

		// Registering here rather than at module scope: this file is a Client
		// Component, but it still evaluates once on the server during the static
		// export, and there's no reason to run plugin registration there.
		gsap.registerPlugin(ScrollTrigger)

		// Mobile browsers fire a resize every time the URL bar slides away. Left
		// alone that re-measures the pin mid-scroll and the sequence jumps.
		ScrollTrigger.config({ ignoreMobileResize: true })

		const canvas = canvasRef.current
		const root = rootRef.current
		const pin = pinRef.current
		if (!canvas || !root || !pin) return

		ctxRef.current = canvas.getContext('2d', { alpha: false })

		let lastDrawn = -1

		// object-fit, by hand, in canvas coordinates. The single `scale` applied to
		// both axes is the part that matters: width and height move together, so
		// the frame's aspect ratio survives whatever shape the viewport is.
		// min() leaves the whole frame visible, max() fills the box and crops.
		const draw = (index) => {
			const ctx = ctxRef.current
			const img = imagesRef.current[index]
			if (!ctx || !img || !img.complete || !img.naturalWidth) return

			const cw = canvas.width
			const ch = canvas.height
			const sx = cw / img.naturalWidth
			const sy = ch / img.naturalHeight
			const scale = FIT === 'cover'
				? Math.max(sx, sy)
				: FIT === 'width'
					? sx
					: Math.min(sx, sy)
			const dw = img.naturalWidth * scale
			const dh = img.naturalHeight * scale
			const dx = (cw - dw) / 2
			const dy = (ch - dh) / 2

			// 'contain' leaves bars, and an alpha:false context clears to black —
			// which would look like letterboxing on a cream page rather than like
			// the page continuing behind the frame.
			if (dx > 0.5 || dy > 0.5) {
				ctx.fillStyle = LETTERBOX
				ctx.fillRect(0, 0, cw, ch)
			}

			ctx.drawImage(img, dx, dy, dw, dh)
			lastDrawn = index
		}

		// Backing store in device pixels, CSS size left to Tailwind. Assigning
		// width/height also clears the canvas and resets context state, so this
		// always has to be followed by a redraw.
		const resize = () => {
			// The canvas can have no box yet: ScrollTrigger swaps the pinned element
			// into its spacer during setup, and the observer's first delivery is a
			// frame behind that. Falling back to the window rather than bailing is
			// what matters — a canvas left at its default 300x150 buffer still gets
			// stretched by CSS to fill the viewport, and 2:1 forced into a 16:9 box
			// is a visible distortion on first paint. The pinned canvas is
			// viewport-sized by definition, so the window is the right guess.
			const cssW = canvas.clientWidth || window.innerWidth
			const cssH = canvas.clientHeight || document.documentElement.clientHeight
			if (!cssW || !cssH) return

			const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
			const nextW = Math.round(cssW * dpr)
			const nextH = Math.round(cssH * dpr)
			if (nextW === canvas.width && nextH === canvas.height) return

			canvas.width = nextW
			canvas.height = nextH
			ctxRef.current = canvas.getContext('2d', { alpha: false })

			const current = lastDrawn < 0 ? 0 : lastDrawn
			lastDrawn = -1
			draw(current)
		}

		const state = { frame: 0 }

		const render = () => {
			const index = Math.min(FRAME_COUNT - 1, Math.max(0, Math.round(state.frame)))
			if (index === lastDrawn) return
			draw(index)
		}

		// gsap.context scopes everything created inside it, so the cleanup below
		// is a single revert — which is what makes Strict Mode's double-mount
		// harmless instead of leaving a second pin and a second trigger behind.
		const gsapCtx = gsap.context(() => {
			gsap.to(state, {
				frame: FRAME_COUNT - 1,
				ease: 'none',
				snap: 'frame',
				onUpdate: render,
				scrollTrigger: {
					trigger: root,
					start: 'top top',
					end: END_DISTANCE,
					pin,
					// The spacer is what makes the hand-off seamless: ScrollTrigger
					// reserves the pinned distance in normal flow, so the section
					// after this one arrives on its own with nothing to correct.
					pinSpacing: true,
					anticipatePin: 1,
					scrub: 0.5,
					invalidateOnRefresh: true
				}
			})
		}, rootRef)

		// A pinned element is position:fixed, which detaches it from its parent's
		// width, so ScrollTrigger writes the width and height it measured onto the
		// element as inline styles. That measurement is taken once, while the pin
		// is being built — which is the same commit that releases the preloader's
		// scroll lock, with the scrollbar coming back and the page reflowing under
		// it. Measure a few pixels short there and the canvas never reaches the
		// window edges again: the stale number is exactly what ScrollTrigger
		// believes the element should be, so nothing later disagrees with it.
		//
		// refresh() re-measures and rewrites those inline styles. Once after the
		// first paint settles the initial case; once per real width change keeps
		// it settled.
		let lastWidth = window.innerWidth

		const onBoxChange = () => {
			resize()
			// Guarding on the window width is what keeps this from looping —
			// refresh() resizes the pinned element, which trips the observer again.
			if (window.innerWidth !== lastWidth) {
				lastWidth = window.innerWidth
				ScrollTrigger.refresh()
			}
		}

		// Observing the element rather than calling resize() once and listening on
		// window: at the moment this effect runs the canvas still has no box, and
		// a window listener never fires to correct that — the first paint would
		// stay blank until the user happened to resize. The observer delivers the
		// first real box whenever it lands, then every later one through the same
		// path: pin swap, rotation, mobile URL bar.
		// Size the buffer now so the very first painted frame is already correct,
		// then let the observer refine it when the real box lands.
		resize()

		const observer = new ResizeObserver(onBoxChange)
		observer.observe(canvas)

		// A monitor switch changes devicePixelRatio without changing the CSS box,
		// which the observer won't see.
		window.addEventListener('resize', onBoxChange)

		const settle = requestAnimationFrame(() => ScrollTrigger.refresh())

		return () => {
			cancelAnimationFrame(settle)
			observer.disconnect()
			window.removeEventListener('resize', onBoxChange)
			gsapCtx.revert()
		}
	}, [ready])

	return (
		<>
			{!overlayGone && (
				<div
					onTransitionEnd={() => setOverlayGone(true)}
					className={`
						fixed
						inset-0
						z-50
						flex
						flex-col
						items-center
						justify-center
						gap-6
						bg-cream
						transition-opacity
						duration-700
						ease-out
						${ready ? 'pointer-events-none opacity-0' : 'opacity-100'}
					`}
				>
					<p className="
						font-reasons
						text-[64px]
						leading-none
						text-orange-dark
						tabular-nums
					">
						{progress}%
					</p>

					<div className="
						h-[6px]
						w-[220px]
						overflow-hidden
						rounded-full
						bg-orange-lightest
					">
						<div
							style={{ width: `${progress}%` }}
							className="
								h-full
								rounded-full
								bg-orange
								transition-[width]
								duration-200
								ease-out
							"
						/>
					</div>

					<p className="
						font-handrawn
						text-[20px]
						text-orange-dark
					">
						loading
					</p>
				</div>
			)}

			<section
				ref={rootRef}
				className="
					relative
					w-full
				"
			>
				<div
					ref={pinRef}
					className="
						h-[100svh]
						w-full
						overflow-hidden
						bg-cream
					"
				>
					<canvas
						ref={canvasRef}
						aria-hidden="true"
						className="
							block
							h-full
							w-full
						"
					/>
				</div>
			</section>
		</>
	)
}
