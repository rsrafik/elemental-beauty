'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollToPlugin } from 'gsap/ScrollToPlugin'
import { ALBUM } from './content'
import { useLandingContent } from './live'

// The album: a deck of cards, one per event.
//
// Every card is a photograph with a strip underneath for its name and number.
// The fan opens when you reach it (Motion.js), and the card under the pointer
// lifts while its neighbours lean out of the way.
//
// How the fan is built. Every card sits in the same spot, hinged on a point
// well below the deck, and is turned by its place in the line times
// `--spread`. `--push` is the lean a hovered neighbour gives it. The deck
// arrives as a stack on the leftmost card's place and opens out as the
// section is scrolled into (Motion.js); all of it is the card's one
// transform in app/landing.css.
//
// Pulling a card. There is no viewer and nothing covers the page: the card
// itself comes out of the fan. It lifts, straightens and grows into a
// close-up standing over the deck, the rest of the deck dims behind it, and
// a panel slides up inside the card with the event's name, date and a few
// lines about it. Left and right pull the neighbouring card as this one goes
// back; Escape, "close", or a click anywhere else sends it home.
//
// How the flight works. The close-up is the same element at a real, larger
// size (the class `is-open`), not a scaled-up small card, so its type is
// sharp. To get there it is put at its final size and place first, and then
// moved, shrunk and tilted so that it sits exactly over where it just was;
// the tween is that correction being let go. Going home is the reverse: it
// is tweened to where its slot in the fan is, and only then given back to
// the fan. A card is the same shape at both sizes — a fixed proportion, with
// its small type sized off its own width — which is why the two line up.
//
// PLACEHOLDER photos: a card with no `src` in content.js shows a flat swatch
// with its number instead.

gsap.registerPlugin(ScrollToPlugin)

const SWATCHES = {
	salmon: 'bg-salmon',
	yellow: 'bg-yellow',
	green: 'bg-green',
	lilac: 'bg-lilac',
	orange: 'bg-orange',
	berry: 'bg-berry-light',
	serum: 'bg-serum',
	blue: 'bg-blue-light',
}

const code = (index) => String(index + 1).padStart(2, '0')

const stillMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// the middle of an element as it is drawn right now, in window coordinates
const middleOf = (element) => {
	const box = element.getBoundingClientRect()
	return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
}

// how many degrees a card is turned when it is resting in the fan
const tiltOf = (deck, offset) => offset * (parseFloat(getComputedStyle(deck).getPropertyValue('--spread')) || 0)

// Where a card rests in the fan: its middle, its width and its tilt. Worked
// out rather than measured, because the card being asked about is out of the
// fan at the time. Every card has the same box before it is turned, so any
// card still in the fan stands in for it; the hinge is HINGE of the way down
// that box (app/landing.css's transform-origin), which puts a card's middle
// HINGE - 0.5 card-heights above it.
const HINGE = 3.5
const slotOf = (deck, offset) => {
	const peer = deck.querySelector('[data-card]:not(.is-open)')
	const frame = deck.getBoundingClientRect()
	const tilt = tiltOf(deck, offset)
	const turn = (tilt * Math.PI) / 180
	const height = peer.offsetHeight
	const reach = (HINGE - 0.5) * height
	return {
		x: frame.left + peer.offsetLeft + reach * Math.sin(turn),
		y: frame.top + peer.offsetTop + HINGE * height - reach * Math.cos(turn),
		width: peer.offsetWidth,
		tilt,
	}
}

// Out of the fan and up into the close-up.
function flyOut(deck, card) {
	const offset = Number(card.dataset.offset)
	const from = middleOf(card)
	const width = card.offsetWidth
	const tilt = tiltOf(deck, offset)

	gsap.killTweensOf(card)
	card.classList.remove('is-landing', 'is-leaving')
	card.classList.add('is-open')
	gsap.set(card, { clearProps: 'transform' })
	if (stillMotion()) return

	const to = middleOf(card)
	gsap.fromTo(
		card,
		{ x: from.x - to.x, y: from.y - to.y, scale: width / card.offsetWidth, rotation: tilt },
		{ x: 0, y: 0, scale: 1, rotation: 0, duration: 1, ease: 'mech', clearProps: 'transform' },
	)
	// the close-up is taller than the deck: bring its middle to the middle of
	// the window as it arrives
	gsap.to(window, {
		scrollTo: { y: window.scrollY + to.y - window.innerHeight / 2, autoKill: true },
		duration: 1,
		ease: 'mech',
	})
}

