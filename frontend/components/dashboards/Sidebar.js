'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Reusable sidebar template used across (almost) all dashboard views.
//
// Items may be plain labels or { label, href } objects. With an href the pill
// becomes a <Link> and navigates; without one it's a plain button and you
// handle the click yourself via onSelect.
//
//   <Sidebar items={navFor(currentRole)} />                 // routed
//   <Sidebar items={['tab a', 'tab b']} onSelect={fn} />    // local tabs
//
// Numbers auto-increment (01, 02, ...), the active one renders as the tall
// white card and the rest as yellow pills. The active item is worked out from
// the URL when the items have hrefs, so pages don't have to declare it — pass
// `active` (label or index) only to override that, e.g. for local tabs.
//
// `titleFont` swaps the display font on the "menu" heading.
//
// ---- narrow screens --------------------------------------------------------
//
// Below `lg` there isn't room for a permanent 327px column, so the same panel
// shrinks to a bar and grows back to fill the screen when the bar is pressed —
// the bar is the control, whole, with no separate button on it. It stays open
// until you close it: press the header again, Escape, or pick somewhere to go.
//
// It's one element in both states, not a bar plus an overlay, which is what
// makes the open read as the bar itself unfolding. Only its height animates:
//
//   the title row      a fixed 4rem, so it's the whole panel when shut and the
//                      header when open, and it never moves between the two
//   everything below   laid out once at the height it will have when the panel
//                      is open, and clipped by the panel until there's room
//                      for it
//
// So nothing inside re-flows on the way — the panel grows and what was already
// arranged behind it comes into view. The rows then travel in on top of that
// (see ROW_* below).
//
// It's sticky rather than in flow: expanding downward is only meaningful from
// somewhere you can see, and a bar that has scrolled off the top leaves no way
// to open the menu at all.
//
// Which state you get is Tailwind's `lg:` prefix, so there's no viewport
// measuring and nothing to hydrate wrong.

// How long the swap takes: the old card shrinking back to a pill and the new
// one growing into place. Hovering stays quick (HOVER_MS) so the menu doesn't
// feel sluggish to move around in — only the swap itself is slow. Retune the
// whole menu from these two numbers.
const SWAP_MS = 500
const HOVER_MS = 200

// Opening on a narrow screen: how long the panel takes to grow, and how the
// rows behind it arrive.
//
// The rows move while the panel is still growing, and each one starts further
// up and later than the row above it. Rows near the bottom therefore have
// further to travel in the same time — that difference in speed between rows is
// the parallax, and it's the same idea (and roughly the same numbers) as the
// page entrance in globals.css.
const OPEN_MS = 480
const ROW_MS = 420
const ROW_STEP = 45
const ROW_RISE = 10
const ROW_RISE_STEP = 7

// The sidebar is re-created on every navigation (each page renders its own),
// so a plain CSS transition has nothing to animate from — the new sidebar
// mounts with the new item already active and snaps.
//
// This module isn't re-evaluated on client-side navigation, so it can carry
// the previous URL across that boundary. A freshly mounted sidebar renders one
// frame with the *old* item active, then flips to the real one, which gives
// the CSS transition something to run. Client-only: reading it during server
// rendering would leak one request's path into another's.
let previousPath = null

function indexForPath(entries, path) {
	// /labs/view still lights up "labs", so a detail page keeps its parent lit.
	return entries.findIndex(
		(entry) =>
			entry.href && (path === entry.href || path.startsWith(`${entry.href}/`))
	)
}

function UserIcon({ className }) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			<circle cx="12" cy="12" r="9" />
			<circle cx="12" cy="10" r="3" />
			<path d="M6.5 18.5a6 6 0 0 1 11 0" />
		</svg>
	)
}

