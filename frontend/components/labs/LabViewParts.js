'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useDismiss } from '@/lib/dismiss'
import { longDate, prettyTime } from '@/lib/dates'

// The pieces every stage of the member lab view is built from: the scaling
// frame, the header (meta line, title, description, photo), the big shadowed
// buttons, the back button and the popup shell. MemberLabSignup and
// MemberLabQuiz each lay these out their own way.

// ---- scaling ---------------------------------------------------------------
//
// The designs are drawn on a ~1410px-wide frame, where the content column
// (everything right of the sidebar) is DESIGN_W wide. Every size on these pages
// is written in those design pixels, and `Scaled` zooms the lot so the column
// always fills the same share of the window it does in the design — on a
// 1730px screen everything is ~1.3× bigger, not the same size with empty space
// round it.
//
// SHELL_W is what DashboardShell takes off the window before the column starts:
// 32px padding, the 327px sidebar, the 24px gap and 32px padding on the right.
// Only above `lg` — below it the sidebar is a bar on top and the page is the
// ordinary stacked layout at 1:1.
//
// SCALE takes a little off the whole thing: filling the column exactly the way
// the mockup does read as too big on screen. Everything shrinks together, and
// the space between the text and the photo is what takes up the difference.
const DESIGN_W = 995
const SHELL_W = 415
const SCALE = 0.85
const LG = 1024
const MIN_ZOOM = 0.8
const MAX_ZOOM = 1.6

function subscribe(onChange) {
	window.addEventListener('resize', onChange)
	return () => window.removeEventListener('resize', onChange)
}

export function useDesignZoom() {
	const width = useSyncExternalStore(
		subscribe,
		() => window.innerWidth,
		() => DESIGN_W + SHELL_W
	)
	if (width < LG) return 1
	return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, ((width - SHELL_W) / DESIGN_W) * SCALE))
}

// CSS `zoom` rather than a transform: it re-lays the content out at the new
// size, so text stays crisp and the scroll column scrolls the real height.
export function Scaled({ className = '', children }) {
	const zoom = useDesignZoom()
	return (
		<div className={className} style={{ zoom }}>
			{children}
		</div>
	)
}

// ---- header ----------------------------------------------------------------

// 'october 10, 2026 • 5:00PM • WTHR 200'. A lab with no time or no room just
// drops that part rather than printing an empty slot between two bullets.
export function metaLine(lab) {
	return [
		longDate(lab.date).toLowerCase(),
		prettyTime(lab.startTime).replace(' ', ''),
		lab.location,
	]
		.filter(Boolean)
		.join(' • ')
}

// Text on the left, the 303×210 photo on the right, tops aligned, the space
// between them taking up the slack. Whatever the stage needs under the
// description (the rsvp button, the QR button) comes in as children and sits
// in the text column. Below `lg` the photo goes on top.
export function LabIntro({ lab, children }) {
	return (
		<div className="
			flex
			flex-col-reverse
			lg:flex-row
			items-start
			justify-between
			gap-8
			lg:gap-10
		">
			<div className="
				w-full
				lg:flex-1
				min-w-0
				lg:max-w-[545px]
			">
				<p className="
					font-vietnam
					font-semibold
					text-[15px]
					leading-[22px]
					text-black
				">
					{metaLine(lab)}
				</p>
				<h1 className="
					font-beachday
					text-[40px]
					sm:text-[54px]
					leading-[1.05]
					text-salmon
					mt-[7px]
					break-words
				">
					{lab.title}
				</h1>
				{lab.description && (
					<p className="
						font-vietnam
						text-[15px]
						leading-[18px]
						text-black
						mt-5
						whitespace-pre-line
					">
						{lab.description}
					</p>
				)}
				{children}
			</div>

			<div className="
				w-full
				max-w-[303px]
				aspect-[303/210]
				lg:w-[303px]
				shrink-0
				overflow-hidden
				rounded-[10px]
				bg-salmon-lightest
			">
				{lab.image && (
					<img
						src={lab.image}
						alt=""
						className="
							w-full
							h-full
							object-cover
							select-none
						"
					/>
				)}
			</div>
		</div>
	)
}

// ---- buttons ---------------------------------------------------------------

// The chunky rsvp-style button: sign up (red), registered (green), waitlisted
// (yellow). Submit quiz is the green one with different words on it.
const TONES = {
	red: 'bg-[#FF181A] text-cream',
	green: 'bg-green text-[#295212]',
	yellow: 'bg-yellow-light text-[#8A7500]',
}

export function ChunkyButton({ tone, onClick, disabled = false, children }) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className={`
				min-w-[261px]
				h-[64px]
				px-4
				rounded-[5px]
				font-dream
				text-[30px]
				leading-none
				shadow-[-5px_5px_5px_rgba(0,0,0,0.5)]
				transition-[translate,box-shadow,opacity]
				duration-200
				ease-out
				select-none
				${disabled
					? 'opacity-60 cursor-not-allowed'
					: `
						cursor-pointer
						hover:-translate-y-0.5
						hover:shadow-[-6px_7px_7px_rgba(0,0,0,0.5)]
						active:translate-y-0
						active:shadow-[-2px_2px_3px_rgba(0,0,0,0.5)]
					`}
				${TONES[tone]}
			`}
		>
			{/* Dream Kudos keeps a deep descender zone (0.42em) that all-caps text
			    never uses, so centring its line box leaves the capitals 0.19em
			    high — measured off the font. This drops them back to the middle. */}
			<span className="
				block
				translate-y-[0.19em]
			">
				{children}
			</span>
		</button>
	)
}

