'use client'

import { useState } from 'react'

// The /login screen.
//
// One frame, three layers:
//
//   1. the bamboo, split down the middle and pinned to both edges
//   2. the cream page it sits on, carrying the title
//   3. the panel — a cream slab with an inner shadow — holding the two cards
//
// The two cards are deliberately not the same size. Log in is the taller of
// the pair and sits in front of sign up, casting a shadow sideways onto it, so
// the page has an obvious primary action without needing a tab or a toggle.
//
// Every measurement here is a fixed pixel value taken off the comp rather than
// a scale step, because the comp is a drawing before it is a layout — the pair
// of cards sits deliberately left of the panel's centre, and the log-in card is
// deliberately a little taller than its neighbour. Rounding any of that to the
// nearest even number is what would make it look like a different page.
//
// The block is drawn at one size and centred in the window by the flex parent.
// Nothing anywhere records how big it is, so the cards can be resized freely
// without putting it off centre. What that costs is a window narrower than the
// drawing: there is no scale-to-fit, so the edges go under the bamboo and are
// clipped rather than shrinking. A phone-shaped layout is a different drawing
// and would need its own composition.

const LABEL = `
	font-beachday
	text-[17px]
	leading-none
	tracking-[0.065em]
	text-[#137A1B]
`

const FIELD = `
	font-vietnam
	h-[26px]
	w-full
	rounded-[7px]
	px-[9px]
	text-[13px]
	text-black
	outline-none
`

const HINT = `
	font-vietnam
	text-[12px]
	leading-none
	text-[#2B2B2B]
`

// ---- the two roles ---------------------------------------------------------
//
// Clicking a card hands it the larger shape and the shadow; its neighbour takes
// the smaller shape and drops the shadow. Only presence changes hands. Each
// card keeps its side of the panel, its colour, its corners and its padding, so
// the swap reads as one card coming forward rather than as the pair trading
// places.
//
// The margins swap with the sizes, and that is not cosmetic: it keeps each
// card's outer height — the margin box the panel measures — at 592 in the big
// role and 567 in the small one either way round. Swap only the heights and the
// taller of the two changes mid-move, which walks the panel up and down.

const BIG = `
	z-10
	mt-[32px]
	h-[560px]
	w-[430px]
`

const SMALL = `
	z-0
	mt-[36px]
	h-[531px]
	w-[398px]
	cursor-pointer
`

// The "off" shadow is the same shadow with its offset and alpha at zero rather
// than `shadow-none`. Two shadows of the same shape interpolate; a shadow and
// no shadow at all is a swap the browser can only do abruptly.
const NO_SHADOW = 'shadow-[0px_0px_0px_rgba(0,0,0,0)]'

const SWAP = `
	transition-[width,height,margin-top,box-shadow]
	duration-500
	ease-[cubic-bezier(0.22,1,0.36,1)]
`

