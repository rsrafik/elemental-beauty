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

export default function AuthPanels() {
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

				<section className="
					mt-[37px]
					flex
					items-center
					justify-center
					rounded-[32px]
					bg-[#FDF4E0]
					px-10
					pb-[35px]
					shadow-[inset_0_0_17px_rgba(0,0,0,0.73)]
				">
					<LogIn />
					<SignUp />
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
function LogIn() {
	return (
		<div className="
			relative
			z-10
			mt-[32px]
			h-[560px]
			w-[430px]
			shrink-0
			rounded-[30px]
			rounded-br-none
			rounded-tr-none
			bg-[#FFCC6E]
			py-[50px]
			px-[50px]
			shadow-[7px_0_6px_rgba(0,0,0,0.50)]
		">
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
function SignUp() {
	return (
		<div className="
			relative
			-ml-[20px]
			mt-[36px]
			h-[531px]
			w-[398px]
			shrink-0
			rounded-[30px]
			bg-[#FFE9BF]
			py-[50px]
			px-[50px]
		">
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
