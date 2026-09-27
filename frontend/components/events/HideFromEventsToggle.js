'use client'

// The event editor's "hide from events" switch, shared by the /events dialog
// and the calendar's new-event dialog. On, and the event stays on the calendar
// but is left off both /events pages, whoever it's for and whatever its tag.
//
// `locked` is for an event that's kept off regardless — a meeting, or one for
// the board (see calendarOnly in lib/calendar.js). The switch shows on and
// can't be turned off, so it never claims the event will list when it won't.
export default function HideFromEventsToggle({ checked, locked = false, onChange }) {
	const on = checked || locked
	return (
		<div className="
			flex
			items-start
			justify-between
			gap-4
		">
			<span className="min-w-0">
				<span className="
					block
					font-vietnam
					text-[11px]
					uppercase
					tracking-[0.12em]
					text-black/50
				">
					hide from events
				</span>
				<span className="
					block
					mt-1
					font-vietnam
					text-sm
					text-black/55
				">
					{locked
						? 'Meetings and board events are always calendar-only.'
						: 'Only shows on the calendar, not the events page.'}
				</span>
			</span>
			<button
				type="button"
				role="switch"
				aria-checked={on}
				aria-label="Hide from events"
				disabled={locked}
				onClick={() => onChange(!checked)}
				className={`
					relative
					mt-0.5
					w-11
					h-6
					shrink-0
					rounded-full
					transition-colors
					duration-200
					ease-out
					${locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
					${on ? 'bg-green' : 'bg-black/20'}
				`}
			>
				<span className={`
					absolute
					top-0.5
					left-0.5
					w-5
					h-5
					rounded-full
					bg-white
					shadow-[0_1px_3px_rgba(0,0,0,0.3)]
					transition-transform
					duration-200
					ease-out
					${on ? 'translate-x-5' : ''}
				`} />
			</button>
		</div>
	)
}
