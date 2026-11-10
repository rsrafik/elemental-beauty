import { WHAT } from './content'

// What we do, as four swatches.
//
// A swatch is how a formulator shows a product: one swipe of it across the
// page. Each thing the club does is a row with its name set very large, and
// behind the name a smear of pigment that is swiped in, left to right, when
// the row reaches the middle of the window or the pointer lands on it
// (app/landing.css does the swipe; Motion.js says which row is on).
//
// The rows are stepped: each one starts a little further in from the margin
// than the one above, so the four names run down the page like a staircase
// rather than a table. On a wide window a row is a twelve-column grid: the
// name has the first nine columns and the note the last three, so however far
// a name is stepped in, its note still ends at the page's edge.
//
// With no script every smear is simply there.

const ROWS = [
	{ smear: 'text-salmon', indent: '0vw' },
	{ smear: 'text-yellow', indent: '3vw' },
	{ smear: 'text-green', indent: '6vw' },
	{ smear: 'text-lilac', indent: '9vw' },
]

const ICONS = {
	// a flask
	labs: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3M7.5 15h9',
	// a calendar
	events: 'M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M8 3v4M16 3v4M8.5 14.5h3',
	// an open book
	learn: 'M12 6c-2-1.5-5-2-8-1.5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-13c-3-.5-6 0-8 1.5zM12 6v13',
	// a medal
	points: 'M8 3l4 7 4-7M12 10a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM12 13.5v4M10.5 14.5l1.5-1',
}

export default function What() {
	return (
		<section
			id="what"
			className="
				relative
				pt-sec-m
				pb-sec-l
			"
		>
			<div className="
				flex
				flex-wrap
				items-end
				justify-end
				gap-gutter
				px-edge
			">
				{/* the section's heading, for screen readers and the outline */}
				<h2 className="sr-only">{WHAT.title}</h2>
				<p
					data-rise
					className="
						type-serif
						max-w-[18ch]
						text-h4
						lg:text-right
					"
				>
					{WHAT.intro}
				</p>
			</div>

			<ol className="
				mt-sec-m
				border-t
				border-ink/15
			">
				{WHAT.tiles.map((tile, index) => (
					<li
						key={tile.key}
						data-swatch-row
						style={{ '--indent': ROWS[index].indent }}
						className="
							lp-swatch-row
							group
							relative
							flex
							flex-col
							gap-4
							border-b
							border-ink/15
							px-edge
							py-[clamp(1.5rem,3.2vw,3.25rem)]
							lg:grid
							lg:grid-cols-12
							lg:items-end
							lg:gap-gutter
						"
					>
						<div className="
							relative
							lg:col-span-9
							lg:ml-(--indent)
							lg:justify-self-start
						">
							{/* the swipe of product behind the name */}
							<Smear className={ROWS[index].smear} />

							<h3 className="
								lp-swatch-name
								type-wide
								relative
								text-[13.2vw]
								lg:text-[length:clamp(3.25rem,9.2vw,9.75rem)]
							">
								{tile.title}
							</h3>
						</div>

						<div className="
							lp-swatch-note
							relative
							flex
							max-w-[30ch]
							items-start
							gap-4
							lg:col-span-3
							lg:col-start-10
							lg:mb-[0.6em]
							lg:justify-self-end
							lg:flex-row-reverse
							lg:text-right
						">
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.4"
								strokeLinecap="round"
								strokeLinejoin="round"
								aria-hidden="true"
								className="
									lp-swatch-icon
									size-[clamp(2rem,3vw,2.75rem)]
									flex-none
								"
							>
								<path d={ICONS[tile.key]} />
							</svg>
							<p className="
								text-small
								font-medium
							">
								{tile.body}
							</p>
						</div>
					</li>
				))}
			</ol>
		</section>
	)
}

// One swipe of product: a fat start where the finger lands, an uneven body,
// and a dry, streaky end where it runs out. It stretches to whatever name it
// sits behind, and takes its colour from the text colour.
function Smear({ className = '' }) {
	return (
		<svg
			viewBox="0 0 600 200"
			preserveAspectRatio="none"
			aria-hidden="true"
			className={`
				lp-smear
				absolute
				-inset-x-[5%]
				top-[14%]
				h-[92%]
				w-[114%]
				${className}
			`}
		>
			<path
				fill="currentColor"
				d="M16 98C6 52 58 20 130 28c62-16 150 10 232-4 84-14 164 2 204 40 30 30 22 84-34 102-70 22-150 2-232 14-86 12-170 8-234-8-36-10-46-40-50-74Z"
			/>
			{/* where the product thins out: streaks of the page showing through */}
			<g
				fill="none"
				stroke="var(--color-cream)"
				strokeLinecap="round"
				opacity="0.55"
			>
				<path strokeWidth="3" d="M470 62c34-4 62 2 84 16" />
				<path strokeWidth="2" d="M440 150c40 4 76-2 104-16" />
				<path strokeWidth="2" d="M500 112c22-2 40 0 56 6" />
				<path strokeWidth="1.5" d="M60 60c30-12 70-16 110-10" />
			</g>
		</svg>
	)
}
