'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import gsap from 'gsap'
import { ScrollToPlugin } from 'gsap/ScrollToPlugin'
import { NAV } from './content'

// The navigation: a bead of liquid glass.
//
// It drops in as a single droplet and stretches open into a pill. A yellow
// lens sits under the link for the section you are reading and slides to
// whichever link you point at, on a spring, so it overshoots and settles like
// something wet. Scrolling down draws the pill back into the droplet; scrolling
// up, hovering it or tabbing into it opens it again. On a phone the links live
// in a sheet that grows out of the bead as a circle.
//
// The moving parts are CSS (app/landing.css): this component only decides
// three things — where the lens goes, whether the bar is compact, and whether
// the sheet is open — and writes them as two variables and two class names.

gsap.registerPlugin(ScrollToPlugin)

export default function Nav() {
	const [compact, setCompact] = useState(false)
	const [open, setOpen] = useState(false)
	const [active, setActive] = useState(null)
	const linksRef = useRef(null)

	// Put the lens under a link, or put it away.
	const aim = useCallback((link) => {
		const box = linksRef.current
		if (!box) return
		if (!link) {
			box.style.setProperty('--lens-on', '0')
			return
		}
		box.style.setProperty('--lens-x', `${link.offsetLeft}px`)
		box.style.setProperty('--lens-w', `${link.offsetWidth}px`)
		box.style.setProperty('--lens-on', '1')
	}, [])

	const rest = useCallback(() => {
		aim(active ? linksRef.current?.querySelector(`[data-section="${active}"]`) : null)
	}, [active, aim])

	useEffect(rest, [rest])

	// Compact once you are past the first screen and heading down the page.
	useEffect(() => {
		let last = window.scrollY
		const onScroll = () => {
			const now = window.scrollY
			if (Math.abs(now - last) < 6) return
			setCompact(now > window.innerHeight * 0.5 && now > last)
			last = now
		}
		window.addEventListener('scroll', onScroll, { passive: true })
		return () => window.removeEventListener('scroll', onScroll)
	}, [])

	// Which section is under the middle of the window.
	useEffect(() => {
		const sections = NAV.map((item) => document.getElementById(item.id)).filter(Boolean)
		const watcher = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) setActive(entry.target.id)
					else setActive((current) => (current === entry.target.id ? null : current))
				}
			},
			{ rootMargin: '-50% 0px -50% 0px' },
		)
		sections.forEach((section) => watcher.observe(section))
		return () => watcher.disconnect()
	}, [])

	// the sheet closes on Escape, and the page behind it doesn't scroll
	useEffect(() => {
		if (!open) return
		const onKey = (event) => event.key === 'Escape' && setOpen(false)
		document.documentElement.style.overflow = 'hidden'
		window.addEventListener('keydown', onKey)
		return () => {
			document.documentElement.style.overflow = ''
			window.removeEventListener('keydown', onKey)
		}
	}, [open])

	// Travel to a section on the page's own curve rather than the browser's.
	const travel = (event, id) => {
		const target = document.getElementById(id)
		if (!target) return
		event.preventDefault()
		setOpen(false)
		const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
		gsap.to(window, {
			scrollTo: { y: target, autoKill: true },
			duration: still ? 0 : 1.3,
			ease: 'mech',
		})
		history.replaceState(null, '', `#${id}`)
	}

	return (
		<>
			<nav
				aria-label="Sections"
				className={`
					lp-nav
					glass
					fixed
					top-[clamp(0.75rem,1.6vw,1.4rem)]
					left-1/2
					z-60
					flex
					items-center
					gap-1.5
					rounded-full
					p-1.5
					${compact ? 'is-compact' : ''}
				`}
			>
				<a
					href="#top"
					onClick={(event) => travel(event, 'top')}
					aria-label="Elemental Beauty, back to the top"
					className="
						group
						grid
						size-[2.9rem]
						flex-none
						place-items-center
						rounded-full
						bg-cream
						transition-transform
						duration-700
						ease-spring
						hover:scale-108
					"
				>
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img
						src="/logo.png"
						alt=""
						className="
							w-[1.9rem]
							transition-transform
							duration-900
							ease-mech
							group-hover:rotate-120
						"
					/>
				</a>

				<div className="
					lp-nav-track
					hidden
					lg:grid
				">
					<div
						ref={linksRef}
						onPointerLeave={rest}
						className="
							relative
							flex
							min-w-0
							items-center
							overflow-hidden
							rounded-full
						"
					>
						<span
							aria-hidden="true"
							className="
								lp-nav-lens
								absolute
								inset-y-0
								rounded-full
								bg-yellow
							"
						/>
						{NAV.map((item) => (
							<a
								key={item.id}
								href={`#${item.id}`}
								data-section={item.id}
								aria-current={active === item.id ? 'true' : undefined}
								onClick={(event) => travel(event, item.id)}
								onPointerEnter={(event) => aim(event.currentTarget)}
								onFocus={(event) => aim(event.currentTarget)}
								onBlur={rest}
								className="
									group
									relative
									flex
									items-center
									gap-[0.5em]
									rounded-full
									px-[1.05em]
									py-[0.85em]
									text-small
									leading-none
									font-semibold
									whitespace-nowrap
								"
							>
								{item.label}
							</a>
						))}
					</div>
				</div>

				<Link
					href="/login"
					className="
						flex-none
						rounded-full
						bg-ink
						px-[1.3em]
						py-[1.02em]
						text-small
						leading-none
						font-semibold
						whitespace-nowrap
						text-cream
						transition-transform
						duration-500
						ease-spring
						hover:scale-106
						active:scale-95
					"
				>
					sign in
				</Link>

				<button
					type="button"
					aria-label={open ? 'Close menu' : 'Open menu'}
					aria-expanded={open}
					aria-controls="lp-sheet"
					onClick={() => setOpen((value) => !value)}
					className="
						lp-nav-menu
						grid
						size-[2.9rem]
						flex-none
						cursor-pointer
						place-items-center
						rounded-full
						lg:hidden
					"
				>
					<span className="
						flex
						flex-col
						items-center
						gap-1
					">
						<span className="block h-[0.42rem] w-[0.42rem] rounded-full bg-current" />
						<span className="block h-[0.42rem] w-[0.42rem] rounded-full bg-current" />
					</span>
				</button>
			</nav>

			<div
				id="lp-sheet"
				aria-hidden={!open}
				className={`
					lp-sheet
					fixed
					inset-0
					z-55
					flex
					flex-col
					justify-end
					gap-1
					bg-salmon
					px-edge
					pt-24
					pb-[calc(var(--spacing-edge)+env(safe-area-inset-bottom))]
					lg:hidden
					${open ? 'is-open' : ''}
				`}
			>
				{NAV.map((item, index) => (
					<a
						key={item.id}
						href={`#${item.id}`}
						tabIndex={open ? 0 : -1}
						onClick={(event) => travel(event, item.id)}
						style={{ '--i': index }}
						className="
							type-display
							flex
							items-baseline
							justify-between
							border-b
							border-ink/25
							py-[0.12em]
							text-[clamp(2.6rem,15vw,5rem)]
						"
					>
						{item.label}
					</a>
				))}
			</div>
		</>
	)
}
