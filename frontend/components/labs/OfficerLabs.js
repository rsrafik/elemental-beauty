'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDismiss } from '@/lib/dismiss'
import DashboardShell from '@/components/dashboards/DashboardShell'
import { labs as labsApi } from '@/lib/api'
import { isoDate, prettyTime } from '@/lib/dates'
import { splitByDate, CompletedDivider, COMPLETED_CARD } from '@/components/CardSections'

// /labs for officer / treasurer / admin: every lab on one sheet.
//
// Same card as the member page — photo, name, date — with the status icon in
// the bottom-right swapped for a dots menu. Clicking the card opens the lab's
// check-in page; the dots offer its two editors (the lab, and its quiz) and
// delete. The + in the header opens the lab editor on a new lab.

// ---- data ------------------------------------------------------------------

// GET /api/labs, flattened for the cards. `date` is kept the way the date
// input wants it ('YYYY-MM-DD') so editing a lab prefills instead of re-parsing
// what the card prints.
function toCard(lab) {
	return {
		id: lab.labId,
		title: lab.title,
		date: isoDate(lab.date),
		time: lab.startTime ?? '',
		location: lab.location ?? '',
		image: lab.image,
		description: lab.description ?? '',
		published: lab.published !== false,
		hasDraft: Boolean(lab.hasDraft),
	}
}

// '2026-08-30' -> 'August 30, 2026'. Split by hand rather than through Date,
// which reads a bare date string as UTC and can hand back the day before
// depending on the timezone.
function prettyDate(value) {
	if (!value) return ''
	const [year, month, day] = String(value).slice(0, 10).split('-').map(Number)
	if (!year || !month || !day) return ''
	return new Date(year, month - 1, day).toLocaleDateString('en-US', {
		month: 'long',
		day: 'numeric',
		year: 'numeric',
	})
}

// ---- icons -----------------------------------------------------------------

function DotsIcon({ className = '' }) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="currentColor"
			className={className}
			aria-hidden="true"
		>
			<circle cx="12" cy="5" r="2" />
			<circle cx="12" cy="12" r="2" />
			<circle cx="12" cy="19" r="2" />
		</svg>
	)
}

// A plus in a circle — the rounded square around it is the button's own border.
function PlusIcon({ className = '' }) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			className={className}
			aria-hidden="true"
		>
			<circle cx="12" cy="12" r="9" />
			<path d="M12 7.5v9M7.5 12h9" />
		</svg>
	)
}

// ---- card ----------------------------------------------------------------

const MENU_ITEM = `
	block
	w-full
	text-left
	rounded-[8px]
	px-3
	py-2
	font-vietnam
	font-semibold
	text-sm
	cursor-pointer
	transition-colors
	duration-150
	ease-out
`

// The dots' menu, over the bottom of the photo so the name stays readable. Closes on a click
// anywhere else or Escape.
function CardMenu({ title, onQuiz, onEdit, onDelete, onClose }) {
	const ref = useRef(null)

	useEffect(() => {
		const onDown = (event) => {
			if (!ref.current?.contains(event.target)) onClose()
		}
		const onKey = (event) => {
			if (event.key === 'Escape') onClose()
		}
		// on the next tick, so the click that opened it doesn't close it
		const timer = setTimeout(() => window.addEventListener('pointerdown', onDown))
		window.addEventListener('keydown', onKey)
		return () => {
			clearTimeout(timer)
			window.removeEventListener('pointerdown', onDown)
			window.removeEventListener('keydown', onKey)
		}
	}, [onClose])

	return (
		<div
			ref={ref}
			role="menu"
			aria-label={`${title} options`}
			onClick={(event) => event.stopPropagation()}
			className="
				menu-open
				absolute
				right-2
				bottom-[68px]
				z-30
				w-44
				rounded-[14px]
				bg-white
				p-2
				shadow-[0_10px_30px_rgba(0,0,0,0.2)]
				[transform-origin:bottom_right]
			"
		>
			<button type="button" role="menuitem" onClick={onQuiz} className={`${MENU_ITEM} text-black hover:bg-cream`}>
				edit lab quiz
			</button>
			<button type="button" role="menuitem" onClick={onEdit} className={`${MENU_ITEM} text-black hover:bg-cream`}>
				edit lab
			</button>
			<div className="
				my-1
				h-px
				bg-black/10
			" />
			<button type="button" role="menuitem" onClick={onDelete} className={`${MENU_ITEM} text-red hover:bg-red/10`}>
				delete lab
			</button>
		</div>
	)
}

