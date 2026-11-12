'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { TEAM } from './content'
import { useLandingContent } from './live'

// The people, under "who we are": two rails of names, each name followed by a
// small tilted portrait.
//
// At rest the rails drift, slowly, the top one one way and the bottom one the
// other. Scrolling the page pushes them: each rail moves as far as the page
// did, in its own direction, and scrolling back up sends both the other way
// (and leaves them drifting that way). The portraits rock from side to side as
// the section travels up the window. A rail is its list several times over,
// moved by one list's width and started again, which is why it has no seam.
//
// Clicking a name takes over the screen. Two panels wipe across it, one
// upwards and one downwards: the first is a wash of the person's pigment and
// carries the portrait, with their number half hidden behind it; the second
// is paper, set like a page of an old book, with their name large, a few
// lines about them, and the neighbours' names at the foot as "before" and
// "after". Stepping slides the portrait out sideways, turning as it goes,
// while the number travels further than it does, and the wash changes to the
// next person's pigment. Closing carries everything on upwards and the panels
// follow through the way they came.
//
// The rails are only moved by the script: without it, or with reduced motion,
// they are two still rows and every name can still be opened.
//
// PLACEHOLDER people: see TEAM in content.js, until an admin adds the real
// ones on /landing-editor (live.js). A person with no `src` shows a flat
// swatch with their number instead of a photograph.

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

// the same pigments as colours, for the takeover: a person's number is set in
// theirs, and the panel behind their portrait is a wash of it over the paper.
// Written out because the theme's colours are inlined into the utilities and
// are not there as variables: keep them in step with globals.css.
const PIGMENTS = {
	salmon: '#FF8A78',
	yellow: '#FFDF2B',
	green: '#A7CC70',
	lilac: '#C8B6FF',
	orange: '#FF7D45',
	berry: '#FFC4D6',
	serum: '#FFB347',
	blue: '#B5CFFF',
}
const PAPER = '#FFFBEB'

const pigment = (person) => PIGMENTS[person?.shade] || PIGMENTS.salmon

const tint = (person) => `color-mix(in srgb, ${pigment(person)} 38%, ${PAPER})`

// SWITCHED OFF FOR NOW: clicking a name to open the takeover. Set this back to
// true to bring it back; nothing else needs to change.
const TAKEOVER = false

// how many times a rail's list is laid end to end: enough that one list can
// slide out of the window and the rest still cover the widest screen
const COPIES = 4

// a rail drifts this many pixels a second when nothing is scrolling
const DRIFT = 48

// how long the panels take to leave, after which the takeover is really shut
const CLOSE_MS = 1250

const code = (index) => String(index + 1).padStart(2, '0')

const stillMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// what a person is called on the rail: their name once they have one
const called = (person) => person.name || person.role

const slides = (overlay, name) => [...(overlay?.querySelectorAll(`[data-${name}]`) || [])]

// Put one person on the panels with nobody else, without a move: how the
// takeover is dressed before it opens.
const place = (overlay, index) => {
	slides(overlay, 'face').forEach((face, at) => {
		gsap.killTweensOf([face, ...face.querySelectorAll('[data-turn], [data-tag]')])
		gsap.set(face, { xPercent: 0, autoAlpha: at === index ? 1 : 0 })
		gsap.set(face.querySelectorAll('[data-turn]'), { rotation: 0 })
		gsap.set(face.querySelectorAll('[data-tag]'), { x: 0 })
	})
	slides(overlay, 'lines').forEach((words, at) => {
		gsap.killTweensOf(words)
		gsap.set(words, { yPercent: 0, autoAlpha: at === index ? 1 : 0 })
	})
}

