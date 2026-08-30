'use client'

import { useState } from 'react'

import FoldText from '@/components/FoldText'

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

// The panel's size, written once and worn by all three boxes that make up the
// opening — the frame that holds the space, the clipper that grows, and the
// panel itself. They have to agree exactly or the reveal ends somewhere other
// than the panel's own edge.
//
// It is what the cards add up to at rest: across, 430 + 398 less the 20px
// overlap, plus the 40px padding either side; down, the big card's 32 + 560
// plus the 35px below it. Resize a card and this is the line to redo.
const PANEL = `
	h-[627px]
	w-[888px]
`

// Both headings unfold on load, character by character, hinged along the top
// edge. Shared so the caption and the logotype arrive the same way — two sets
// of numbers drifting apart would read as a mistake rather than as a sequence.
//
// `creaseShading` is 0 deliberately. The crease is a gradient laid over each
// character while it is edge-on, blended with `multiply` — against a dark
// ground it reads as shadow caught in a fold, but against this cream page it
// multiplies out to a dusty pink block sitting behind the letters. Nothing is
// wrong with the effect; it is built for a background this page doesn't have.
const UNFOLD = {
	splitBy: 'char',
	hinge: 'top',
	trigger: 'mount',
	duration: 0.65,
	stagger: 0.045,
	ease: 'power3.out',
	perspective: 700,
	creaseShading: 0
}

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
					<FoldText text="PRESENTING..." {...UNFOLD} />
				</p>

				{/* The logotype keeps every one of its type classes — FoldText is
				    handed no size, weight or colour, so it inherits all three and
				    animates the heading rather than restyling it. */}
				<h1 className="
					font-reasons
					mt-[14px]
					text-[44px]
					leading-none
					tracking-[0.01em]
					text-[#1F4A14]
				">
					<FoldText text="ELEMENTAL BEAUTY" {...UNFOLD} />
				</h1>

				{/* Three boxes of the same size, and each one earns its place.

				    frame    holds the space in the column. Never animates, so the
				             title above it cannot be shoved around by the opening.
				    clipper  the only thing that moves: grows from nothing at the
				             centre out to full size, hiding whatever it doesn't
				             cover yet.
				    section  the panel itself, at full size from the very first
				             frame and centred on the clipper's centre — which never
				             moves — so nothing inside it is ever laid out twice.

				    Contents stay frozen because the panel is never the thing being
				    resized. Give the section the animation directly and it is a flex
				    row being relaid on every frame, and the two cards slide and
				    resize the whole way in. */}
				<div className={`
					relative
					mt-[37px]
					${PANEL}
				`}>
					<div className={`
						panel-open
						absolute
						top-1/2
						left-1/2
						-translate-x-1/2
						-translate-y-1/2
						overflow-hidden
						rounded-[32px]
						${PANEL}
					`}>
						<section className={`
							absolute
							top-1/2
							left-1/2
							flex
							-translate-x-1/2
							-translate-y-1/2
							items-center
							justify-center
							rounded-[32px]
							bg-[#FDF4E0]
							px-10
							pb-[35px]
							shadow-[inset_0_0_17px_rgba(0,0,0,0.73)]
							${PANEL}
						`}>
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
				</div>
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
				bamboo-open
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
				bamboo-open
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

			<p className={`${LABEL} mt-[21px]`}>Verify Password</p>
			<input
				type="password"
				name="new-password"
				autoComplete="new-password"
				className={`${FIELD} mt-[8px] bg-[#FFCC6E]`}
			/>
			<p className={`${HINT} mt-[10px]`}>must be the same password</p>

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