export default function AuthPanels() {
	const [front, setFront] = useState('login')

	return (
		<main className="
			relative
			flex
			min-h-svh
			w-full
			items-center
			justify-center
			overflow-hidden
			bg-[#FDF4E0]
		">
			<Bamboo />

			{/* Centred by the flex parent, not by a transform against a size of its
			    own. The block carries no width, height or offsets — it is as big as
			    what's inside it and no bigger — so resizing the cards moves nothing
			    off centre and there is no measurement anywhere to keep in sync. */}
			<div className="
				relative
				z-10
				flex
				flex-col
				items-center
			">
				{/* the tracking is the point — Aalto is a condensed face, and the
				    comp opens it up far enough that the word reads as a caption
				    rather than as a heading competing with the logotype */}
				<p className="
					font-aalto
					pl-[2px]
					text-[20px]
					leading-none
					tracking-[0.155em]
					text-black
					[-webkit-text-stroke:0.5px_black]
				">
					PRESENTING...
				</p>

				<h1 className="
					font-reasons
					mt-[14px]
					text-[44px]
					leading-none
					tracking-[0.01em]
					text-[#1F4A14]
				">
					ELEMENTAL BEAUTY
				</h1>

				{/* Pinned, not measured. Left to size itself off the cards, the panel
				    would breathe through every swap: both cards are mid-size halfway
				    through the move, so the taller of the two dips ~13px and comes
				    back, and the inner shadow visibly walks with it.

				    888 x 627 is what the cards add up to at rest — across, 430 + 398
				    less the 20px overlap, plus the 40px padding either side; down, the
				    big card's 32 + 560 plus the 35px below it. Resize a card and these
				    two numbers are what to redo. */}
				<section className="
					mt-[37px]
					flex
					h-[627px]
					w-[888px]
					items-center
					justify-center
					rounded-[32px]
					bg-[#FDF4E0]
					px-10
					pb-[35px]
					shadow-[inset_0_0_17px_rgba(0,0,0,0.73)]
				">
					<LogIn
						front={front === 'login'}
						onCome={() => setFront('login')}
					/>
					<SignUp
						front={front === 'signup'}
						onCome={() => setFront('signup')}
					/>
				</section>
			</div>
		</main>
	)
}

// Both halves are the same file. Each side holds a box twice its own width and
// clips it, so `object-cover` — which crops evenly from both edges — always
// leaves the seam on the centre stalk no matter how the window is shaped. The
// left edge shows everything to the left of that stalk, the right edge
// everything to the right, and the page reads as one grove interrupted.
function Bamboo() {
	return (
		<div aria-hidden="true">
			<div className="
				pointer-events-none
				absolute
				inset-y-0
				left-0
				w-[14vw]
				overflow-hidden
				md:w-[20vw]
			">
				<img
					src="/bamboo.png"
					alt=""
					className="
						absolute
						left-0
						h-full
						w-[190%]
						max-w-none
						object-cover
					"
				/>
			</div>

			<div className="
				pointer-events-none
				absolute
				inset-y-0
				right-0
				w-[14vw]
				overflow-hidden
				md:w-[20vw]
			">
				<img
					src="/bamboo.png"
					alt=""
					className="
						absolute
						right-0
						h-full
						w-[205%]
						max-w-none
						object-cover
					"
				/>
			</div>
		</div>
	)
}

// In front of the sign-up card, so its shadow falls across it. The square
// bottom-right corner is what makes the overlap read as one card laid over
// another rather than two cards that happen to touch.
function LogIn({ front, onCome }) {
	return (
		<div
			onClick={onCome}
			onFocus={onCome}
			className={`
				relative
				shrink-0
				rounded-[30px]
				rounded-br-none
				rounded-tr-none
				bg-[#FFCC6E]
				py-[50px]
				px-[50px]
				${front ? BIG : SMALL}
				${front ? 'shadow-[7px_0_6px_rgba(0,0,0,0.50)]' : NO_SHADOW}
				${SWAP}
			`}
		>
			<h2 className="
				font-canobis
				pl-[2px]
				text-center
				text-[35px]
				leading-none
				tracking-[0.05em]
				text-black
				[-webkit-text-stroke:1px_black]
			">
				LOG IN
			</h2>

			<p className={`${LABEL} mt-[33px]`}>USERNAME</p>
			<input
				type="text"
				name="username"
				autoComplete="username"
				className={`${FIELD} mt-[9px] bg-[#FFE9BF]`}
			/>

			<p className={`${LABEL} mt-[29px]`}>PASSWORD</p>
			<input
				type="password"
				name="password"
				autoComplete="current-password"
				className={`${FIELD} mt-[9px] bg-[#FFE9BF]`}
			/>

			<a
				href="/reset-password"
				className="
					font-vietnam
					mt-[9px]
					inline-block
					text-[13px]
					leading-none
					text-[#4066FF]
				"
			>
				forgot password?
			</a>

			<div className="
				mt-[13px]
				flex
				justify-center
			">
				<Button className="w-[142px]">ENTER</Button>
			</div>
		</div>
	)
}

// Pulled left so its own edge runs under the log-in card — the gap you see
// between them is that card's shadow, not background.
function SignUp({ front, onCome }) {
	return (
		<div
			onClick={onCome}
			onFocus={onCome}
			className={`
				relative
				-ml-[20px]
				shrink-0
				rounded-[30px]
				rounded-bl-none
				rounded-tl-none
				bg-[#FFE9BF]
				py-[50px]
				px-[50px]
				${front ? BIG : SMALL}
				${front ? 'shadow-[-7px_0_6px_rgba(0,0,0,0.50)]' : NO_SHADOW}
				${SWAP}
			`}
		>
			<h2 className="
				font-canobis
				text-center
				text-[35px]
				leading-none
				text-black
				[-webkit-text-stroke:1px_black]
			">
				SIGN UP
			</h2>

			<p className={`${LABEL} mt-[35px]`}>PURDUE USERNAME</p>
			<input
				type="text"
				name="purdue-username"
				autoComplete="username"
				className={`${FIELD} mt-[9px] bg-[#FFCC6E]`}
			/>
			<p className={`${HINT} mt-[10px]`}>without the &apos;@purdue.edu&apos;</p>

			<p className={`${LABEL} mt-[21px]`}>PASSWORD</p>
			<input
				type="password"
				name="new-password"
				autoComplete="new-password"
				className={`${FIELD} mt-[8px] bg-[#FFCC6E]`}
			/>
			<p className={`${HINT} mt-[8px]`}>must be 8 characters</p>

			<p className={`${LABEL} mt-[23px]`}>INSTA USERNAME (OPTIONAL)</p>
			<input
				type="text"
				name="instagram"
				className={`${FIELD} mt-[8px] bg-[#FFCC6E]`}
			/>

			<div className="
				mt-[24px]
				flex
				justify-center
			">
				<Button className="w-[137px]">CONTINUE</Button>
			</div>
		</div>
	)
}

// Held down, the pill drops onto the page: the shadow goes out and the button
// travels exactly the 4px across and 4px down that the shadow was offset by, so
// it lands in its own shadow's place rather than sliding to an arbitrary spot.
// That equality is the whole effect — the gap between the two closes to nothing
// and the button reads as having been pressed flat instead of nudged.
//
// `active:` rather than a click handler: it holds while the mouse is down and
// releases on its own, and the keyboard gets it for free.
function Button({ className = '', children }) {
	return (
		<button
			type="button"
			className={`
				font-dream
				flex
				h-[37px]
				items-center
				justify-center
				rounded-full
				bg-[#4066FF]
				text-[23px]
				leading-none
				text-white
				shadow-[4px_4px_3px_rgba(0,0,0,0.5)]
				transition-[translate,box-shadow]
				duration-150
				ease-out
				active:translate-x-[4px]
				active:translate-y-[4px]
				active:shadow-[0px_0px_0px_rgba(0,0,0,0)]
				${className}
			`}
		>
			{/* `items-center` centres the line box, not the letters. Dream Kudos
			    declares an ascent of 14 and a descent of 8 against an em of 18,
			    and this label is all caps — so the ink stops at the baseline and
			    the eight units of unused descender sit under it, hanging the word
			    3.3px above the middle of a 37px pill.

			    The correction is (cap ascent - (ascent - descent)) / 2, which the
			    face's own metrics fix at 0.185em. Written in em rather than px
			    because it falls out of the font, not out of this button — change
			    the type size and it still lands. */}
			<span className="translate-y-[0.185em]">{children}</span>
		</button>
	)
}
