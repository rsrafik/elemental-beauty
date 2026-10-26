'use client'

import { createContext, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cameFromApp } from '@/lib/history'
import { useDismiss } from '@/lib/dismiss'
import { longDate, prettyTimeRange } from '@/lib/dates'
import { payments as paymentsApi } from '@/lib/api'

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

// `Scaled`, for a page that's meant to fit the window without scrolling — a
// lab's or event's sign-up page, with its pay card under the button. The zoom
// is picked off the window's width, so on a short window (a laptop, or a tall
// description) the page would run past the bottom; above `lg` this measures
// what it holds and, when the width's zoom would make it taller than the page
// column has room for, zooms down just far enough to fit. Below `lg` the page
// scrolls as it always has.
//
// Measured, not worked out: how tall the content comes out depends on the
// description and what the pay card is showing. It's re-measured whenever
// either changes size (ResizeObserver) or the window does.
//
// Something inside can say it's meant to run long instead (FitScroll): the
// pay card, once its QR codes are too many for one row and wrap into a grid.
// Then it stays at the width's zoom and the page column scrolls — the
// sidebar doesn't.
const FIT_FLOOR = 0.55

// Inside a FitScaled: call with true to let the page scroll rather than
// shrink to fit, false to fit again. Null outside one.
export const FitScroll = createContext(null)
// what sits under the content in the column besides it — the sign-up stage's
// own bottom padding (MemberLabView) and a little air
const FIT_SPARE = 34

export function FitScaled({ className = '', children }) {
	const zoom = useDesignZoom()
	const box = useRef(null)
	// the zoom that fits, when it's less than the width's — null otherwise
	const [fit, setFit] = useState(null)
	// something inside asked to scroll instead (FitScroll)
	const [scrolls, setScrolls] = useState(false)

	useEffect(() => {
		const el = box.current
		const column = el?.closest('main > section')
		if (!el || !column) return
		const measure = () => {
			if (window.innerWidth < LG) return setFit(null)
			const style = getComputedStyle(column)
			const room = column.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - FIT_SPARE
			const current = Number(el.style.zoom) || 1
			// its height at a zoom of 1, so the answer doesn't depend on where
			// the last one left it
			const natural = el.getBoundingClientRect().height / current
			if (!natural) return
			const wanted = Math.max(FIT_FLOOR, room / natural)
			setFit(wanted < zoom ? wanted : null)
		}
		const observer = new ResizeObserver(measure)
		observer.observe(el)
		observer.observe(column)
		return () => observer.disconnect()
	}, [zoom])

	return (
		<FitScroll.Provider value={setScrolls}>
			<div ref={box} className={className} style={{ zoom: scrolls ? zoom : fit ?? zoom }}>
				{children}
			</div>
		</FitScroll.Provider>
	)
}

// ---- header ----------------------------------------------------------------

// 'october 10, 2026 • 5:00-7:00PM • WTHR 200'. A lab with no time or no room just
// drops that part rather than printing an empty slot between two bullets.
export function metaLine(lab) {
	return [
		longDate(lab.date).toLowerCase(),
		prettyTimeRange(lab.startTime, lab.endTime).replace(/ /g, ''),
		lab.location,
	]
		.filter(Boolean)
		.join(' • ')
}

// Text on the left, the 303×210 photo on the right, tops aligned, the space
// between them taking up the slack. Whatever the stage needs under the
// description (the rsvp button, the QR button) comes in as children and sits
// in the text column. Below `lg` the photo goes on top.
// `accent` is the title's colour class — salmon for a lab, and the event page
// (which borrows this layout) passes its own. `aside` goes under the photo —
// the event page's links.
export function LabIntro({ lab, accent = 'text-salmon', aside = null, children }) {
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
				<h1 className={`
					font-beachday
					text-[40px]
					sm:text-[54px]
					leading-[1.05]
					${accent}
					mt-[7px]
					break-words
				`}>
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
				lg:w-[303px]
				shrink-0
			">
				<div className="
					w-full
					aspect-[303/210]
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
				{aside}
			</div>
		</div>
	)
}

// ---- buttons ---------------------------------------------------------------

// The chunky rsvp-style button: sign up (red), registered (green), waitlisted
// (yellow). Submit quiz is the green one with different words on it. Grey is a
// confirm or accept that's waiting on a payment being sent (src/offers.js).
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

