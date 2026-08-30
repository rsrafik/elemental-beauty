'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import FoldText from '@/components/FoldText'
import { useDismiss } from '@/lib/dismiss'

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

	// Which flow opened the code dialog, or null for closed. Both flows show the
	// same code step; the mode is what decides where verifying takes you.
	const [verifying, setVerifying] = useState(null)

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
								onForgot={() => setVerifying('reset')}
							/>
							<SignUp
								front={front === 'signup'}
								onCome={() => setFront('signup')}
								onContinue={() => setVerifying('signup')}
							/>
						</section>
					</div>
				</div>
			</div>

			{verifying && (
				<VerifyDialog
					mode={verifying}
					onClose={() => setVerifying(null)}
				/>
			)}
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
function LogIn({ front, onCome, onForgot }) {
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

			{/* A button, not the link to /reset-password it used to be: this opens
			    a dialog rather than going anywhere, and a link that navigates
			    nowhere is a link a keyboard or a middle click both get wrong. */}
			<button
				type="button"
				onClick={onForgot}
				className="
					font-vietnam
					mt-[9px]
					block
					cursor-pointer
					text-[13px]
					leading-none
					text-[#4066FF]
				"
			>
				forgot password?
			</button>

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
function SignUp({ front, onCome, onContinue }) {
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
				<Button className="w-[137px]" onClick={onContinue}>CONTINUE</Button>
			</div>
		</div>
	)
}

// ---- the code dialog --------------------------------------------------------
//
// One dialog, two flows, told apart by `mode`:
//
//   reset    forgot password. The code proves it's you, then a second page
//            takes the new one, and creating it closes the dialog.
//   signup   the code is the last thing between you and an account, so
//            verifying goes to the dashboard and there is no second page.
//
// Shared rather than written twice because it is the same step — the same
// heading, the same five boxes, the same resend. Two copies would be two things
// to keep in step every time one of them changed.
//
// The card is a fixed size and both pages are drawn to fit it, so moving from
// the code to the new password swaps what is inside without the box changing
// shape underneath. It reads as one thing with two pages, not as two dialogs.
//
// The page's content is keyed on the step, which remounts it and so restarts
// the fade. Without the key React would reuse the same nodes, the animation
// would already have played, and the second page would appear instantly.
//
// `useDismiss` is what lets it animate on the way out: React would otherwise
// drop the dialog the instant the state went null, leaving the exit nowhere to
// happen. Everything that ends this — verify on signup, create, the X, the
// backdrop, Escape — goes through `dismiss`.

const RESET_LABEL = `
	font-beachday
	text-[21px]
	leading-none
	text-black
`

const RESET_FIELD = `
	font-vietnam
	mt-[4px]
	h-[31px]
	w-full
	rounded-[9px]
	bg-[#FFCC6E]
	px-[12px]
	text-[13px]
	text-black
	outline-none
`

function VerifyDialog({ mode, onClose }) {
	const { closing, dismiss } = useDismiss()
	const [step, setStep] = useState('code')
	const router = useRouter()
	const close = () => dismiss(onClose)

	// The code step is the same in both flows; what differs is where verifying
	// lands you. Signing up, the code was the last thing standing between you
	// and an account, so it goes to the dashboard — through `dismiss`, so the
	// dialog plays its exit and the page changes under a screen that is already
	// on its way out rather than one that vanishes mid-animation. Resetting, the
	// code only proves it's you; the new password is still to come.
	const onVerify = mode === 'signup'
		? () => dismiss(() => router.push('/dashboard'))
		: () => setStep('password')

	useEffect(() => {
		const onKey = event => {
			if (event.key === 'Escape') close()
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	})

	return (
		<div
			onClick={close}
			className={`
				fixed
				inset-0
				z-[60]
				flex
				items-center
				justify-center
				bg-black/20
				p-4
				${closing ? 'dialog-leaving' : 'dialog-open'}
			`}
		>
			<div
				onClick={event => event.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-label={mode === 'signup' ? 'Verify email' : 'Reset password'}
				className="
					relative
					flex
					h-[260px]
					w-[431px]
					max-w-full
					flex-col
					justify-center
					rounded-[26px]
					bg-[#FFF6E3]
					px-[50px]
					shadow-[0_10px_40px_rgba(0,0,0,0.35)]
				"
			>
				{/* Absolute so it sits in the corner without joining the column —
				    in the flow it would be a third row for `justify-center` to
				    balance, and both steps would ride lower to make room for it. */}
				<button
					type="button"
					onClick={close}
					aria-label="Close"
					className="
						absolute
						top-[14px]
						right-[16px]
						flex
						h-[26px]
						w-[26px]
						cursor-pointer
						items-center
						justify-center
						rounded-full
						text-black/45
						transition-colors
						duration-150
						hover:text-black
					"
				>
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="3"
						strokeLinecap="round"
						aria-hidden="true"
						className="h-[13px] w-[13px]"
					>
						<line x1="4" y1="4" x2="20" y2="20" />
						<line x1="20" y1="4" x2="4" y2="20" />
					</svg>
				</button>

				<div className="page-enter" key={step}>
					{step === 'code'
						? <CodeStep onVerify={onVerify} />
						: <PasswordStep onCreate={close} />}
				</div>
			</div>
		</div>
	)
}

function CodeStep({ onVerify }) {
	// One ref per box so a typed digit can hand focus to the next one. A
	// five-box code that makes you click each box in turn is the kind of thing
	// nobody reports and everybody resents.
	const boxes = useRef([])

	const onKeyDown = (event, index) => {
		if (event.key !== 'Backspace' || event.target.value) return
		boxes.current[index - 1]?.focus()
	}

	const onInput = (event, index) => {
		if (event.target.value) boxes.current[index + 1]?.focus()
	}

	return (
		<>
			<div className="
				flex
				items-center
				justify-center
				gap-[14px]
			">
				<h2 className={RESET_LABEL}>TYPE CODE SENT TO EMAIL</h2>
				<button
					type="button"
					className="
						font-aalto
						h-[23px]
						shrink-0
						cursor-pointer
						rounded-full
						bg-[#FF8A78]
						px-[11px]
						text-[22px]
						leading-none
						text-[#B3402E]
					"
				>
					RESEND
				</button>
			</div>

			<div className="
				mt-[25px]
				flex
				justify-center
				gap-[14px]
			">
				{[0, 1, 2, 3, 4].map(index => (
					<input
						key={index}
						ref={node => { boxes.current[index] = node }}
						type="text"
						inputMode="numeric"
						maxLength={1}
						aria-label={`Digit ${index + 1} of 5`}
						onInput={event => onInput(event, index)}
						onKeyDown={event => onKeyDown(event, index)}
						className="
							font-vietnam
							h-[55px]
							w-[55px]
							rounded-full
							bg-[#FFCC6E]
							text-center
							text-[20px]
							text-black
							outline-none
						"
					/>
				))}
			</div>

			<div className="
				mt-[32px]
				flex
				justify-center
			">
				<Button className="w-[146px]" onClick={onVerify}>VERIFY</Button>
			</div>
		</>
	)
}

function PasswordStep({ onCreate }) {
	return (
		<div className="px-[22px]">
			<p className={RESET_LABEL}>NEW PASSWORD</p>
			<input
				type="password"
				name="new-password"
				autoComplete="new-password"
				className={RESET_FIELD}
			/>

			<p className={`${RESET_LABEL} mt-[19px]`}>VERIFY NEW PASSWORD</p>
			<input
				type="password"
				name="verify-password"
				autoComplete="new-password"
				className={RESET_FIELD}
			/>

			<div className="
				mt-[16px]
				flex
				justify-center
			">
				<Button className="w-[146px]" onClick={onCreate}>CREATE</Button>
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
function Button({ className = '', onClick, children }) {
	return (
		<button
			type="button"
			onClick={onClick}
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