// The grey line(s) under a chunky button.
export function ButtonCaption({ children }) {
	return (
		<p className="
			font-vietnam
			font-semibold
			text-[15px]
			leading-[1.4]
			text-black/[0.53]
			text-center
			mt-[11px]
		">
			{children}
		</p>
	)
}

// ---- back button -----------------------------------------------------------

// The design's blocky return arrow: an arrowhead pointing left off a bar that
// hooks down and back under itself. Traced from the mockup, so the viewBox is
// in the tracing's own coordinates.
function BackArrowIcon({ className }) {
	return (
		<svg
			viewBox="75 72 193 176"
			className={className}
			aria-hidden="true"
		>
			<path
				fill="currentColor"
				d="M75 135 172 72v43h96v133h-96l21-43h27v-45h-48v40z"
			/>
		</svg>
	)
}

const BACK_CLASS = `
	flex
	items-center
	justify-center
	text-black
	transition-transform
	duration-200
	ease-out
	hover:-translate-x-1
	active:translate-x-0
`

// Always back to the labs dashboard. Above `lg` it's pinned to the window's
// top-right corner the way the design has it — 28px down, 26px in, 32px
// square on the 1410 frame — and portalled to <body> so neither the scroll
// column nor its entrance animation gets to move it. Below `lg` the sticky
// menu bar owns the top of the screen, so it's an ordinary row instead.
//
// Its offsets scale the way the content does: the shell's 32px padding stays
// 32px at any size and only the design's own distances grow, so it keeps the
// same 1px clearance from the photo's corner on every screen. They're divided
// back by the zoom because `zoom` multiplies top/right as well.
const SHELL_PAD = 32

export function BackButton() {
	const zoom = useDesignZoom()
	const mounted = useSyncExternalStore(subscribe, () => true, () => false)
	const top = (SHELL_PAD - 4 * zoom) / zoom
	const right = (SHELL_PAD - 6 * zoom) / zoom

	return (
		<>
			<div className="
				flex
				justify-end
				mb-4
				lg:hidden
			">
				<Link
					href="/labs"
					aria-label="Back to labs"
					className={`w-8 h-8 ${BACK_CLASS}`}
				>
					<BackArrowIcon className="w-8 h-8" />
				</Link>
			</div>

			{mounted && createPortal(
				<Link
					href="/labs"
					aria-label="Back to labs"
					style={{ zoom, top, right }}
					className={`
						hidden
						lg:flex
						fixed
						z-40
						w-8
						h-8
						${BACK_CLASS}
					`}
				>
					<BackArrowIcon className="w-8 h-8" />
				</Link>,
				document.body
			)}
		</>
	)
}

// ---- popups ----------------------------------------------------------------

function CloseIcon({ className }) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
			strokeLinecap="round"
			className={className}
			aria-hidden="true"
		>
			<path d="M6 6l12 12M18 6L6 18" />
		</svg>
	)
}

// The same dimmed-backdrop card every other popup on the site uses. `children`
// is a function handed `dismiss(run)`, so a button inside can close the card
// through its exit animation and then do its thing — see lib/dismiss.js.
//
// Portalled to <body>: it's opened from inside the zoomed page, and a fixed
// backdrop inside a zoomed box would be zoomed along with it.
export function Popup({ title, label, onClose, children }) {
	const { closing, dismiss } = useDismiss()
	const close = () => dismiss(onClose)

	useEffect(() => {
		const onKey = (event) => {
			if (event.key === 'Escape') close()
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	})

	return createPortal(
		<div
			className={`
				fixed
				inset-0
				z-50
				flex
				items-center
				justify-center
				bg-black/40
				p-4
				sm:p-8
				${closing ? 'dialog-leaving' : 'dialog-open'}
			`}
			onClick={close}
		>
			<div
				onClick={(event) => event.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-label={label ?? title}
				className="
					w-full
					max-w-[420px]
					max-h-[90dvh]
					overflow-y-auto
					bg-cream
					rounded-[20px]
					p-8
					shadow-[0_10px_40px_rgba(0,0,0,0.35)]
				"
			>
				<div className="
					flex
					items-start
					justify-between
					gap-4
				">
					<h2 className="
						font-beachday
						text-black
						text-[38px]
						leading-none
					">
						{title}
					</h2>
					<button
						type="button"
						onClick={close}
						aria-label="Close"
						className="
							w-9
							h-9
							shrink-0
							flex
							items-center
							justify-center
							rounded-full
							bg-black
							text-cream
							cursor-pointer
							transition-all
							duration-200
							ease-out
							hover:brightness-125
							active:scale-95
						"
					>
						<CloseIcon className="w-4 h-4" />
					</button>
				</div>

				{children(dismiss)}
			</div>
		</div>,
		document.body
	)
}

// The pill buttons along the bottom of a popup, matching the ones on the
// officer dialogs.
export function PopupButton({ onClick, primary = false, children }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`
				rounded-full
				px-6
				py-2
				font-vietnam
				font-semibold
				text-sm
				cursor-pointer
				transition-all
				duration-200
				ease-out
				hover:-translate-y-0.5
				hover:shadow-lg
				hover:shadow-black/10
				active:translate-y-0
				active:shadow-none
				${primary
					? 'bg-green text-[#295212] hover:brightness-95'
					: 'border border-black/70 text-black'}
			`}
		>
			{children}
		</button>
	)
}