// From one person to the next. `by` is 1 for the one after, -1 for the one
// before: the portrait leaves on the side the new one is not coming from.
const slide = (overlay, from, to, by) => {
	if (stillMotion()) return place(overlay, to)
	const faces = slides(overlay, 'face')
	const words = slides(overlay, 'lines')
	const move = { duration: 1, ease: 'mech', overwrite: true }

	gsap.to(faces[from], { ...move, xPercent: -100 * by, autoAlpha: 0 })
	gsap.to(faces[from].querySelectorAll('[data-turn]'), { ...move, rotation: -30 * by })
	gsap.to(faces[from].querySelectorAll('[data-tag]'), { ...move, x: -220 * by })

	gsap.fromTo(faces[to], { xPercent: 100 * by, autoAlpha: 1 }, { ...move, xPercent: 0, autoAlpha: 1 })
	gsap.fromTo(faces[to].querySelectorAll('[data-turn]'), { rotation: 30 * by }, { ...move, rotation: 0 })
	gsap.fromTo(faces[to].querySelectorAll('[data-tag]'), { x: 220 * by }, { ...move, x: 0 })

	// the lines: the old ones go up and out, the new ones come up after them
	gsap.to(words[from], { yPercent: -30, autoAlpha: 0, duration: 0.6, ease: 'expo', overwrite: true })
	gsap.fromTo(
		words[to],
		{ yPercent: 30, autoAlpha: 0 },
		{ yPercent: 0, autoAlpha: 1, duration: 0.6, delay: 0.3, ease: 'expo', overwrite: true },
	)
}