// One row of the menu, carrying its share of the parallax: how far it starts
// from where it lands, and how long after the row above it sets off.
//
// The `lg:` pair is what keeps the column above `lg` out of this. `show` is the
// narrow-screen panel's state, which is false there for the whole life of the
// page, so without them the desktop menu would render permanently faded out.
function Row({ show, index = 0, className = '', children }) {
	return (
		<div
			className={`
				transition-all
				ease-out
				${show
					? 'opacity-100 translate-y-0'
					: 'opacity-0 translate-y-[var(--row-rise)]'}
				lg:opacity-100
				lg:translate-y-0
				${className}
			`}
			style={{
				'--row-rise': `-${ROW_RISE + index * ROW_RISE_STEP}px`,
				transitionDuration: `${ROW_MS}ms`,
				transitionDelay: show ? `${index * ROW_STEP}ms` : '0ms',
			}}
		>
			{children}
		</div>
	)
}

function LogoutIcon({ className }) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
			<path d="M10 17l5-5-5-5" />
			<path d="M15 12H3" />
		</svg>
	)
}

export default function Sidebar({
	items = [],
	active,
	onSelect,
	showInstagram = true,
	instagramUrl = 'https://instagram.com/elementist_',
	profileHref = '/account',
	onProfile,
	onLogout,
	titleFont = 'font-reasons',
	className = '',
}) {
	// Accept both shapes so older callers passing bare strings keep working.
	const entries = items.map((item) =>
		typeof item === 'string' ? { label: item } : item
	)

	const pathname = usePathname()

	// Hold the previous page's highlight for one frame on mount, so the swap
	// animates instead of snapping. See `previousPath` above.
	const [animateFrom, setAnimateFrom] = useState(() => {
		if (typeof window === 'undefined') return null
		return previousPath && previousPath !== pathname ? previousPath : null
	})

	useEffect(() => {
		previousPath = pathname
		if (animateFrom === null) return
		// Next frame, so the browser paints the starting state before the
		// classes change — otherwise there's nothing to transition from.
		const frame = requestAnimationFrame(() => setAnimateFrom(null))
		return () => cancelAnimationFrame(frame)
	}, [pathname, animateFrom])

	const fromPath = indexForPath(entries, animateFrom ?? pathname)

	// Sidebars whose items have no hrefs (local tabs) track their own selection.
	const [selected, setSelected] = useState(null)
	const fromProp =
		typeof active === 'number'
			? active
			: entries.findIndex((entry) => entry.label === active)

	// On a routed sidebar, a URL that matches nothing (e.g. the no-access page)
	// leaves every pill un-highlighted rather than falsely lighting up the
	// first one. Local tabs, which have no hrefs, still default to index 0.
	const routed = entries.some((entry) => entry.href)
	const resolved = fromPath >= 0 ? fromPath : selected ?? fromProp
	const activeIndex = resolved >= 0 ? resolved : routed ? -1 : 0

	// Narrow screens only: is the panel open? Above `lg` it's a static column
	// and this does nothing.
	//
	// What's stored is the page it was opened on, not a boolean, so that landing
	// somewhere new closes it on its own — no effect watching the URL, and no
	// render where the new page is behind a menu belonging to the old one. That
	// covers the back button and any navigation the menu didn't start.
	const [openAt, setOpenAt] = useState(null)
	const open = openAt === pathname

	// While it's up: Escape closes it, and the page underneath stops scrolling
	// so a swipe moves the menu rather than the page behind it.
	useEffect(() => {
		if (!open) return
		const onKey = (event) => {
			if (event.key === 'Escape') setOpenAt(null)
		}
		document.addEventListener('keydown', onKey)
		const previousOverflow = document.body.style.overflow
		document.body.style.overflow = 'hidden'
		return () => {
			document.removeEventListener('keydown', onKey)
			document.body.style.overflow = previousOverflow
		}
	}, [open])

	const closeOverlay = () => setOpenAt(null)

	return (
		<aside
			className={`
				bg-orange
				rounded-[10px]
				flex
				flex-col
				font-vietnam
				overflow-hidden
				sticky
				top-4
				sm:top-6
				z-50
				shrink-0
				ease-out
				${open
					? 'h-[calc(100dvh-2rem)] sm:h-[calc(100dvh-3rem)]'
					: 'h-16'}
				lg:top-8
				lg:self-start
				lg:h-[calc(100vh-4rem)]
				lg:z-auto
				lg:w-[327px]
				lg:overflow-y-auto
				lg:transition-none
				${className}
			`}
			style={{ transition: `height ${OPEN_MS}ms ease-out` }}
		>
			{/* The title row is the whole panel when it's shut, so its height is
			    fixed: growing the panel moves nothing that was already on screen. */}
			<div className="
				relative
				shrink-0
				h-16
				lg:h-auto
				flex
				items-center
				justify-center
				px-4
				lg:pt-9
				lg:pb-5
			">
				<h2 className={`
					${titleFont}
					text-black
					text-3xl
					lg:text-4xl
					text-center
					select-none
				`}>
					MENu
				</h2>
				{/* The whole title row is the control, both ways: press the bar to
				    open it, press the header to shut it again.

				    It's an overlay laid over the row rather than a wrapper around
				    it, because the heading can't live inside a <button> — a button
				    takes phrasing content, and an <h2> isn't. Darkening on press is
				    the only affordance it needs; the bar is plainly a thing to hit
				    and the panel answers immediately. */}
				<button
					type="button"
					onClick={() => (open ? closeOverlay() : setOpenAt(pathname))}
					aria-label={open ? 'Close menu' : 'Open menu'}
					aria-expanded={open}
					className="
						lg:hidden
						absolute
						inset-0
						cursor-pointer
						rounded-[10px]
						transition-colors
						duration-200
						ease-out
						hover:bg-black/5
						active:bg-black/10
					"
				/>
			</div>

			{/* Everything under the title row.

			    Below `lg` it's taken out of the flow and given the height it will
			    have once the panel is open, so it's arranged correctly from the
			    start and the panel growing only uncovers it. In flow it would be
			    re-laying itself out on every frame of the animation — the profile
			    button riding up on `mt-auto` as the space under it appeared.

			    `invisible` while shut keeps it out of the tab order; it's in the
			    transition so it holds through the close. */}
			<div className={`
				absolute
				inset-x-0
				top-16
				h-[calc(100dvh-6rem)]
				sm:h-[calc(100dvh-7rem)]
				overflow-y-auto
				px-4
				pb-4
				flex
				flex-col
				gap-3
				transition-[visibility]
				lg:static
				lg:h-auto
				lg:flex-1
				lg:min-h-0
				lg:overflow-visible
				lg:visible
				${open ? 'visible' : 'invisible'}
			`}
			style={{ transitionDuration: `${OPEN_MS}ms` }}
			>
				<nav className="
					flex
					flex-col
					gap-3
				">
					{entries.map(({ label, href }, i) => {
						const activeItem = activeIndex === i
						const number = String(i + 1).padStart(2, '0')
						const itemClass = `
							group
							flex
							items-center
							justify-between
							rounded-[5px]
							px-4
							text-left
							font-vietnam
							font-semibold
							text-black
							hover:-translate-y-0.5
							hover:shadow-lg
							hover:shadow-black/10
							active:translate-y-0
							active:shadow-none
							${activeItem
								? 'bg-white h-28 items-start pt-4 shadow-sm'
								: 'bg-yellow-light h-14 hover:bg-yellow'}
						`
						// Height/padding/colour belong to the swap and take SWAP_MS;
						// the hover lift and its shadow stay on HOVER_MS.
						const itemStyle = {
							transition: `
								height ${SWAP_MS}ms ease-out,
								padding-top ${SWAP_MS}ms ease-out,
								background-color ${SWAP_MS}ms ease-out,
								transform ${HOVER_MS}ms ease-out,
								box-shadow ${HOVER_MS}ms ease-out
							`,
						}
						const inner = (
							<>
								<span className="
									text-lg
									transition-transform
									duration-200
									ease-out
									group-hover:translate-x-0.5
								">
									{label}
								</span>
								<span
									className={`
										flex
										items-center
										justify-center
										rounded-full
										text-xs
										w-7
										h-7
										shrink-0
										group-hover:scale-110
										${activeItem ? 'bg-yellow' : 'bg-white'}
									`}
									style={{
										transition: `
											background-color ${SWAP_MS}ms ease-out,
											transform ${HOVER_MS}ms ease-out
										`,
									}}
								>
									{number}
								</span>
							</>
						)

						const handleClick = () => {
							if (!href) setSelected(i)
							onSelect?.(label, i)
							// picking somewhere to go is the other way out of the overlay
							closeOverlay()
						}

						return (
							<Row key={label} show={open} index={i}>
								{href ? (
									<Link
										href={href}
										onClick={handleClick}
										aria-current={activeItem ? 'page' : undefined}
										className={itemClass}
										style={itemStyle}
									>
										{inner}
									</Link>
								) : (
									<button
										type="button"
										onClick={handleClick}
										aria-current={activeItem ? 'page' : undefined}
										className={itemClass}
										style={itemStyle}
									>
										{inner}
									</button>
								)}
							</Row>
						)
					})}
				</nav>

				{/* bottom cluster: profile + logout, then optional instagram banner.
				    Last in the parallax, so it's still arriving once the pills above
				    it have settled. */}
				<Row
					show={open}
					index={entries.length}
					className="
						mt-auto
						flex
						flex-col
						gap-3
						pt-4
					"
				>
					<div className="
						flex
						gap-2
					">
						<Link
							href={profileHref}
							onClick={() => {
								onProfile?.()
								closeOverlay()
							}}
							className="
								group
								flex
								items-center
								gap-2
								flex-1
								bg-white
								rounded-[5px]
								px-4
								h-14
								font-vietnam
								font-semibold
								text-black
								transition-all
								duration-200
								ease-out
								hover:-translate-y-0.5
								hover:shadow-lg
								hover:shadow-black/10
								active:translate-y-0
								active:shadow-none
							"
						>
							<UserIcon className="
								w-5
								h-5
								transition-transform
								duration-200
								ease-out
								group-hover:scale-110
								group-hover:-rotate-6
							" />
							<span className="
								text-lg
								transition-transform
								duration-200
								ease-out
								group-hover:translate-x-0.5
							">
								profile
							</span>
						</Link>
						<button
							type="button"
							onClick={onLogout}
							aria-label="Log out"
							className="
								group
								flex
								items-center
								justify-center
								bg-red
								rounded-[5px]
								w-12
								h-14
								text-white
								transition-all
								duration-200
								ease-out
								hover:-translate-y-0.5
								hover:shadow-lg
								hover:shadow-black/10
								hover:brightness-95
								active:translate-y-0
								active:shadow-none
							"
						>
							<LogoutIcon className="
								w-5
								h-5
								transition-transform
								duration-200
								ease-out
								group-hover:translate-x-0.5
							" />
						</button>
					</div>

					{showInstagram && (
						<a
							href={instagramUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="
								rounded-[5px]
								h-[101px]
								flex
								items-center
								justify-center
								text-center
								text-white
								text-[30px]
								sm:text-[38px]
								font-aalto
								tracking-wide
								uppercase
								bg-[linear-gradient(90deg,#FFDF2B_0%,#FF7D45_20%,#FF1919_45%,#C13584_75%,#833AB4_100%)]
								transition-all
								duration-200
								ease-out
								hover:-translate-y-0.5
								hover:shadow-lg
								hover:shadow-black/10
								hover:brightness-105
								active:translate-y-0
								active:shadow-none
							"
						>
							Follow us on Instagram
						</a>
					)}
				</Row>
			</div>
		</aside>
	)
}