// Back down into its slot. `landed` is called once it is a card in the fan
// again.
function flyHome(deck, card, landed) {
	// Given back to the fan with its transition off for a moment, or the fan
	// would animate it into a place it is already in.
	const land = () => {
		card.classList.add('is-landing')
		card.classList.remove('is-open', 'is-leaving')
		gsap.set(card, { clearProps: 'transform' })
		requestAnimationFrame(() => requestAnimationFrame(() => card.classList.remove('is-landing')))
		landed?.()
	}

	gsap.killTweensOf(card)
	if (stillMotion()) return land()

	// the panel folds away first (app/landing.css), so the card that travels
	// is the plain one
	card.classList.add('is-leaving')
	const now = middleOf(card)
	// where its middle is with no tween on it: a flight may have been
	// interrupted part-way
	const base = { x: now.x - gsap.getProperty(card, 'x'), y: now.y - gsap.getProperty(card, 'y') }
	const slot = slotOf(deck, Number(card.dataset.offset))
	gsap.to(card, {
		x: slot.x - base.x,
		y: slot.y - base.y,
		scale: slot.width / card.offsetWidth,
		rotation: slot.tilt,
		duration: 0.85,
		ease: 'mech',
		onComplete: land,
	})
}

// A card's picture: the photograph if it has one, otherwise its swatch with
// the card's number. The number is sized off the card's own width, so it is
// the same proportion small and large.
function Face({ photo, index }) {
	if (photo.src) {
		return (
			// eslint-disable-next-line @next/next/no-img-element
			<img
				src={photo.src}
				alt=""
				draggable="false"
				className="
					size-full
					object-cover
				"
			/>
		)
	}
	return (
		<div className={`
			grid
			size-full
			place-items-center
			${SWATCHES[photo.shade] || SWATCHES.salmon}
		`}>
			<span className="
				type-display
				text-[40cqw]
				text-ink/85
				italic
			">
				{code(index)}
			</span>
		</div>
	)
}