// ---- dues ------------------------------------------------------------------

// '$5' or '$5.50' — the non-member price as the cards print it
export function priceText(amount) {
	return Number(amount).toLocaleString('en-US', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: Number.isInteger(Number(amount)) ? 0 : 2,
	})
}

// The same price on a lab or event card, at its bottom right beside the rsvp
// button: a little scalloped sticker — salmon, a stitched white ring — so it's
// the first thing someone unpaid sees. The price itself is in the plain bold
// face, not the handwritten one: a handwritten '$' doesn't read as one. The card places
// it (the button row's right-hand column). It lets clicks through to the card
// underneath — on an event card that's the link stretched over it.
//
// A longer price ('$12.50') steps the text down a size and leaves the stitched
// ring off, so it has the whole disc rather than running over the stitching.

// the scalloped edge: twelve bumps around a disc, all one fill
const SCALLOPS = Array.from({ length: 12 }, (_, i) => {
	const angle = (i / 12) * Math.PI * 2
	return { cx: 24 + Math.cos(angle) * 18.5, cy: 24 + Math.sin(angle) * 18.5 }
})

export function PriceBadge({ price }) {
	return (
		<span className="
			price-sticker
			pointer-events-none
			relative
			flex
			items-center
			justify-center
			w-12
			h-12
		">
			<svg viewBox="0 0 48 48" aria-hidden="true" className="absolute inset-0 w-full h-full">
				<g className="fill-salmon-med">
					<circle cx="24" cy="24" r="19" />
					{SCALLOPS.map(({ cx, cy }, i) => (
						<circle key={i} cx={cx} cy={cy} r="5.2" />
					))}
				</g>
				{price.length <= 4 && (
					<circle cx="24" cy="24" r="15.5" fill="none" stroke="white" strokeWidth="1.2" strokeDasharray="2.4 2" strokeLinecap="round" />
				)}
			</svg>
			<span className={`
				relative
				font-vietnam
				font-bold
				leading-none
				tracking-tight
				${price.length > 4 ? 'text-[9px]' : 'text-[12px]'}
				text-white
				whitespace-nowrap
			`}>
				<span className="sr-only">non-member price </span>
				{price}
			</span>
		</span>
	)
}

// The warning a lab's or members-only event's page gives someone who hasn't
// paid the year's dues: what it'll cost them at the door. `dues` is the API's
// { schoolYear, amount, price } (see src/dues.js) — null when they've paid,
// or it's open to all, and then there's nothing to say. `noun` is 'lab' or
// 'event'. Red, like the price on their cards: it's something they owe.
// `due` is when payment's due (the API's paymentDueAt — a week before, 11:59
// PM): it's said here too, since signing up means paying by then.
export function DuesNotice({ dues, noun, due = null }) {
	if (!dues) return null
	const { schoolYear, amount, price } = dues
	const by = due
		? ` Once you sign up, pay a week before it starts, by ${new Date(due).toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}, or you'll be moved to the waitlist.`
		: ''
	let text
	if (price > 0) {
		text = `You haven't paid your ${schoolYear} dues, so this ${noun} is ${priceText(price)} for you`
		text += amount > 0 ? `, or pay your ${priceText(amount)} dues to cover the whole semester.` : '.'
	} else {
		text = `You haven't paid your ${schoolYear} dues yet. They're ${priceText(amount)}.`
	}
	text += by
	return (
		<p
			role="note"
			className="
				mt-5
				max-w-[420px]
				rounded-[12px]
				bg-red/10
				px-4
				py-3
				font-vietnam
				font-semibold
				text-[14px]
				leading-[1.4]
				text-red
				text-center
			"
		>
			{text}
		</p>
	)
}

