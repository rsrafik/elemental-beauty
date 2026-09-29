'use client'

import { useEffect } from 'react'
import { useDismiss } from '@/lib/dismiss'
import { longDate, prettyTimeRange } from '@/lib/dates'
import { LinkList } from '@/components/events/EventLinks'
import { capacityField, teamLabel } from '@/lib/calendar'

// What the officer calendar opens instead of the editor when the event isn't
// yours to change: a j-board event an officer, treasurer or admin added, seen
// by j-board (the API's `canEdit` is false — see lockedFor in eventRoutes.js).
// Everything its creator filled in, read-only, and who that was.
//
// `event` is the row straight off GET /api/events; `trackLabel` is how the
// calendar writes its track ('j-board'), so the two can't disagree.
export default function EventDetailsDialog({ event, trackLabel, onClose }) {
	const { closing, dismiss } = useDismiss()
	const close = () => dismiss(onClose)

	useEffect(() => {
		const onKey = (pressed) => {
			if (pressed.key === 'Escape') close()
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	})

	const when = [longDate(event.date), prettyTimeRange(event.startTime, event.endTime)].filter(Boolean).join(' · ')
	const rows = [
		['when', when],
		['where', event.location],
		['who it’s for', trackLabel],
		// a j-board event has a team where anything else has a seat cap, and
		// an officers or EB board one has neither (capacityField)
		capacityField(event.track) === 'team'
			? ['team', event.team ? teamLabel(event.team) : 'all of j-board']
			: capacityField(event.track) === 'spots'
				? ['spots', event.capacity == null ? 'unlimited' : String(event.capacity)]
				: [],
	].filter(([, value]) => value)

	return (
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
			{/* the card swallows clicks so only the backdrop itself closes */}
			<div
				onClick={(clicked) => clicked.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-label={event.title}
				className="
					w-full
					max-w-[520px]
					max-h-[85dvh]
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
					<div className="min-w-0">
						{event.category?.name && (
							<p className="
								font-vietnam
								text-[11px]
								uppercase
								tracking-[0.12em]
								text-black/50
							">
								{event.category.name}
							</p>
						)}
						<h2 className="
							font-beachday
							text-black
							text-[34px]
							leading-none
							mt-1
							break-words
						">
							{event.title}
						</h2>
					</div>
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
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2.5"
							strokeLinecap="round"
							className="w-4 h-4"
							aria-hidden="true"
						>
							<path d="M6 6l12 12M18 6L6 18" />
						</svg>
					</button>
				</div>

				{event.image && (
					<img
						src={event.image}
						alt=""
						className="
							mt-5
							w-full
							max-h-[220px]
							object-cover
							rounded-[12px]
						"
					/>
				)}

				<LinkList links={event.links} className="mt-4" />

				<dl className="
					mt-5
					grid
					grid-cols-[auto_1fr]
					gap-x-5
					gap-y-2
				">
					{rows.map(([label, value]) => (
						<div key={label} className="contents">
							<dt className="
								font-vietnam
								text-[11px]
								uppercase
								tracking-[0.12em]
								text-black/50
								pt-0.5
							">
								{label}
							</dt>
							<dd className="
								font-vietnam
								text-sm
								text-black
							">
								{value}
							</dd>
						</div>
					))}
				</dl>

				{event.description && (
					<p className="
						mt-5
						font-vietnam
						text-sm
						text-black/80
						whitespace-pre-line
					">
						{event.description}
					</p>
				)}

				{/* why there's no edit button: an officer, treasurer or admin added
				    it, so it's theirs to change, not j-board's */}
				<p className="
					mt-6
					pt-4
					border-t
					border-black/15
					font-vietnam
					text-xs
					text-black/50
				">
					{event.creatorName ? `Added by ${event.creatorName}. ` : ''}
					Only officers and up can change it.
				</p>
			</div>
		</div>
	)
}