export default function Album() {
	const { photos } = useLandingContent()
	const middle = (photos.length - 1) / 2
	// which card is out: as state for what the page says, and as a ref for the
	// flights, which must not wait for a render
	const [out, setOut] = useState(null)
	const outRef = useRef(null)
	const deckRef = useRef(null)

	const cardAt = (index) => deckRef.current?.querySelector(`[data-card="${index}"]`)

	// lean the neighbours away from the card under the pointer
	const lean = (index) => {
		if (outRef.current !== null) return
		deckRef.current?.querySelectorAll('[data-card]').forEach((card, at) => {
			card.style.setProperty('--push', index === null ? '0' : String(Math.sign(at - index)))
		})
	}

	// Pull a card, or with null put the one that is out back. Pulling one
	// while another is out sends that one home at the same time.
	const pull = useCallback((index) => {
		const deck = deckRef.current
		const was = outRef.current
		if (!deck || was === index) return
		deck.querySelectorAll('[data-card]').forEach((card) => card.style.setProperty('--push', '0'))
		if (was !== null) {
			const home = cardAt(was)
			flyHome(deck, home, () => {
				// When the deck is whole again, hand focus back to the card that
				// was out — once it has landed, because until then it has no
				// button to focus. Not if the reader has since moved on.
				const lost = !document.activeElement || document.activeElement === document.body
				if (outRef.current === null && (lost || home.contains(document.activeElement))) {
					home.querySelector('[data-pull]')?.focus({ preventScroll: true })
				}
			})
		}
		outRef.current = index
		if (index !== null) flyOut(deck, cardAt(index))
		setOut(index)
	}, [])

	const close = useCallback(() => pull(null), [pull])

	const step = useCallback(
		(by) => {
			if (outRef.current === null) return
			pull((outRef.current + by + photos.length) % photos.length)
		},
		[pull, photos.length],
	)

	// keys while a card is out, and focus into it
	useEffect(() => {
		if (out === null) return
		const onKey = (event) => {
			if (event.key === 'Escape') close()
			if (event.key === 'ArrowRight') step(1)
			if (event.key === 'ArrowLeft') step(-1)
		}
		window.addEventListener('keydown', onKey)
		cardAt(out)?.querySelector('[data-close]')?.focus({ preventScroll: true })
		return () => window.removeEventListener('keydown', onKey)
	}, [out, close, step])

	return (
		<section
			id="album"
			className="
				relative
				overflow-x-clip
				bg-yellow-light
				pt-sec-l
				pb-sec-m
			"
		>
			<div className="
				grid
				grid-cols-4
				gap-x-gutter
				gap-y-sec-s
				px-edge
				lg:grid-cols-6
			">
				<h2
					data-title
					className="
						type-display
						col-span-full
						text-mega
						lg:col-span-4
						lg:col-start-1
					"
				>
					<span className="
						type-script
						mr-[0.08em]
						text-[0.7em]
						text-salmon-dark
					">
						the
					</span>{' '}
					Album
				</h2>
				<p
					data-rise
					className="
						type-serif
						col-span-full
						max-w-[16ch]
						self-end
						text-h4
						lg:col-span-2
						lg:col-start-5
						lg:justify-self-end
						lg:text-right
					"
				>
					{ALBUM.intro}
				</p>
			</div>

			<div
				ref={deckRef}
				data-deck
				data-open={out === null ? undefined : ''}
				onPointerLeave={() => lean(null)}
				// the leftmost card's place in the line: the deck arrives stacked
				// on it, and how many gaps the fan has to share its width between
				// on wide windows (app/landing.css)
				style={{ '--first': -middle, '--gaps': photos.length - 1 }}
				className="
					lp-deck
					relative
					mx-auto
					mt-sec-s
				"
			>
				{/* While a card is out, a click anywhere that is not the card
				    puts it back. It lies over the dimmed deck and under the
				    close-up, and reaches well past the deck on every side. */}
				{out !== null && (
					<div
						aria-hidden="true"
						onClick={close}
						className="
							absolute
							-inset-x-[100vw]
							-inset-y-[100vh]
							z-20
						"
					/>
				)}

				{photos.map((item, index) => (
					<article
						key={index}
						data-card={index}
						data-offset={index - middle}
						onPointerEnter={() => lean(index)}
						style={{ '--offset': index - middle }}
						className="
							lp-card
							@container
							absolute
							left-1/2
							aspect-[5/7]
							overflow-hidden
							bg-cream
							shadow-float
						"
					>
						<div className="h-[88%]">
							<Face photo={item} index={index} />
						</div>
						{/* the strip: sized off the card's width, like the number
						    above it, so the card is the same card at any size */}
						<p className="
							flex
							h-[12%]
							items-center
							justify-between
							gap-[3cqw]
							px-[6cqw]
							font-dmmono
							text-[5cqw]
							tracking-[0.04em]
							uppercase
						">
							<span className="
								truncate
								font-fourhand
								text-[7cqw]
								tracking-normal
								normal-case
							">
								{item.title}
							</span>
							<span className="opacity-60">{code(index)}</span>
						</p>

						{/* the whole card is the button that pulls it */}
						<button
							type="button"
							data-pull
							data-cursor="view"
							aria-label={`Open ${item.title}, photograph ${code(index)}`}
							aria-expanded={out === index}
							onClick={() => pull(index)}
							onFocus={() => lean(index)}
							onBlur={() => lean(null)}
							className="
								lp-card-pull
								absolute
								inset-0
								cursor-pointer
							"
						/>

						{/* what the card says once it is out: slides up inside it */}
						<div className="
							lp-card-panel
							absolute
							inset-x-0
							bottom-0
							flex
							flex-col
							gap-[0.55em]
							bg-cream
							p-[clamp(1rem,6cqw,1.75rem)]
						">
							{item.date && <p className="
								font-essays
								text-small
								opacity-60
							">
								{item.date}
							</p>}
							<h3 className="
								font-fourhand
								text-h4
								leading-[1.1]
							">
								{item.title}
							</h3>
							{item.text && <p className="
								font-essays
								text-body
								leading-[1.35]
							">
								{item.text}
							</p>}
							<div className="
								mt-[0.5em]
								flex
									justify-end
							">
								<button
									type="button"
									data-close
									onClick={close}
									className="
										lp-underline
										type-label
										cursor-pointer
									"
								>
									close [ esc ]
								</button>
							</div>
						</div>
					</article>
				))}
			</div>
		</section>
	)
}