// `bare` leaves the number off the stand-in swatch.
function Portrait({ person, index, bare }) {
	if (person.src) {
		return (
			// eslint-disable-next-line @next/next/no-img-element
			<img
				src={person.src}
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
		<span className={`
			grid
			size-full
			place-items-center
			${SWATCHES[person.shade] || SWATCHES.salmon}
		`}>
			{!bare && <span className="
				type-display
				text-[42cqw]
				text-ink/85
				italic
			">
				{code(index)}
			</span>}
		</span>
	)
}

// a thin arrow, drawn so that it does not depend on the book face having one
function Arrow({ back }) {
	return (
		<svg
			viewBox="0 0 28 10"
			aria-hidden="true"
			className={`
				lp-team-arrow
				${back ? 'lp-team-arrow-back -scale-x-100' : ''}
				h-[0.7em]
				w-[2em]
				fill-none
				stroke-current
			`}
		>
			<path d="M0 5h27M22 1l5 4-5 4" />
		</svg>
	)
}

// One rail. `way` is 1 or -1: which way it runs. Only the first copy of the
// list is offered to the keyboard and to screen readers; the rest are the
// same people again.
function Rail({ way, order, people, onOpen }) {
	return (
		<div
			data-rail={way}
			className="
				lp-rail
				flex
				w-max
				will-change-transform
			"
		>
			{Array.from({ length: COPIES }, (_, copy) => (
				<ul
					key={copy}
					data-rail-list
					aria-hidden={copy > 0 ? 'true' : undefined}
					className="
						flex
						shrink-0
						items-center
					"
				>
					{order.map((index) => {
						const person = people[index]
						return (
							<li
								key={index}
								className="shrink-0"
							>
								<button
									type="button"
									data-person={index}
									disabled={!TAKEOVER}
									data-cursor={TAKEOVER ? 'meet' : undefined}
									tabIndex={copy > 0 ? -1 : undefined}
									aria-haspopup={TAKEOVER ? 'dialog' : undefined}
									onClick={(event) => onOpen(index, event.currentTarget)}
									className={`
										lp-rail-item
										type-serif
										mr-[0.7em]
										flex
										${TAKEOVER ? 'cursor-pointer' : ''}
										items-center
										gap-[0.28em]
										py-[0.35em]
										text-[clamp(2.6rem,7vw,6.5rem)]
										whitespace-nowrap
									`}
								>
									{/* the name twice in one place, upright and in the
									    italic: the pointer fades one into the other, and
									    because both are always there the rail never has
									    to make room */}
									<span className="
										lp-rail-name
										inline-grid
										justify-items-center
									">
										<span className="
											lp-rail-roman
											col-start-1
											row-start-1
										">
											{called(person)}
										</span>
										<span
											aria-hidden="true"
											className="
												lp-rail-italic
												col-start-1
												row-start-1
												text-salmon-med
												italic
											"
										>
											{called(person)}
										</span>
									</span>
									{/* the outer span rocks with the scroll, the inner one
									    keeps the portrait's own tilt */}
									<span className="
										lp-rail-sway
										block
										w-[1.5em]
									">
										<span
											style={{ rotate: `${person.tilt}deg` }}
											className="
												@container
												block
												aspect-[3/4]
												overflow-hidden
												shadow-soft
											"
										>
											<Portrait person={person} index={index} />
										</span>
									</span>
								</button>
							</li>
						)
					})}
				</ul>
			))}
		</div>
	)
}

export default function Team() {
	const { people } = useLandingContent()
	const count = people.length
	const rootRef = useRef(null)
	const overlayRef = useRef(null)
	const openerRef = useRef(null)
	const currentRef = useRef(0)
	const closingRef = useRef(null)
	// closed, open, or closing: the stylesheet moves the panels on this
	const [state, setState] = useState('closed')
	const [current, setCurrent] = useState(0)

	const forward = people.map((_, index) => index)
	const backward = [...forward].reverse()

	// ---- the rails ----
	useEffect(() => {
		const root = rootRef.current
		if (!root || stillMotion()) return

		const rails = [...root.querySelectorAll('[data-rail]')].map((element) => ({
			element,
			way: Number(element.dataset.rail),
			x: 0,
			span: 0,
		}))
		const measure = () => {
			rails.forEach((rail) => {
				rail.span = rail.element.querySelector('[data-rail-list]').getBoundingClientRect().width
			})
		}
		measure()
		const resized = new ResizeObserver(measure)
		resized.observe(root)

		let frame = 0
		let last = performance.now()
		let scrolled = window.scrollY
		// the scroll that has happened but has not been handed to the rails yet:
		// it is let out a share at a time, so a jump of the wheel is a push and
		// not a jolt
		let owed = 0
		// which way the page last moved; the drift follows it
		let heading = 1

		const tick = (now) => {
			const elapsed = Math.min(now - last, 64) / 1000
			last = now

			const moved = window.scrollY - scrolled
			scrolled = window.scrollY
			if (moved) heading = Math.sign(moved)
			owed += moved
			const push = owed * Math.min(1, elapsed * 9)
			owed -= push

			// how far the section has travelled up the window, in windows
			const travel = (window.innerHeight - root.getBoundingClientRect().top) / window.innerHeight
			const sway = 20 * Math.sin(3 * travel)

			rails.forEach((rail) => {
				if (!rail.span) return
				rail.x -= rail.way * (heading * DRIFT * elapsed + push)
				// keep it between one list's width to the left and none
				rail.x = ((rail.x % rail.span) - rail.span) % rail.span
				rail.element.style.transform = `translate3d(${rail.x.toFixed(2)}px,0,0)`
				rail.element.style.setProperty('--sway', (rail.way * sway).toFixed(2))
			})
			frame = requestAnimationFrame(tick)
		}

		// only while the rails are in the window
		const watcher = new IntersectionObserver(([entry]) => {
			cancelAnimationFrame(frame)
			if (!entry.isIntersecting) return
			last = performance.now()
			scrolled = window.scrollY
			owed = 0
			frame = requestAnimationFrame(tick)
		})
		watcher.observe(root)

		return () => {
			cancelAnimationFrame(frame)
			watcher.disconnect()
			resized.disconnect()
			rails.forEach((rail) => {
				rail.element.style.removeProperty('transform')
				rail.element.style.removeProperty('--sway')
			})
		}
	}, [people])

	// ---- the takeover ----
	const open = useCallback((index, opener) => {
		clearTimeout(closingRef.current)
		openerRef.current = opener
		currentRef.current = index
		place(overlayRef.current, index)
		setCurrent(index)
		setState('open')
	}, [])

	const close = useCallback(() => {
		setState((was) => (was === 'open' ? 'closing' : was))
		clearTimeout(closingRef.current)
		closingRef.current = setTimeout(() => setState('closed'), stillMotion() ? 0 : CLOSE_MS)
		openerRef.current?.focus({ preventScroll: true })
	}, [])

	const step = useCallback(
		(by) => {
			const from = currentRef.current
			const to = (from + by + count) % count
			currentRef.current = to
			slide(overlayRef.current, from, to, by)
			setCurrent(to)
		},
		[count],
	)

	// while it is open: the page behind holds still, the keys work, and the
	// focus stays inside
	useEffect(() => {
		if (state !== 'open') return
		const overlay = overlayRef.current
		const onKey = (event) => {
			if (event.key === 'Escape') close()
			if (event.key === 'ArrowRight') step(1)
			if (event.key === 'ArrowLeft') step(-1)
			if (event.key === 'Tab') {
				const stops = [...overlay.querySelectorAll('button')]
				const at = stops.indexOf(document.activeElement)
				event.preventDefault()
				stops[(at + (event.shiftKey ? -1 : 1) + stops.length) % stops.length].focus()
			}
		}
		window.addEventListener('keydown', onKey)
		document.documentElement.style.overflow = 'hidden'
		overlay.querySelector('[data-close]')?.focus({ preventScroll: true })
		return () => {
			window.removeEventListener('keydown', onKey)
			document.documentElement.style.overflow = ''
		}
	}, [state, close, step])

	useEffect(() => () => clearTimeout(closingRef.current), [])

	const before = people[(current - 1 + count) % count]
	const after = people[(current + 1) % count]

	return (
		<>
			<div
				ref={rootRef}
				className="
					mt-[calc(var(--spacing-sec-l)*1.75)]
					flex
					flex-col
					gap-[clamp(0.5rem,2vw,2rem)]
					overflow-x-clip
				"
			>
				<h3 className="sr-only">{TEAM.title}</h3>
				<Rail way={1} order={forward} people={people} onOpen={open} />
				<Rail way={-1} order={backward} people={people} onOpen={open} />
			</div>

			{TAKEOVER && <div
				ref={overlayRef}
				role="dialog"
				aria-modal="true"
				aria-label={`${TEAM.title}: ${called(people[current])}`}
				data-state={state}
				inert={state !== 'open'}
				style={{ '--tint': tint(people[current]) }}
				className="
					lp-team
					fixed
					inset-0
					z-70
					text-ink
				"
			>
				{/* the two panels: a wash of the person's pigment, and paper */}
				<div
					aria-hidden="true"
					className="
						lp-team-wipe
						lp-team-wipe-a
						absolute
						top-0
						left-0
						h-full
						w-1/2
						bg-(--tint)
						portrait:h-[42%]
						portrait:w-full
					"
				/>
				<div
					aria-hidden="true"
					className="
						lp-team-wipe
						lp-team-wipe-b
						absolute
						right-0
						bottom-0
						h-full
						w-1/2
						bg-cream
						portrait:h-[58%]
						portrait:w-full
					"
				/>

				{/* the portraits, one on top of another; only one is on show */}
				<div
					style={{ '--i': 0 }}
					className="
						lp-team-rise
						absolute
						top-0
						left-0
						h-full
						w-1/2
						overflow-hidden
						portrait:h-[42%]
						portrait:w-full
					"
				>
					{people.map((person, index) => (
						<div
							key={index}
							data-face
							className="
								invisible
								absolute
								inset-0
								grid
								place-items-center
							"
						>
							<div
								data-turn
								className="
									relative
									w-[min(29vw,54svh)]
									portrait:w-[min(46vw,25svh)]
								"
							>
								{/* their number, in their pigment, most of it behind
								    the portrait */}
								<p
									data-tag
									aria-hidden="true"
									style={{ color: pigment(person) }}
									className="
										absolute
										-bottom-[0.3em]
										-left-[0.6em]
										font-essays
										text-[clamp(5.5rem,17vw,17rem)]
										leading-none
										italic
									"
								>
									{code(index)}
								</p>
								<div
									style={{ rotate: `${person.tilt / 2}deg` }}
									className="
										relative
										aspect-[3/4]
										overflow-hidden
										shadow-soft
									"
								>
									<Portrait person={person} index={index} bare />
								</div>
							</div>
						</div>
					))}
				</div>

				{/* the page about them */}
				<div
					style={{ '--i': 1 }}
					className="
						lp-team-rise
						absolute
						right-0
						bottom-0
						h-full
						w-1/2
						portrait:h-[58%]
						portrait:w-full
					"
				>
					{people.map((person, index) => (
						<div
							key={index}
							data-lines
							aria-hidden={index === current ? undefined : 'true'}
							className="
								invisible
								absolute
								inset-0
								flex
								flex-col
								justify-center
								overflow-y-auto
								px-[clamp(1.5rem,5.5vw,6rem)]
								pt-20
								pb-[clamp(6rem,14svh,9rem)]
								font-essays
								portrait:justify-start
								portrait:pt-8
							"
						>
							<p className="
								flex
								items-center
								gap-[1em]
								text-small
								tracking-[0.2em]
								uppercase
								italic
								opacity-70
							">
								<span aria-hidden="true" className="h-px w-[3em] bg-current" />
								{TEAM.title}, no. {code(index)} of {code(count - 1)}
							</p>
							<h4 className="
								mt-[0.35em]
								text-[clamp(2.6rem,6.4vw,7rem)]
								leading-[0.95]
								tracking-[-0.02em]
								text-balance
							">
								{called(person)}
							</h4>
							{person.name && person.role && <p className="
								mt-[0.5em]
								text-h4
								leading-[1.1]
								text-salmon-dark
								italic
							">
								{person.role}
							</p>}
							{person.text && <p className="
								mt-[1.6em]
								max-w-[34ch]
								border-t
								border-ink/25
								pt-[1.4em]
								text-h6
								leading-[1.4]
								lg:text-h5
							">
								{person.text}
							</p>}
						</div>
					))}
				</div>

				{/* previous and next, by name: only when there is someone else */}
				{count > 1 && <div className="
					lp-team-foot
					absolute
					right-0
					bottom-0
					flex
					w-1/2
					justify-between
					gap-4
					px-[clamp(1.5rem,5.5vw,6rem)]
					font-essays
					portrait:w-full
				">
					<button
						type="button"
						aria-label={`Previous: ${called(before)}`}
						onClick={() => step(-1)}
						className="
							lp-team-step
							flex
							min-w-0
							cursor-pointer
							flex-col
							items-start
							border-t
							border-ink/25
							py-[clamp(0.9rem,2.4svh,1.6rem)]
							pr-6
							text-left
						"
					>
						<span className="
							flex
							items-center
							gap-[0.8em]
							text-small
							tracking-[0.2em]
							uppercase
							italic
							opacity-70
						">
							<Arrow back />
							before
						</span>
						<span key={current} className="lp-team-name text-h6">{called(before)}</span>
					</button>
					<button
						type="button"
						aria-label={`Next: ${called(after)}`}
						onClick={() => step(1)}
						className="
							lp-team-step
							flex
							min-w-0
							cursor-pointer
							flex-col
							items-end
							border-t
							border-ink/25
							py-[clamp(0.9rem,2.4svh,1.6rem)]
							pl-6
							text-right
						"
					>
						<span className="
							flex
							items-center
							gap-[0.8em]
							text-small
							tracking-[0.2em]
							uppercase
							italic
							opacity-70
						">
							after
							<Arrow />
						</span>
						<span key={current} className="lp-team-name text-h6">{called(after)}</span>
					</button>
				</div>}

				<button
					type="button"
					data-close
					onClick={close}
					className="
						lp-team-close
						lp-underline
						absolute
						top-0
						right-0
						m-[clamp(1rem,3vw,3rem)]
						cursor-pointer
						font-essays
						text-h6
						italic
					"
				>
					close
				</button>
			</div>}
		</>
	)
}
