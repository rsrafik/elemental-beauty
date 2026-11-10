import Link from 'next/link'
import Emulsion from './Emulsion'
import { CLUB, HERO } from './content'

// The first screen: the name at the size of the window, over the emulsion.
//
// "elemental" is written in calligraphy across the top and "beauty" answers
// it in the soft, rounded face, pushed to the right edge, which opens a gap
// beside it for the tagline — the lopsidedness is the layout. The second word
// is pulled up until its tall letters slip under the foot of the first, so
// the two read as one mark: the written word lies on top. The labels in the
// corners are written like the small print on a bottle: where it was made,
// what is in it.
//
// The page script raises the pieces of the name (Motion.js), and the canvas
// reads where each one ended up so it can draw it through the droplets
// (Emulsion.js). A piece is whatever carries `lp-ch`: one capital, or the
// whole of the written word, which is never split because a script's letters
// join. `data-line` and the sizeless `i` at the end of each line are what the
// canvas measures from.

const letters = (word) =>
	[...word].map((letter, index) => (
		<span
			key={index}
			className="
				lp-ch
				inline-block
				will-change-transform
			"
		>
			{letter}
		</span>
	))

export default function Hero() {
	return (
		<section
			id="top"
			className="
				relative
				isolate
				grid
				min-h-svh
				overflow-hidden
			"
		>
			<Emulsion />

			<div className="
				pointer-events-none
				grid
				grid-rows-[auto_1fr_auto]
				gap-y-sec-s
				px-edge
				pt-[clamp(5.5rem,9vw,8rem)]
				pb-[clamp(1.25rem,2.4vw,2.5rem)]
			">
				<div
					data-rise
					className="
						flex
						justify-between
						gap-gutter
					"
				>
					<p className="type-label">
						[ {CLUB.coordinates} ]
						<br />
						{CLUB.place}
					</p>
					<p className="
						type-label
						text-right
					">
						Cosmetic science club
						<br />
						Formulated by students
					</p>
				</div>

				<div className="
					relative
					self-center
				">
					{/* The size is set so the written word spans the page: it is
					    3.5 em wide at its own size, which is 1.5 times the
					    heading's. The second limit is the height, so both lines
					    always fit in the window. */}
					<h1
						aria-label={CLUB.name}
						className="
							lp-wordmark
							text-[length:min(calc((100vw-var(--spacing-edge)*2)/5.36),25svh)]
						"
					>
						<span
							aria-hidden="true"
							data-line
							className="
								type-script
								relative
								z-10
								block
								text-[1.5em]
								leading-[0.82]
								whitespace-nowrap
							"
						>
							<span className="
								lp-ch
								inline-block
								will-change-transform
							">
								elemental
							</span>
							<i className="lp-baseline" />
						</span>
						<span
							aria-hidden="true"
							data-line
							className="
								type-soft
								-mt-[0.34em]
								block
								text-right
								text-[1.2em]
								leading-[0.82]
								whitespace-nowrap
								text-salmon-med
							"
						>
							{letters('beauty')}
							<i className="lp-baseline" />
						</span>
					</h1>

					<p
						data-rise
						className="
							type-serif
							mt-sec-s
							max-w-[19ch]
							text-h5
							lg:absolute
							lg:bottom-[min(1.5vw,3.4svh)]
							lg:left-0
							lg:mt-0
							lg:max-w-[21ch]
						"
					>
						{HERO.tagline[0]}
						<em className="text-salmon-med">{HERO.tagline[1]}</em>
						{HERO.tagline[2]}
					</p>
				</div>

				<div
					data-rise
					className="
						flex
						flex-wrap
						items-end
						justify-between
						gap-gutter
					"
				>
					<p className="
						type-label
						max-w-[44ch]
						opacity-75
					">
						{HERO.ingredients}
					</p>

					<span className="
						type-label
						hidden
						items-center
						gap-[0.8em]
						lg:inline-flex
					">
						scroll
						<i className="
							lp-drip
							size-2
							bg-salmon-med
						" />
					</span>

					<Link
						href="/login"
						data-cursor="join"
						className="
							glass
							group
							pointer-events-auto
							relative
							inline-flex
							items-center
							gap-[0.7em]
							rounded-full
							py-[0.95em]
							pr-[0.6em]
							pl-[1.5em]
							text-small
							leading-none
							font-semibold
							whitespace-nowrap
							transition-transform
							duration-500
							ease-spring
							hover:-translate-y-1
							hover:scale-105
							active:scale-95
						"
					>
						{HERO.cta}
						<Arrow />
					</Link>
				</div>
			</div>
		</section>
	)
}

// The arrow in its own droplet, which rolls over when the pill is hovered.
// Used by every call-to-action on the page; the pill carries `group`.
export function Arrow({ className = 'bg-yellow text-ink' }) {
	return (
		<span
			aria-hidden="true"
			className={`
				grid
				size-[2.2em]
				place-items-center
				rounded-full
				transition-transform
				duration-600
				ease-mech
				group-hover:-rotate-45
				${className}
			`}
		>
			<svg
				viewBox="0 0 16 16"
				className="size-[1em]"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.8"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<path d="M3 8h10M9 4l4 4-4 4" />
			</svg>
		</span>
	)
}
