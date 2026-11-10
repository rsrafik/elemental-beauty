import { Bodoni_Moda, DM_Mono, MuseoModerno, Pinyon_Script, Syne } from 'next/font/google'
import localFont from 'next/font/local'

// The typefaces only the landing page uses. They are declared here and not in
// app/layout.js so that the dashboards and the sign-in pages never preload
// them — next/font preloads a face on the routes whose modules ask for it.
//
// Seven faces, each with one job:
//
//   Bodoni Moda     the header face, and the serif for sentences: thin
//                   hairlines against heavy stems, the look of a beauty
//                   masthead. A variable face, so one file covers the huge
//                   headline and the paragraph under it.
//   Pinyon Script   the calligraphy: "elemental" in the hero, and the one
//                   word in a headline that is written rather than set.
//   MuseoModerno    the soft one: "beauty" in the hero. A rounded geometric
//                   face whose strokes bend into each other instead of
//                   meeting at corners, so it reads as modern but sits
//                   easily under the calligraphy.
//   Syne            the wide one: extra-bold capitals, for anything that
//                   should feel stamped (the swatch names).
//   DM Mono         the label: coordinates, phase names, small print.
//   Fourhand        the hand: an album card's event name, on the strip and
//                   as the title of the card that is out.
//   Essays 1743     the old book face: the date and the lines about an event
//                   on the card that is out.
//
// The body text stays Be Vietnam Pro and the margin notes stay Delicious
// Handrawn, both from the app's own layout.

export const bodoni = Bodoni_Moda({
	variable: '--font-bodoni',
	subsets: ['latin'],
	style: ['normal', 'italic'],
})

export const pinyon = Pinyon_Script({
	variable: '--font-pinyon',
	subsets: ['latin'],
	weight: '400',
})

export const museo = MuseoModerno({
	variable: '--font-museo',
	subsets: ['latin'],
})

export const syne = Syne({
	variable: '--font-syne',
	subsets: ['latin'],
	weight: '800',
})

export const dmMono = DM_Mono({
	variable: '--font-dmmono',
	subsets: ['latin'],
	weight: ['300', '400', '500'],
})

// PLACEHOLDER licence: this is the trial file of Fourhand. Swap in the
// licensed one before the page goes live.
export const fourhand = localFont({
	src: '../../app/fonts/fourHand_TRIAL.woff2',
	variable: '--font-fourhand',
})

export const essays = localFont({
	src: [
		{ path: '../../app/fonts/Essays1743.woff2', weight: '400', style: 'normal' },
		{ path: '../../app/fonts/Essays1743-Italic.woff2', weight: '400', style: 'italic' },
		{ path: '../../app/fonts/Essays1743-Bold.woff2', weight: '700', style: 'normal' },
		{ path: '../../app/fonts/Essays1743-BoldItalic.woff2', weight: '700', style: 'italic' },
	],
	variable: '--font-essays',
})
