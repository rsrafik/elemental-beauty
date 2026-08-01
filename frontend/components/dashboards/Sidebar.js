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

// How long the swap takes: the old card shrinking back to a pill and the new
// one growing into place. Hovering stays quick (HOVER_MS) so the menu doesn't
// feel sluggish to move around in — only the swap itself is slow. Retune the
// whole menu from these two numbers.
const SWAP_MS = 500
const HOVER_MS = 200

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

	return (
		<aside
			className={`
				bg-orange
				rounded-[10px]
				p-4
				flex
				flex-col
				gap-3
				w-[327px]
				min-h-full
				font-vietnam
				${className}
			`}
		>
			<h2 className={`
				${titleFont}
				text-black
				text-4xl
				text-center
				py-5
				select-none
			`}>
				MENu
			</h2>

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
					}

					return href ? (
						<Link
							key={label}
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
							key={label}
							type="button"
							onClick={handleClick}
							aria-current={activeItem ? 'page' : undefined}
							className={itemClass}
							style={itemStyle}
						>
							{inner}
						</button>
					)
				})}
			</nav>

			{/* bottom cluster: profile + logout, then optional instagram banner */}
			<div className="
				mt-auto
				flex
				flex-col
				gap-3
				pt-4
			">
				<div className="
					flex
					gap-2
				">
					<Link
						href={profileHref}
						onClick={onProfile}
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
							text-[38px]
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
			</div>
		</aside>
	)
}
