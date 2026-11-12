import { bodoni, dmMono, essays, fourhand, museo, pinyon, syne } from './fonts'
import Album from './Album'
import { Footer, Sponsors } from './Closing'
import Cursor from './Cursor'
import Hero from './Hero'
import Motion from './Motion'
import Nav from './Nav'
import What from './What'
import Who from './Who'

// The public landing page.
//
// The idea is the emulsion — the one act all of cosmetic chemistry turns on,
// getting oil and water to hold together — and the page is laid out like a
// formula sheet: its sections are phases, its small print is written like the
// back of a bottle.
//
// It is plain markup first. Every section renders on the server with all of
// its content, and the two things layered on top each load on their own and
// can each be absent: the page's motion (Motion.js) and the hero's liquid
// (Emulsion.js). Copy and placeholders live in content.js.
//
// `landing` on the outermost element is what app/landing.css scopes itself to,
// and the font classes beside it are what make this page's typefaces mean
// something — they are loaded by this page alone (fonts.js).

export default function Landing() {
	return (
		<div
			className={`
				landing
				${bodoni.variable}
				${pinyon.variable}
				${museo.variable}
				${syne.variable}
				${dmMono.variable}
				${fourhand.variable}
				${essays.variable}
				relative
				overflow-x-clip
				bg-cream
				font-vietnam
				text-body
				leading-[1.45]
				text-ink
			`}
		>
			<Preloader />
			<Nav />

			<main>
				<Hero />
				<Who />
				<What />
				<Album />
				<Sponsors />
			</main>
			<Footer />

			<Cursor />
			<Motion />
		</div>
	)
}

// Covers the page while the fonts arrive. Motion.js counts it up and wipes it
// away; app/landing.css removes it on a timer if that script never runs.
function Preloader() {
	return (
		<div
			aria-hidden="true"
			className="
				lp-preloader
				fixed
				inset-0
				z-90
				grid
				grid-rows-[1fr_auto]
				bg-ink
				p-edge
				text-cream
			"
		>
			<div className="
				lp-preloader-fill
				absolute
				inset-0
				bg-salmon
			" />
			<p className="
				type-serif
				relative
				self-end
				text-[clamp(6rem,24vw,22rem)]
				leading-[0.8]
				italic
				tabular-nums
				mix-blend-difference
			">
				<span data-count>00</span>
				<span className="text-[0.4em]">%</span>
			</p>
			<div className="
				type-label
				relative
				flex
				justify-between
				gap-4
				pt-6
				mix-blend-difference
			">
				<span>Elemental Beauty</span>
				<span>emulsifying</span>
			</div>
		</div>
	)
}
