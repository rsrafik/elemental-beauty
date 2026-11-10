import Link from 'next/link'
import { Arrow } from './Hero'
import { CLUB, SPONSORS } from './content'

// The last two parts of the page: who backs the club, and the footer.

// Sponsors, as two bands running opposite ways. Each band is its list twice
// over, sliding left by exactly one list's width and starting again, so the
// loop has no seam; the second copy is hidden from screen readers. A band
// holds still under the pointer (app/landing.css).
//
// PLACEHOLDER names: see content.js.
export function Sponsors() {
	return (
		<section
			id="sponsors"
			className="
				relative
				bg-cream
				pt-sec-l
				pb-[calc(var(--spacing-sec-l)+var(--radius-quarter))]
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
						type-serif
						col-span-full
						text-h0
						italic
						lg:col-span-5
						lg:col-start-2
						lg:text-[length:clamp(3.5rem,7.6vw,8.5rem)]
					"
				>
					{/* three words, and the middle one is the solid one */}
					kept <span className="type-wide not-italic">stable</span> by
				</h2>
				<p
					data-rise
					className="
						type-serif
						col-span-full
						max-w-[22ch]
						text-h4
						lg:col-span-3
						lg:col-start-2
					"
				>
					{SPONSORS.intro}
				</p>
			</div>

			<div className="
				mt-sec-m
				flex
				flex-col
				gap-gutter
			">
				{SPONSORS.rows.map((row, at) => (
					<div
						key={at}
						className="
							lp-band
							flex
							overflow-hidden
						"
					>
						{[0, 1].map((copy) => (
							<ul
								key={copy}
								aria-hidden={copy === 1}
								className={`
									lp-band-run
									flex
									flex-none
									items-center
									gap-gutter
									pr-gutter
									${at % 2 ? 'lp-band-back' : ''}
								`}
							>
								{row.map((sponsor, index) => (
									<li
										key={index}
										className={`
											flex
											h-[clamp(4.5rem,9vw,8rem)]
											flex-none
											items-center
											gap-[0.6em]
											rounded-full
											border
											border-ink/15
											px-[clamp(1.75rem,4vw,4rem)]
											transition-[background-color,transform]
											duration-500
											ease-spring
											hover:scale-104
											hover:bg-yellow
											${(index + at) % 3 === 0 ? 'bg-salmon-lightest' : 'bg-white/60'}
										`}
									>
										{sponsor.logo ? (
											// eslint-disable-next-line @next/next/no-img-element
											<img
												src={sponsor.logo}
												alt={sponsor.name}
												className="
													h-[45%]
													w-auto
												"
											/>
										) : (
											<span className="
												type-serif
												text-h3
												whitespace-nowrap
												italic
											">
												{sponsor.name}
											</span>
										)}
									</li>
								))}
							</ul>
						))}
					</div>
				))}
			</div>

			<div
				data-rise
				className="
					mt-sec-m
					flex
					flex-wrap
					items-center
					gap-gutter
					px-edge
				"
			>
				<a
					href={`mailto:${CLUB.email}?subject=Sponsoring%20Elemental%20Beauty`}
					data-cursor="email"
					className="
						group
						inline-flex
						items-center
						gap-[0.7em]
						rounded-full
						bg-ink
						py-[0.95em]
						pr-[0.6em]
						pl-[1.5em]
						text-small
						leading-none
						font-semibold
						text-cream
						shadow-soft
						transition-transform
						duration-500
						ease-spring
						hover:-translate-y-1
						hover:scale-105
						active:scale-95
					"
				>
					{SPONSORS.cta}
					<Arrow />
				</a>
				<p className="
					type-label
					opacity-60
				">
					{CLUB.email}
				</p>
			</div>
		</section>
	)
}

// The footer: a line about who made this, the links, and the small print.
export function Footer() {
	const links = [
		['Instagram', CLUB.instagram],
		['Discord', CLUB.discord],
		['Email', `mailto:${CLUB.email}`],
	]

	return (
		<footer className="
			relative
			z-20
			-mt-[var(--radius-quarter)]
			overflow-clip
			rounded-tr-quarter
			bg-ink
			pt-sec-m
			text-cream
		">
			<div className="
				grid
				grid-cols-4
				gap-x-gutter
				gap-y-sec-s
				px-edge
				lg:grid-cols-6
			">
				<p className="
					type-serif
					col-span-full
					max-w-[18ch]
					text-h4
					lg:col-span-3
				">
					Made by students, at one bench, in <em className="text-salmon">West Lafayette</em>.
				</p>

				<ul className="
					type-label
					col-span-2
					flex
					flex-col
					gap-[0.5em]
					lg:col-span-1
					lg:col-start-5
				">
					{links.map(([name, href]) => (
						<li key={name}>
							<a
								href={href}
								target={href.startsWith('http') ? '_blank' : undefined}
								rel={href.startsWith('http') ? 'noreferrer' : undefined}
								className="lp-underline"
							>
								{name}
							</a>
						</li>
					))}
				</ul>
				<ul className="
					type-label
					col-span-2
					flex
					flex-col
					gap-[0.5em]
					lg:col-span-1
				">
					<li>
						<Link href="/login" className="lp-underline">Sign in</Link>
					</li>
					<li>
						<Link href="/privacy" className="lp-underline">Privacy</Link>
					</li>
					<li>
						{/* Motion.js glides every in-page link, this one included */}
						<a href="#top" className="lp-underline">Back to top</a>
					</li>
				</ul>
			</div>

			<div className="
				type-label
				mt-sec-m
				flex
				flex-wrap
				justify-between
				gap-x-gutter
				gap-y-1
				px-edge
				pb-sec-s
				opacity-60
			">
				<span>© {new Date().getFullYear()} {CLUB.name}</span>
				<span>[ {CLUB.coordinates} ]</span>
				<span>{CLUB.place}</span>
			</div>
		</footer>
	)
}