// A live lab with unpublished edits waiting says so across its photo. (A lab
// that's only ever been a draft doesn't need to — its whole card is purple.)
function DraftTag({ published, hasDraft }) {
	if (!published || !hasDraft) return null
	return (
		<span className="
			absolute
			left-5
			top-5
			rounded-full
			bg-yellow-light
			px-2.5
			py-0.5
			font-vietnam
			font-semibold
			text-[11px]
			text-[#8A7500]
			shadow-[0_2px_6px_rgba(0,0,0,0.15)]
		">
			unpublished edits
		</span>
	)
}

// Drafts — labs members can't see yet — are light purple instead of white.
function LabCard({ lab, onOpen, menu, onMenu, done = false }) {
	const { title, date, time, location, image } = lab
	return (
		<div
			role="link"
			tabIndex={0}
			onClick={onOpen}
			onKeyDown={(event) => {
				if (event.key === 'Enter') onOpen()
			}}
			className={`
				group
				relative
				${lab.published ? 'bg-white' : 'bg-[#E8DEFF]'}
				${done ? COMPLETED_CARD : ''}
				rounded-[10px]
				p-3
				pb-4
				cursor-pointer
				shadow-[0_4px_10px_rgba(0,0,0,0.15)]
				transition-all
				duration-200
				ease-out
				hover:-translate-y-1
				hover:shadow-[-5px_5px_5px_rgba(0,0,0,0.5)]
				active:translate-y-0
				active:shadow-[0_4px_10px_rgba(0,0,0,0.15)]
			`}
		>
			<div className="
				aspect-[4/3]
				w-full
				overflow-hidden
				rounded-[10px]
				bg-salmon-lightest
			">
				{image && (
					<img
						src={image}
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
			<DraftTag published={lab.published} hasDraft={lab.hasDraft} />

			<div className="
				mt-3
				flex
				items-end
				justify-between
				gap-2
			">
				<div className="min-w-0">
					<p className="
						font-vietnam
						font-semibold
						text-black
						text-[17px]
						leading-tight
						truncate
					">
						{title}
					</p>
					{/* date, time and room, a row each — whichever it has */}
					<div className="mt-1">
						{[prettyDate(date), prettyTime(time), location].filter(Boolean).map((line) => (
							<p
								key={line}
								className="
									font-vietnam
									text-black/70
									text-xs
									sm:text-sm
									truncate
								"
							>
								{line}
							</p>
						))}
					</div>
				</div>

				<button
					type="button"
					onClick={(event) => {
						event.stopPropagation()
						onMenu()
					}}
					aria-label={`${title} options`}
					aria-haspopup="menu"
					aria-expanded={Boolean(menu)}
					className="
						w-7
						h-7
						shrink-0
						flex
						items-center
						justify-center
						rounded-full
						text-black
						cursor-pointer
						transition-colors
						duration-200
						ease-out
						hover:bg-black/10
					"
				>
					<DotsIcon className="w-4 h-4" />
				</button>
			</div>

			{menu}
		</div>
	)
}

// ---- delete ----------------------------------------------------------------

// Asked before a lab goes, from the card's menu.
function ConfirmDeleteDialog({ label, onCancel, onConfirm }) {
	// dismiss plays the exit animation and then closes for real — lib/dismiss.js
	const { closing, dismiss } = useDismiss()
	const cancel = () => dismiss(onCancel)

	useEffect(() => {
		const onKey = (event) => {
			if (event.key === 'Escape') cancel()
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	})

	return (
		<div
			className={`
				fixed
				inset-0
				z-[60]
				flex
				items-center
				justify-center
				bg-black/40
				p-4
				sm:p-8
				${closing ? 'dialog-leaving' : 'dialog-open'}
			`}
			onClick={cancel}
		>
			<div
				onClick={(event) => event.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-label="Delete lab"
				className="
					w-full
					max-w-[420px]
					bg-cream
					rounded-[20px]
					p-8
					shadow-[0_10px_40px_rgba(0,0,0,0.35)]
				"
			>
				<h2 className="
					font-beachday
					text-black
					text-[32px]
					leading-none
				">
					delete lab?
				</h2>
				<p className="
					font-vietnam
					text-sm
					text-black/60
					mt-3
				">
					“{label}” and everything on it goes away. This can&apos;t be undone.
				</p>

				<div className="
					mt-8
					flex
					justify-end
					gap-3
				">
					<button
						type="button"
						onClick={cancel}
						className="
							rounded-full
							border
							border-black/70
							px-6
							py-2
							font-vietnam
							font-semibold
							text-sm
							text-black
							cursor-pointer
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
						cancel
					</button>
					<button
						type="button"
						onClick={() => dismiss(onConfirm)}
						className="
							rounded-full
							bg-red
							px-6
							py-2
							font-vietnam
							font-semibold
							text-sm
							text-white
							cursor-pointer
							transition-all
							duration-200
							ease-out
							hover:-translate-y-0.5
							hover:shadow-lg
							hover:shadow-black/20
							hover:brightness-95
							active:translate-y-0
							active:shadow-none
						"
					>
						delete
					</button>
				</div>
			</div>
		</div>
	)
}

// the card sheet — the same grid above and below the completed divider
const GRID = `
	grid
	grid-cols-2
	lg:grid-cols-3
	xl:grid-cols-4
	2xl:grid-cols-5
	gap-3
	sm:gap-5
	lg:gap-8
	px-3
	pb-3
`

// ---- page ------------------------------------------------------------------

export default function OfficerLabs({ openNew = false }) {
	const router = useRouter()
	const [labs, setLabs] = useState([])
	const [error, setError] = useState(null)
	// the card whose dots menu is open, and the one being asked about deleting
	const [menuFor, setMenuFor] = useState(null)
	const [deleting, setDeleting] = useState(null)

	// The dashboard's "New Lab" button still arrives as /labs?new — the form
	// is its own page now, so pass it on there.
	useEffect(() => {
		if (openNew) router.replace('/labs/edit')
	}, [openNew, router])

	useEffect(() => {
		let live = true
		labsApi
			.list()
			.then((rows) => live && setLabs(rows.map(toCard)))
			.catch((err) => live && setError(err.message))
		return () => { live = false }
	}, [])

	// The API goes first rather than the card: deleting takes every sign-up
	// and quiz result with it, so a row vanishing from the sheet and then
	// coming back because the call was refused is worse than a beat's wait.
	const deleteLab = async () => {
		const target = deleting
		setDeleting(null)
		setError(null)
		try {
			await labsApi.remove(target.id)
			setLabs((prev) => prev.filter((lab) => lab.id !== target.id))
		} catch (err) {
			setError(err.message)
		}
	}

	const closeMenu = useCallback(() => setMenuFor(null), [])

	// coming up (or today) first, then what's already happened, greyed out
	const { upcoming, completed } = splitByDate(labs)

	return (
		<DashboardShell>
			<div className="
				flex
				items-center
				justify-center
				gap-3
				sm:gap-5
				pt-4
				sm:pt-6
				pb-6
				sm:pb-10
			">
				<h1 className="
					font-canobis
					[-webkit-text-stroke:1px_black]
					sm:[-webkit-text-stroke:2px_black]
					text-black
					text-[30px]
					sm:text-[38px]
					lg:text-[45px]
					select-none
				">
					ALL LABS
				</h1>
				{error && (
					<span className="
						font-vietnam
						text-xs
						text-salmon-dark
						max-w-[240px]
					">
						{error}
					</span>
				)}
				<button
					type="button"
					onClick={() => router.push('/labs/edit')}
					aria-label="New lab"
					className="
						group
						w-12
						h-12
						shrink-0
						flex
						items-center
						justify-center
						text-blue-med
						cursor-pointer
						transition-transform
						duration-200
						ease-out
						hover:-translate-y-0.5
						active:translate-y-0
					"
				>
					{/* drop-shadow, not box-shadow: it traces the circle and the plus
					    instead of casting a square behind the whole button */}
					<PlusIcon className="
						w-7
						h-7
						transition-[filter]
						duration-200
						ease-out
						group-hover:drop-shadow-[-2px_2px_1px_rgba(0,0,0,0.5)]
					" />
				</button>
			</div>

			<div className={GRID}>
				{upcoming.map((lab) => (
					<LabCard
						key={lab.id}
						lab={lab}
						onOpen={() => router.push(`/labs/view?id=${lab.id}`)}
						onMenu={() => setMenuFor((open) => (open === lab.id ? null : lab.id))}
						menu={menuFor === lab.id && (
							<CardMenu
								title={lab.title}
								onClose={closeMenu}
								onQuiz={() => router.push(`/labs/quiz?id=${lab.id}`)}
								onEdit={() => router.push(`/labs/edit?id=${lab.id}`)}
								onDelete={() => {
									setMenuFor(null)
									setDeleting(lab)
								}}
							/>
						)}
					/>
				))}
			</div>

			{completed.length > 0 && (
				<>
					<CompletedDivider count={completed.length} />
					<div className={GRID}>
						{completed.map((lab) => (
							<LabCard
								key={lab.id}
								done
								lab={lab}
								onOpen={() => router.push(`/labs/view?id=${lab.id}`)}
								onMenu={() => setMenuFor((open) => (open === lab.id ? null : lab.id))}
								menu={menuFor === lab.id && (
									<CardMenu
										title={lab.title}
										onClose={closeMenu}
										onQuiz={() => router.push(`/labs/quiz?id=${lab.id}`)}
										onEdit={() => router.push(`/labs/edit?id=${lab.id}`)}
										onDelete={() => {
											setMenuFor(null)
											setDeleting(lab)
										}}
									/>
								)}
							/>
						))}
					</div>
				</>
			)}

			{deleting && (
				<ConfirmDeleteDialog
					label={deleting.title}
					onCancel={() => setDeleting(null)}
					onConfirm={deleteLab}
				/>
			)}
		</DashboardShell>
	)
}
