'use client'

// An event's meeting link (meetingUrl) — its Zoom or Meet address. Two
// halves:
//
//   MeetingLinkField     the event forms' box for it, shown only while the
//                        event is online or a meeting — officers, EB board,
//                        j-board (hasMeetingLink in lib/calendar; the API
//                        drops it on any other track, and puts https:// on
//                        one typed without it)
//   JoinMeetingButton    the "join" pill the calendar gives an entry
//                        that has one, opening it in a new tab

// `fieldClass` and `Label` are the form's own, so it matches the fields
// around it.
export function MeetingLinkField({ value, onChange, fieldClass, Label }) {
	return (
		<label className="block">
			<Label>meeting link</Label>
			<input
				type="text"
				inputMode="url"
				value={value}
				onChange={(changed) => onChange(changed.target.value)}
				placeholder="https://zoom.us/j/..."
				className={fieldClass}
			/>
		</label>
	)
}

function VideoIcon({ className = '' }) {
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
			<rect x="3" y="6" width="12" height="12" rx="2.5" />
			<path d="M15 10.5l6-3.5v10l-6-3.5" />
		</svg>
	)
}

// A link rather than a button, so it opens like any other and can be
// copied. Clicks stop here: on the staff calendar it sits beside an entry
// that opens the event's dialog when clicked.
//
// `tone` is the background and text classes — the calendar passes the
// event's track pill, so it's the colour of the day's badge for that track.
export function JoinMeetingButton({ url, tone = 'bg-blue text-white', className = '' }) {
	if (!url) return null
	return (
		<a
			href={url}
			target="_blank"
			rel="noopener noreferrer"
			onClick={(clicked) => clicked.stopPropagation()}
			className={`
				inline-flex
				items-center
				gap-1
				rounded-full
				${tone}
				px-2.5
				py-1
				font-vietnam
				font-semibold
				text-[11px]
				leading-none
				whitespace-nowrap
				transition-all
				duration-150
				ease-out
				hover:-translate-y-0.5
				hover:shadow-md
				hover:shadow-black/20
				active:translate-y-0
				active:shadow-none
				${className}
			`}
		>
			<VideoIcon className="w-3 h-3 shrink-0" />
			join
		</a>
	)
}