// For someone holding a spot (or an offer of one) who owes for it: there's no
// confirm or accept button — paying is how they do it (src/offers.js). A card
// over the pay card says so:
//
//   signed up, not paid   their spot can only be confirmed once they pay, and
//                         when it's due: a week before, or their confirmation
//                         deadline if that's sooner, or the 48 hours they were
//                         given owing late (`pay.dueBy`) — or, their
//                         payment sent back, the old due date and the new one
//                         it has to be fixed by (`pay.fixBy`, 48 hours on)
//   offered, not paid     the spot can only be accepted once they pay — by
//                         when the offer lapses (`offerBy`), if it does
//   paid, being checked   the spot's held, and confirmed once it's approved
//
// `pay` is the API's { sent, dueAt, dueBy, fixBy }. It goes in as PaySection's
// `notice`, which sets it over the pay card at the pay card's width.
export function PayToHold({ pay, offered = false, offerBy = null }) {
	if (!pay) return null
	const when = (at) => new Date(at).toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
	const late = pay.dueAt && new Date(pay.dueAt) <= new Date()

	let heading
	let text
	if (pay.sent) {
		heading = 'your spot is held'
		text = <>We’ve got your payment. Your spot is yours while it’s checked, and it’s <b className="text-black">officially confirmed</b> once it’s approved.</>
	} else if (offered) {
		heading = 'pay to accept your spot'
		text = (
			<>
				This spot can only be <b className="text-black">accepted</b> once you pay. Send your payment below and it’s yours
				{offerBy
					? <>. Pay by <b className="text-black">{when(offerBy)}</b>, or it may go to the next person on the waitlist.</>
					: '.'}
			</>
		)
	} else if (pay.fixBy) {
		heading = 'pay to confirm your spot'
		text = (
			<>
				Your spot can only be <b className="text-black">confirmed</b> once you pay. Your payment was sent back, so the due date has moved.
				<br />
				{pay.dueAt && <>Was due {when(pay.dueAt)}.<br /></>}
				Now due <b className="text-black">{when(pay.fixBy)}</b>. Fix it and send it again below by then, or you’ll be moved to the waitlist.
			</>
		)
	} else {
		heading = 'pay to confirm your spot'
		text = (
			<>
				Your spot can only be <b className="text-black">confirmed</b> once you pay. Send your payment below
				{pay.dueAt && (late
					? <>. It was due <b className="text-black">{when(pay.dueAt)}</b>, so pay now to keep your spot.</>
					: <>{{ confirm: ' by your confirmation deadline, ', late: '. The usual due date had passed, so you have 48 hours: pay by ' }[pay.dueBy] ?? ' a week before, by '}<b className="text-black">{when(pay.dueAt)}</b>, or you’ll be moved to the waitlist.</>)}
				{!pay.dueAt && '.'}
			</>
		)
	}

	return (
		<section
			role="note"
			aria-label={heading}
			className={`
				w-full
				flex
				items-start
				gap-3
				rounded-[16px]
				border-l-[6px]
				${pay.sent ? 'border-green' : 'border-salmon'}
				bg-white
				px-6
				py-4
				text-left
				shadow-[0_0_20px_rgba(0,0,0,0.15)]
			`}
		>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`w-5 h-5 shrink-0 mt-0.5 ${pay.sent ? 'text-green-dark' : 'text-salmon-dark'}`} aria-hidden="true">
				{pay.sent
					? <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>
					: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>}
			</svg>
			<div className="min-w-0">
				<h2 className="
					font-vietnam
					font-semibold
					text-[15px]
					text-black
				">
					{heading}
				</h2>
				<p className="
					mt-1
					font-vietnam
					text-[13px]
					leading-snug
					text-black/70
				">
					{text}
				</p>
			</div>
		</section>
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

// Back to wherever you just were — the calendar, the dashboard, an event's
// page — the way the browser's own back button would. Opened fresh (an email
// link, a bookmark) there's nowhere in the app to go back to, so it goes to
// `href` instead: the labs dashboard, or /events for an event's pages. See
// lib/history.js. Above `lg` it's pinned to the window's
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

//
// `before` is anything that belongs beside it — the lab editor's preview eye —
// laid to its left in both places, so it rides along with the arrow wherever
// the arrow is pinned.
export function BackButton({ href = '/labs', label = 'Back to labs', before = null }) {
	const router = useRouter()
	const zoom = useDesignZoom()
	const back = (event) => {
		if (!cameFromApp()) return
		event.preventDefault()
		router.back()
	}
	const mounted = useSyncExternalStore(subscribe, () => true, () => false)
	const top = (SHELL_PAD - 4 * zoom) / zoom
	const right = (SHELL_PAD - 6 * zoom) / zoom

	return (
		<>
			<div className="
				flex
				justify-end
				items-center
				gap-4
				mb-4
				lg:hidden
			">
				{before}
				<Link
					href={href}
					onClick={back}
					aria-label={cameFromApp() ? 'Back' : label}
					className={`w-8 h-8 ${BACK_CLASS}`}
				>
					<BackArrowIcon className="w-8 h-8" />
				</Link>
			</div>

			{mounted && createPortal(
				<div
					style={{ zoom, top, right }}
					className="
						hidden
						lg:flex
						fixed
						z-40
						items-center
						gap-4
					"
				>
					{before}
					<Link
						href={href}
						onClick={back}
						aria-label={cameFromApp() ? 'Back' : label}
						className={`w-8 h-8 ${BACK_CLASS}`}
					>
						<BackArrowIcon className="w-8 h-8" />
					</Link>
				</div>,
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
// `width` is the card's max-width class, for one that needs more room than
// the usual 420px (the check-in page's payments).
export function Popup({ title, label, onClose, children, width = 'max-w-[420px]' }) {
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
				className={`
					w-full
					${width}
					max-h-[90dvh]
					overflow-y-auto
					bg-cream
					rounded-[20px]
					p-8
					shadow-[0_10px_40px_rgba(0,0,0,0.35)]
				`}
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
// officer dialogs. `danger` is the red one, for something that can't be taken
// back.
export function PopupButton({ onClick, primary = false, danger = false, disabled = false, children }) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className={`
				disabled:opacity-40
				disabled:cursor-not-allowed
				disabled:hover:translate-y-0
				disabled:hover:shadow-none
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
				${danger
					? 'bg-red text-white hover:brightness-95'
					: primary
						? 'bg-green text-[#295212] hover:brightness-95'
						: 'border border-black/70 text-black'}
			`}
		>
			{children}
		</button>
	)
}

// Asked before anyone gives up their spot on a lab or event — a seat, a
// waitlist place or an offer — from its card or its page (j-board's cards
// too). `mine` is where they stand: 'rsvped', 'waitlisted' or 'offered'.
//
// It says the two things that make leaving more than a click: `closed` (the
// lab isn't taking sign-ups, so there's no signing back up) and, when they've
// paid for this one, that the payment isn't refunded — the club buys the
// materials ahead. `place` is { labId } or { eventId }, which is what it asks
// about (GET /payments/options).
const GIVING_UP = {
	rsvped: 'your spot',
	waitlisted: 'your place on the waitlist',
	offered: 'the spot you were offered',
}

export function LeavePopup({ title, mine, closed = false, place, onConfirm, onClose }) {
	const what = GIVING_UP[mine] ?? 'your spot'
	// whether they've paid the entry for this one: at the door, or a payment
	// they sent in that's waiting or approved
	const [paid, setPaid] = useState(false)
	const key = JSON.stringify(place ?? {})

	useEffect(() => {
		const where = JSON.parse(key)
		if (!where.labId && !where.eventId) return
		let live = true
		paymentsApi.options(where)
			.then((reply) => live && setPaid(
				reply.door === 'fee' ||
				reply.payments.some((payment) => payment.kind === 'fee' && ['pending', 'approved'].includes(payment.status))
			))
			.catch(() => {})
		return () => { live = false }
	}, [key])

	return (
		<Popup title="are you sure?" onClose={onClose}>
			{(dismiss) => (
				<>
					<p className="
						mt-3
						font-vietnam
						text-sm
						text-black/70
					">
						{`Give up ${what} for `}
						<span className="font-semibold text-black">{title}</span>?
						{closed && ` Sign-ups are closed, so you won’t be able to sign up again. This can’t be undone.`}
					</p>
					{paid && (
						<p className="
							mt-4
							rounded-[12px]
							bg-yellow-light/60
							px-4
							py-3
							font-vietnam
							font-semibold
							text-[13px]
							leading-snug
							text-[#8A7500]
						">
							Your payment for this one won’t be refunded, because we’ve already bought the materials for you.
						</p>
					)}
					<div className="
						mt-8
						flex
						justify-end
						gap-3
					">
						<PopupButton onClick={() => dismiss(onClose)}>keep it</PopupButton>
						<PopupButton danger onClick={() => dismiss(() => onConfirm())}>
							give it up
						</PopupButton>
					</div>
				</>
			)}
		</Popup>
	)
}
