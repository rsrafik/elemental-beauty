'use client'

import { LeavePopup, Popup, PopupButton } from '@/components/labs/LabViewParts'
import { DiscardPopup } from '@/components/labs/EditorParts'
import { useUnsavedChanges } from '@/components/LeaveGuard'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDismiss } from '@/lib/dismiss'
import DashboardShell from '@/components/dashboards/DashboardShell'
import { eventCategories, events as eventsApi } from '@/lib/api'
import { isoDate, prettyTimeRange, today } from '@/lib/dates'
import { calendarOnly, capacityField, categoryNameOf, hasMeetingLink, hasNonmemberPrice } from '@/lib/calendar'
import { priceBody, priceInput, priceOk } from '@/lib/finances'
import HideFromEventsToggle from '@/components/events/HideFromEventsToggle'
import { LinksField, cleanLinks } from '@/components/events/EventLinks'
import TeamField from '@/components/events/TeamField'
import { MeetingLinkField } from '@/components/events/MeetingLink'
import { canAddEvents, canChange, hiddenTracks } from '@/lib/roles'
import { useJboardTeams, useRole } from '@/lib/session'
import { doneOpeningNew, wantsNew } from '@/lib/openNew'
import { splitByDate, CompletedDivider, COMPLETED_CARD } from '@/components/CardSections'
import { RsvpButton } from '@/components/events/MemberEvents'
import { CardMenu } from '@/components/labs/OfficerLabs'
import { QrPopup } from '@/components/labs/MemberLabQuiz'
import { COVER_MAX, shrinkImage } from '@/lib/images'
import StoredImage from '@/components/StoredImage'
import { SkeletonGrid } from '@/components/Skeleton'
import { DateField, TimeField } from '@/components/labs/DateTimeField'
import ScrollHint from '@/components/ScrollHint'

// /events for officer / treasurer / admin: every event on one sheet. Clicking
// a card opens its check-in page; the dots in its corner edit it.
//
// j-board signs up for and attends events like a member, the same as labs
// (see OfficerLabs): the rsvp button on an event still to come, and "my QR" on
// one they hold a spot for, for another officer to scan at the door. One
// they're signed up for opens the member's page rather than its check-in.
//
// Same page as /labs for officers — cards with a dots menu, a + in the header,
// one dialog serving both — but the dialog is the calendar's new-event form:
// name, date, time, category, who it's for, description, picture.

// ---- data ------------------------------------------------------------------

// The tag list is a table now, not a constant — officers add to it and remove
// from it on the calendar page, so this page fetches it. Labs are still absent
// from it on purpose: they carry sign-ups and check-in, so they're created from
// /labs instead, and /api/event-categories refuses 'lab' as a tag name.

// Who the event is for. Officers-only, EB-board and j-board events stay off the
// member calendar, and off both events pages — they show on the officer
// calendar only. EB board is j-board and everyone above a member; j-board
// doesn't see the officers' (see hiddenTracks).
const TRACKS = {
	members: 'members',
	officers: 'e-board',
	open: 'open to all',
	online: 'online',
	board: 'EB board',
	jboard: 'j-board',
}

const TRACK_KEYS = Object.keys(TRACKS)
const tracksFor = (role) => TRACK_KEYS.filter((key) => !hiddenTracks(role).includes(key))

// GET /api/events, flattened for the cards. `date` is kept the way the date
// input wants it ('YYYY-MM-DD') so editing prefills instead of re-parsing what
// the card prints.
export function toCard(event) {
	return {
		id: event.eventId,
		title: event.title,
		date: isoDate(event.date),
		time: event.startTime ?? '',
		endTime: event.endTime ?? '',
		categoryId: event.categoryId ?? null,
		track: event.track,
		type: event.type,
		image: event.image,
		description: event.description ?? '',
		capacity: event.capacity ?? null,
		// what someone unpaid is charged at the door (a Decimal, so a string)
		nonmemberPrice: Number(event.nonmemberPrice ?? 0),
		location: event.location ?? '',
		hideFromEvents: event.hideFromEvents ?? false,
		links: event.links ?? [],
		team: event.team ?? '',
		meetingUrl: event.meetingUrl ?? '',
		// seats gone, and where the person looking stands on it — j-board's
		// rsvp button reads both
		taken: event.taken ?? 0,
		mine: event.mine ?? null,
		// "save draft", as on /labs: one never published is a purple card
		// members can't see; a live one can have edits waiting (hasDraft)
		published: event.published !== false,
		hasDraft: Boolean(event.hasDraft),
	}
}

// What the editor's values go to the API as — /events and the calendar send
// the same body. `type` is what the club scores attendance on and the form
// doesn't ask for it (see saveEvent below).
export function eventBody(values) {
	return {
		title: values.title,
		date: values.date,
		startTime: values.time || null,
		endTime: values.time ? values.endTime || null : null,
		categoryId: values.categoryId === '' ? null : Number(values.categoryId),
		track: values.track,
		description: values.description,
		image: values.image,
		// a j-board event has a team instead of a seat cap
		capacity: capacityField(values.track) !== 'spots' || values.spots.trim() === '' ? null : Number(values.spots),
		team: values.track === 'jboard' ? values.team || null : null,
		location: values.location.trim() || null,
		hideFromEvents: values.hideFromEvents,
		links: values.links,
		// the link only where the form asks for one
		meetingUrl: hasMeetingLink(values.track) ? values.meetingUrl.trim() || null : null,
		// and a door price only on a members-only one
		nonmemberPrice: hasNonmemberPrice(values.track) ? priceBody(values.price) : 0,
	}
}

// A card ready for the editor: one with edits saved as a draft has them read
// (the list only says there are some) and laid over it, so the editor opens on
// the draft — it's newer than what's live — the way /labs' editor does.
export async function withDraft(card) {
	if (!card?.hasDraft) return card
	const full = await eventsApi.get(card.id)
	return {
		...toCard({ ...full, ...(full.draft ?? {}) }),
		published: card.published,
		hasDraft: Boolean(full.draft),
		// what members see now, for the pink on boxes the draft changes
		live: toCard(full),
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

function CloseIcon({ className = '' }) {
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

// ---- card ------------------------------------------------------------------

// The member card with one substitution: the corner holds a control instead of
// a status icon.
// `action` is j-board's rsvp row under the card (see rsvpFor on the page).
// The advisor, who edits nothing, gets `onMenu` instead of `onEdit`: the dots
// open `menu`, which only offers "view content".
// Drafts — events members can't see yet — are light purple instead of white,
// the same as /labs' cards; a live one with edits saved as a draft says so
// across its photo.
function EventCard({ title, date, time, endTime, location, image, published = true, hasDraft = false, onOpen, onEdit, onMenu, menu = null, action = null, done = false }) {
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
			${published ? 'bg-white' : 'bg-[#E8DEFF]'}
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
				bg-blue-light/50
			">
				{image && (
					<StoredImage
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
			{published && hasDraft && (
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
			)}

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
						break-words
					">
						{title}
					</p>
					{/* date, time and room, a row each — whichever it has */}
					<div className="mt-1">
						{[prettyDate(date), prettyTimeRange(time, endTime), location].filter(Boolean).map((line) => (
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

				{(onEdit || onMenu) && <button
					type="button"
					onClick={(clicked) => {
						clicked.stopPropagation()
						;(onEdit ?? onMenu)()
					}}
					aria-label={onEdit ? `Edit ${title}` : `${title} options`}
					aria-haspopup={onEdit ? undefined : 'menu'}
					aria-expanded={onEdit ? undefined : Boolean(menu)}
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
				</button>}
			</div>

			{action && (
				<div className="
					mt-3
					flex
					justify-center
				">
					{action}
				</div>
			)}

			{menu}
		</div>
	)
}

// ---- dialog ----------------------------------------------------------------

const FIELD = `
	w-full
	rounded-[10px]
	border
	border-black/25
	bg-white
	px-4
	py-2.5
	font-vietnam
	text-sm
	text-black
	outline-none
	transition-colors
	duration-200
	focus:border-black
`

// a box whose saved draft differs from what members see — /labs' pink
const CHANGED_FIELD = FIELD.replace('bg-white', 'bg-[#FFE0EE]')

// The editor's form, from a card (blank for a new event).
function formOf(event, categories) {
	return {
		title: event?.title ?? '',
		date: event?.date ?? '',
		time: event?.time ?? '',
		endTime: event?.endTime ?? '',
		categoryId: event?.categoryId ?? categories[0]?.categoryId ?? '',
		track: event?.track ?? 'members',
		description: event?.description ?? '',
		spots: event?.capacity == null ? '' : String(event.capacity),
		price: priceInput(event?.nonmemberPrice),
		location: event?.location ?? '',
		hideFromEvents: event?.hideFromEvents ?? false,
		team: event?.team ?? '',
		meetingUrl: event?.meetingUrl ?? '',
	}
}

function Label({ children }) {
	return (
		<span className="
			block
			font-vietnam
			text-[11px]
			uppercase
			tracking-[0.12em]
			text-black/50
			mb-1.5
		">
			{children}
		</span>
	)
}

// Sits on top of the edit dialog, so it needs to clear that layer's z-50.
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
				aria-label="Delete event"
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
					delete event?
				</h2>
				<p className="
					font-vietnam
					text-sm
					text-black/60
					mt-3
				">
					“{label}” and everything on it goes away, rsvps included. This
					can&apos;t be undone.
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

// The dialog's footer buttons: pills that lift on hover, greyed out while
// they can't be pressed.
const PILL = `
	rounded-full
	px-3
	sm:px-6
	py-2
	font-vietnam
	font-semibold
	text-sm
	whitespace-nowrap
	cursor-pointer
	transition-all
	duration-200
	ease-out
	hover:-translate-y-0.5
	hover:shadow-lg
	hover:shadow-black/10
	active:translate-y-0
	active:shadow-none
	disabled:opacity-40
	disabled:cursor-not-allowed
	disabled:hover:translate-y-0
	disabled:hover:shadow-none
`

// Asked when the editor's closed with changes that haven't been saved — the
// same question LeaveGuard asks on the way off a page.
function UnsavedPopup({ onCancel, onConfirm }) {
	return (
		<Popup title="unsaved changes" onClose={onCancel}>
			{(dismissPopup) => (
				<>
					<p className="
						font-vietnam
						text-sm
						text-black/60
						mt-3
					">
						You have changes to this event that haven&apos;t been saved. If you
						close it now, they&apos;ll be lost.
					</p>
					<div className="
						mt-8
						flex
						justify-end
						gap-3
					">
						<PopupButton onClick={() => dismissPopup(onCancel)}>keep editing</PopupButton>
						<PopupButton danger onClick={() => dismissPopup(onConfirm)}>discard</PopupButton>
					</div>
				</>
			)}
		</Popup>
	)
}

// Mounted only while open, so it always starts from whatever `event` it was
// handed — an existing row to edit, or nothing for a new one. Same fields as
// the calendar's new-event dialog.
//
// The picked image is held as an object URL, which is enough to draw it on the
// card. Swap it for the uploaded path once /events is posting to the API.
//
// `onDelete` only comes in when there's an event to delete, which is what puts
// the delete button on the footer.
//
// The footer is /labs' editor's: publish, save draft, discard. `onSave(values,
// published)` takes both saves — `published` false is the draft. Discard asks
// first when there's anything to lose, and throws away a saved draft too
// (`onDiscardDraft`, on an event that has one — see withDraft). Closing any
// other way (the ×, the backdrop, Escape, leaving the page) with changes
// that aren't saved asks before they go.
//
// The officer calendar opens this too, when an event on it is clicked —
// including the ones this page doesn't list, which have nowhere else to edit.
export function EventDialog({ event, categories, onClose, onSave, onDiscardDraft, onDelete }) {
	const role = useRole()
	// dismiss plays the exit animation and then closes for real — lib/dismiss.js
	const { closing, dismiss } = useDismiss()
	const close = () => dismiss(onClose)

	const [form, setForm] = useState(() => formOf(event, categories))
	const [image, setImage] = useState(event?.image ?? null)
	// { title, url } rows, blank ones included while they're being filled in
	const [links, setLinks] = useState(event?.links ?? [])
	const [confirmingDelete, setConfirmingDelete] = useState(false)
	// "discard?" from the discard button, and "unsaved changes" from closing
	const [confirmingDiscard, setConfirmingDiscard] = useState(false)
	const [confirmingClose, setConfirmingClose] = useState(false)

	// what it opened with, to tell whether anything's been changed since —
	// typing something back the way it was counts as no change
	const [initial] = useState(() => ({ form: JSON.stringify(form), image, links: JSON.stringify(links) }))
	const dirty = JSON.stringify(form) !== initial.form || image !== initial.image || JSON.stringify(links) !== initial.links
	// the sidebar, a link, back: asked about the same as closing (LeaveGuard)
	useUnsavedChanges(dirty)

	const hasDraft = Boolean(event?.hasDraft)
	// A live event with a draft saved: each box the draft changes from what
	// members see now is pink inside, as on /labs' editor (fieldClass).
	const live = event?.published && hasDraft && event.live ? formOf(event.live, categories) : null
	const saved = live ? formOf(event, categories) : null
	const box = (key) =>
		live && String(saved[key] ?? '').trim() !== String(live[key] ?? '').trim() ? CHANGED_FIELD : FIELD
	const linksChanged = live && JSON.stringify(event.links ?? []) !== JSON.stringify(event.live.links ?? [])
	const askClose = () => (dirty ? setConfirmingClose(true) : close())
	const askDiscard = () => (dirty || hasDraft ? setConfirmingDiscard(true) : close())

	const set = (field) => (changed) =>
		setForm((prev) => ({ ...prev, [field]: changed.target.value }))

	// Escape closes, same as the backdrop — but not while one of the popups
	// on top is up, or one keypress would dismiss both layers at once.
	useEffect(() => {
		const onKey = (pressed) => {
			if (pressed.key === 'Escape' && !confirmingDelete && !confirmingDiscard && !confirmingClose) askClose()
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	})

	// Read as a data URL rather than an object URL. An object URL only exists
	// for as long as this tab does, so a picture saved that way would come back
	// broken on the next load — a data URL is the actual bytes and survives.
	//
	// It's a stopgap: a photo inlined into a TEXT column is a big row and a big
	// response. It becomes a path the moment there's somewhere to upload to.
	const pickImage = (changed) => {
		const file = changed.target.files?.[0]
		if (!file) return
		// shrunk first — a phone photo is megabytes (see lib/images.js)
		shrinkImage(file, COVER_MAX).then(setImage).catch(() => {})
		// so picking the same file twice still fires a change
		changed.target.value = ''
	}

	// blank = unlimited; anything else has to be a whole number of seats
	// (only an event that asks for spots has them to check — see capacityField)
	const spotsOk = capacityField(form.track) !== 'spots' || form.spots.trim() === '' || (Number.isInteger(Number(form.spots)) && Number(form.spots) > 0)
	// blank, or after the start (the API holds it to the same)
	const endOk = form.endTime === '' || (form.time !== '' && form.endTime > form.time)
	// blank, or dollars and cents (only a members-only event asks)
	const priceFine = !hasNonmemberPrice(form.track) || priceOk(form.price)
	const ready = form.title.trim() !== '' && form.date !== '' && spotsOk && endOk && priceFine

	// publish, or with `published` false save it as a draft. A draft needs
	// the same as publishing: every event has a date, even one not out yet.
	const save = (published) => {
		if (!ready) return
		dismiss(() =>
			onSave({
				...form,
				title: form.title.trim(),
				description: form.description.trim(),
				image,
				links: cleanLinks(links),
			}, published)
		)
	}
	// Enter in a box publishes, as it saved before there were drafts
	const submit = (submitted) => {
		submitted.preventDefault()
		save(true)
	}

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
			onClick={askClose}
		>
			{/* the card swallows clicks so only the backdrop itself closes */}
			<form
				onClick={(clicked) => clicked.stopPropagation()}
				onSubmit={submit}
				role="dialog"
				aria-modal="true"
				aria-label={event ? 'Edit event' : 'New event'}
				className="
					w-full
					max-w-[560px]
					max-h-[90dvh]
					overflow-y-auto
					max-h-[85vh]
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
						{event ? 'edit event' : 'new event'}
					</h2>
					<button
						type="button"
						onClick={askClose}
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

				<p className="
					font-vietnam
					text-sm
					text-black/50
					mt-2
				">
					Labs are scheduled from the labs page, since they need sign-ups and
					check-in.
				</p>
				{/* where this one stands, when it isn't simply live */}
				{event && (!event.published || hasDraft) && (
					<p className="
						mt-3
						rounded-[10px]
						bg-[#E8DEFF]
						px-4
						py-2
						font-vietnam
						text-sm
						text-black/70
					">
						{event.published
							? 'You’re editing a saved draft. Members still see the published version until you publish.'
							: 'This is a draft. Members can’t see it until it’s published.'}
					</p>
				)}

				<div className="
					mt-6
					flex
					flex-col
					gap-4
				">
					<label className="block">
						<Label>name</Label>
						<input
							type="text"
							value={form.title}
							onChange={set('title')}
							placeholder="Glow Night"
							className={box('title')}
						/>
					</label>

					{/* the date takes a third and the two times the rest: a date fits
					    in less than half, and an even split cut the times' AM/PM off */}
					<div className="
						grid
						grid-cols-1
						sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]
						gap-4
					">
						<label className="block">
							<Label>date</Label>
							<DateField
								roomy
								value={form.date}
								onChange={(date) => setForm((prev) => ({ ...prev, date }))}
								className={box('date')}
							/>
						</label>
						{/* start and end side by side in the date's neighbour — the end
						    is optional, and has to come after the start */}
						<div className="
							grid
							grid-cols-2
							gap-2
						">
							<label className="block">
								<Label>time</Label>
								<TimeField
									roomy
									value={form.time}
									onChange={(time) => setForm((prev) => ({ ...prev, time }))}
									className={box('time')}
								/>
							</label>
							<label className="block">
								<Label>ends</Label>
								<TimeField
									roomy
									value={form.endTime}
									onChange={(endTime) => setForm((prev) => ({ ...prev, endTime }))}
									disabled={!form.time}
									title={form.time ? undefined : 'Set a start time first'}
									className={`${box('endTime')} ${endOk ? '' : 'border-red focus:border-red'} disabled:opacity-50`}
								/>
							</label>
						</div>
					</div>

					<div className="
						grid
						grid-cols-1
						sm:grid-cols-2
						gap-4
					">
						<label className="block">
							<Label>category</Label>
							<select
								value={form.categoryId}
								onChange={set('categoryId')}
								className={`${box('categoryId')} cursor-pointer`}
							>
								{categories.map((category) => (
									<option key={category.categoryId} value={category.categoryId}>
										{category.name}
									</option>
								))}
							</select>
						</label>

						{/* decides whether members see it at all — an officers event
						    stays off their calendar */}
						<label className="block">
							<Label>who it&apos;s for</Label>
							<select
								value={form.track}
								onChange={set('track')}
								className={`${box('track')} cursor-pointer`}
							>
								{tracksFor(role).map((key) => (
									<option key={key} value={key}>
										{TRACKS[key]}
									</option>
								))}
							</select>
						</label>
					</div>

					<div className="
						grid
						grid-cols-1
						sm:grid-cols-2
						gap-4
					">
						{/* the whole row when nothing sits beside it */}
						<label className={`block ${capacityField(form.track) === 'none' ? 'sm:col-span-2' : ''}`}>
							<Label>location</Label>
							<input
								type="text"
								value={form.location}
								onChange={set('location')}
								placeholder="WTHR 200"
								className={box('location')}
							/>
						</label>

						{/* board events take no sign-ups, so there's no cap: a
						    j-board one asks which team it's for instead, and an
						    officers or EB board one asks nothing (capacityField).
						    Anything else: optional — set it and rsvps stop at that
						    many, with a waitlist after; blank for no limit */}
						{capacityField(form.track) === 'team' && (
							<TeamField
								value={form.team}
								onChange={(team) => setForm((prev) => ({ ...prev, team }))}
								fieldClass={box('team')}
								Label={Label}
							/>
						)}
						{capacityField(form.track) === 'spots' && (
							<label className="block">
								<Label>available spots</Label>
								<input
									type="number"
									min="1"
									step="1"
									inputMode="numeric"
									value={form.spots}
									onChange={set('spots')}
									placeholder="blank = unlimited"
									className={`${box('spots')} ${spotsOk ? '' : 'border-red focus:border-red'}`}
								/>
							</label>
						)}
						{/* a members-only event charges someone who hasn't paid dues
						    this at the door (hasNonmemberPrice) — blank for nothing */}
						{hasNonmemberPrice(form.track) && (
							<label className="block">
								<Label>non-member price</Label>
								<input
									type="number"
									min="0"
									step="0.01"
									inputMode="decimal"
									value={form.price}
									onChange={set('price')}
									placeholder="$ (blank means free)"
									className={`${box('price')} ${priceFine ? '' : 'border-red focus:border-red'}`}
								/>
							</label>
						)}
					</div>

					{/* where it's held, for an online event or a meeting — the
					    calendar gives it a "join" button (hasMeetingLink) */}
					{hasMeetingLink(form.track) && (
						<MeetingLinkField
							value={form.meetingUrl}
							onChange={(meetingUrl) => setForm((prev) => ({ ...prev, meetingUrl }))}
							fieldClass={box('meetingUrl')}
							Label={Label}
						/>
					)}

					<HideFromEventsToggle
						checked={form.hideFromEvents}
						locked={calendarOnly(form.track, categoryNameOf(categories, form.categoryId))}
						onChange={(hideFromEvents) => setForm((prev) => ({ ...prev, hideFromEvents }))}
					/>

					<label className="block">
						<Label>description</Label>
						<textarea
							value={form.description}
							onChange={set('description')}
							rows={3}
							placeholder="What's happening, where to meet, what to bring."
							className={`${box('description')} resize-none`}
						/>
					</label>

					<div>
						<Label>picture</Label>
						<div className="
							flex
							items-center
							gap-4
						">
							<div className="
								w-20
								h-20
								shrink-0
								rounded-[10px]
								overflow-hidden
								bg-white
								border
								border-black/25
							">
								{image && (
									<StoredImage
										src={image}
										alt=""
										className="
											w-full
											h-full
											object-cover
										"
									/>
								)}
							</div>
							<label className="
								inline-flex
								items-center
								rounded-full
								border
								border-black/70
								px-4
								py-1.5
								font-vietnam
								text-sm
								text-black
								cursor-pointer
								transition-all
								duration-200
								ease-out
								hover:-translate-y-0.5
								hover:shadow-lg
								hover:shadow-black/10
							">
								{image ? 'change picture' : 'choose picture'}
								<input
									type="file"
									accept="image/*"
									onChange={pickImage}
									className="hidden"
								/>
							</label>
						</div>
					</div>

					{/* optional — listed under the picture on the event's page */}
					<LinksField links={links} onChange={setLinks} fieldClass={linksChanged ? CHANGED_FIELD : FIELD} Label={Label} />
				</div>

				{/* delete sits apart from the three on the right, so it can't be
				    hit while reaching for publish. On a phone the three take a row
				    of their own, with delete under them. */}
				<div className="
					mt-8
					flex
					flex-col-reverse
					items-stretch
					gap-3
					sm:flex-row
					sm:items-center
					sm:justify-between
				">
					{onDelete ? (
						<button
							type="button"
							onClick={() => setConfirmingDelete(true)}
							className={`
								${PILL}
								border
								border-red
								text-red
								hover:bg-red
								hover:text-white
							`}
						>
							delete event
						</button>
					) : (
						<span className="hidden sm:block" />
					)}

					<div className="
						flex
						gap-2
						sm:gap-3
					">
						<button
							type="button"
							onClick={askDiscard}
							className={`${PILL} min-w-0 flex-1 sm:flex-none border border-black/70 text-black`}
						>
							discard
						</button>
						<button
							type="button"
							onClick={() => save(false)}
							disabled={!ready}
							title={ready ? undefined : 'A draft needs a name and a date'}
							className={`${PILL} min-w-0 flex-1 sm:flex-none border border-[#7A5CC8] text-[#5B3FA8] bg-[#E8DEFF]`}
						>
							save draft
						</button>
						<button
							type="submit"
							disabled={!ready}
							className={`${PILL} min-w-0 flex-1 sm:flex-none bg-blue text-white`}
						>
							publish
						</button>
					</div>
				</div>

				{confirmingDelete && (
					<ConfirmDeleteDialog
						label={event.title}
						onCancel={() => setConfirmingDelete(false)}
						onConfirm={onDelete}
					/>
				)}
				{/* the discard button: what's unsaved goes, and a saved draft
				    with it — the live event stays as it is */}
				{confirmingDiscard && (
					<DiscardPopup
						onCancel={() => setConfirmingDiscard(false)}
						onConfirm={() => {
							setConfirmingDiscard(false)
							if (hasDraft && onDiscardDraft) dismiss(onDiscardDraft)
							else close()
						}}
					/>
				)}
				{/* closing any other way: only what's unsaved goes */}
				{confirmingClose && (
					<UnsavedPopup
						onCancel={() => setConfirmingClose(false)}
						onConfirm={() => {
							setConfirmingClose(false)
							close()
						}}
					/>
				)}
				<ScrollHint />
			</form>
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
// the same columns as a map, for the placeholders' diagonal (Skeleton.js)
const GRID_COLS = { base: 2, lg: 3, xl: 4, '2xl': 5 }

// ---- page ------------------------------------------------------------------

export default function OfficerEvents() {
	const router = useRouter()
	// the advisor sees every event and edits none: no +, and dots that only
	// offer "view content" — the event as a VIP sees it, without the rsvp.
	// J-board's treasury team doesn't get the + either (canAddEvents).
	const role = useRole()
	const changes = canChange(role)
	const adds = canAddEvents(role, useJboardTeams())
	const signsUp = role === 'jboard'
	// the advisor's card whose dots menu is open
	const [menuFor, setMenuFor] = useState(null)
	const closeMenu = useCallback(() => setMenuFor(null), [])
	// events with an rsvp on its way, so a double click can't send two
	const [rsvping, setRsvping] = useState(() => new Set())
	// the event j-board's leaving, while LeavePopup asks
	const [leaving, setLeaving] = useState(null)
	// j-board's check-in code, up for an officer to scan
	const [showQr, setShowQr] = useState(false)
	const [events, setEvents] = useState([])
	// false until the list is in — placeholders until then (Skeleton.js)
	const [loaded, setLoaded] = useState(false)
	const [categories, setCategories] = useState([])
	const [error, setError] = useState(null)

	// null = closed. { event: null } opens an empty dialog, { event } loads that
	// row into it — one dialog serving both the + and the dots. The dashboard's
	// "New Event" arrives with it already open (lib/openNew.js).
	const [editing, setEditing] = useState(() => (wantsNew('events') && adds ? { event: null } : null))
	useEffect(() => doneOpeningNew('events'), [])

	const closeEditor = () => setEditing(null)
	// the dots: the editor, on the saved draft if the event has one
	const openEditor = async (row) => {
		setError(null)
		try {
			setEditing({ event: await withDraft(row) })
		} catch (err) {
			setError(err.message)
		}
	}

	useEffect(() => {
		let live = true
		Promise.all([eventsApi.list(), eventCategories.list()])
			.then(([rows, tags]) => {
				if (!live) return
				setEvents(rows.map(toCard))
				setCategories(tags)
			})
			.catch((err) => live && setError(err.message))
			.finally(() => live && setLoaded(true))
		return () => { live = false }
	}, [])

	// j-board's rsvp: signing up, leaving (a seat or the waitlist), or taking
	// an offered spot — the same calls a member's card makes — then the list
	// is re-read for where they've landed and the seat count.
	//
	// Leaving asks first (LeavePopup) and comes back here with `confirmed`.
	const toggleRsvp = async (row, confirmed = null) => {
		if (rsvping.has(row.id)) return
		if ((row.mine === 'rsvped' || row.mine === 'waitlisted') && !confirmed) {
			setLeaving(row)
			return
		}
		setRsvping((prev) => new Set(prev).add(row.id))
		setError(null)
		try {
			if (row.mine === 'rsvped' || row.mine === 'waitlisted') await eventsApi.unrsvp(row.id)
			else await eventsApi.rsvp(row.id)
			setEvents((await eventsApi.list()).map(toCard))
		} catch (err) {
			setError(err.message)
		} finally {
			setRsvping((prev) => {
				const next = new Set(prev)
				next.delete(row.id)
				return next
			})
		}
	}

	// the advisor's dots: "view content", the event as a VIP sees it
	const advisorMenu = (row) => role === 'advisor' ? {
		onMenu: () => setMenuFor((open) => (open === row.id ? null : row.id)),
		menu: menuFor === row.id && (
			<CardMenu
				title={row.title}
				onClose={closeMenu}
				previewLabel="view content"
				onPreview={() => router.push(`/events/preview?id=${row.id}`)}
			/>
		),
	} : {}

	// j-board's row under a card, as on /labs: the rsvp button on an event
	// that hasn't reached its day, and "my QR" on one they hold a spot for,
	// from sign-up through the event's own day (on the day it's the only
	// button — sign-ups are the door's business by then)
	const rsvpFor = (row) => {
		// nobody signs up for a draft
		if (!signsUp || !row.published || row.date < today()) return null
		const upcoming = row.date > today()
		const holding = row.mine === 'rsvped' || row.mine === 'offered'
		if (!upcoming && !holding && row.mine !== 'attended') return null
		return (
			<div className="
				flex
				flex-wrap
				items-center
				justify-center
				gap-2
			">
				{(upcoming || row.mine === 'attended') && (
					<span onClick={(clicked) => clicked.stopPropagation()}>
						<RsvpButton
							going={row.mine === 'rsvped' || row.mine === 'waitlisted'}
							waitlist={row.mine === 'waitlisted' || (row.mine !== 'rsvped' && row.capacity != null && row.taken >= row.capacity)}
							offered={row.mine === 'offered'}
							attended={row.mine === 'attended'}
							onClick={() => toggleRsvp(row)}
						/>
					</span>
				)}
				{holding && (
					<button
						type="button"
						onClick={(clicked) => {
							// the card underneath opens the event's page
							clicked.stopPropagation()
							setShowQr(true)
						}}
						className="
							rounded-full
							border
							border-black/25
							px-4
							py-1.5
							font-vietnam
							font-semibold
							text-sm
							text-[#FF7C45]
							cursor-pointer
							transition-all
							duration-200
							ease-out
							hover:-translate-y-0.5
							hover:border-black/60
							active:translate-y-0
						"
					>
						my QR
					</button>
				)}
			</div>
		)
	}

	// Confirming a delete takes the event out and closes both layers at once,
	// since the dialog it was opened from no longer has anything to edit.
	//
	// The API goes first rather than the card: deleting cascades to every RSVP
	// on it, so a row vanishing and then coming back because the call was
	// refused is worse than a beat's wait.
	const deleteEvent = async () => {
		const target = editing.event
		setError(null)
		try {
			await eventsApi.remove(target.id)
			setEvents((prev) => prev.filter((row) => row.id !== target.id))
		} catch (err) {
			setError(err.message)
		}
		closeEditor()
	}

	// `type` is what the club scores attendance on — official events are worth
	// more than socials — and the form doesn't ask for it, so a new event takes
	// 'social' and an edit leaves whatever it had. The tag the form *does* ask
	// for is the calendar's label and a separate thing entirely.
	//
	// `published` false saves it as a draft: a new one, or one never
	// published, stays a purple card members can't see; on a live one the
	// edits are parked and the card says so (see PUT /api/events/:id).
	const saveEvent = async (values, published = true) => {
		const target = editing.event
		const body = { ...eventBody(values), published }

		setError(null)
		try {
			if (target) {
				const saved = await eventsApi.update(target.id, body)
				setEvents((prev) => prev.map((row) => (row.id === target.id ? toCard(saved) : row)))
			} else {
				const created = await eventsApi.create({ ...body, type: 'social' })
				setEvents((prev) => [...prev, toCard(created)])
			}
		} catch (err) {
			setError(err.message)
		}
		closeEditor()
	}

	// discard on a live event with a draft saved: the draft goes, the event
	// stays as members see it
	const discardDraft = async () => {
		const target = editing.event
		setError(null)
		try {
			const saved = await eventsApi.update(target.id, { discardDraft: true })
			setEvents((prev) => prev.map((row) => (row.id === target.id ? toCard(saved) : row)))
		} catch (err) {
			setError(err.message)
		}
		closeEditor()
	}

	// Board and meeting events are calendar-only (see calendarOnly), and so is
	// anything with "hide from events" switched on. Dropped here rather than on
	// load, so one saved that way leaves the sheet the moment the form closes.
	// A draft stays here whatever it is until it's published or discarded —
	// one never published (the calendar doesn't show those, so this is the
	// only place to find it again), and edits saved as a draft on a live one,
	// even a calendar-only one whose draft was saved from the calendar.
	const listed = events.filter((row) =>
		!row.published || row.hasDraft || (!row.hideFromEvents && !calendarOnly(row.track, categoryNameOf(categories, row.categoryId)))
	)

	// coming up (or today) first, then what's already happened, greyed out
	const { upcoming, completed } = splitByDate(listed)

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
					ALL EVENTS
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
				{adds && <button
					type="button"
					onClick={() => setEditing({ event: null })}
					aria-label="New event"
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
				</button>}
			</div>

			{!loaded && <SkeletonGrid className={GRID} cols={GRID_COLS} count={10} card={{ tint: 'bg-blue-light/50' }} />}
			<div className={GRID}>
				{upcoming.map((row) => (
					<EventCard
						key={row.id}
						title={row.title}
						date={row.date}
						time={row.time}
						endTime={row.endTime}
						location={row.location}
						image={row.image}
						published={row.published}
						hasDraft={row.hasDraft}
						onOpen={() => router.push(`/events/view?id=${row.id}`)}
						onEdit={changes ? () => openEditor(row) : null}
						{...advisorMenu(row)}
						action={rsvpFor(row)}
					/>
				))}
			</div>

			{completed.length > 0 && (
				<>
					<CompletedDivider count={completed.length} />
					<div className={GRID}>
						{completed.map((row) => (
							<EventCard
								key={row.id}
								done
								title={row.title}
								date={row.date}
								time={row.time}
								endTime={row.endTime}
								location={row.location}
								image={row.image}
								published={row.published}
								hasDraft={row.hasDraft}
								onOpen={() => router.push(`/events/view?id=${row.id}`)}
								onEdit={changes ? () => openEditor(row) : null}
								{...advisorMenu(row)}
							/>
						))}
					</div>
				</>
			)}

			{showQr && (
				<QrPopup
					note="Show this to another officer at the door to check you in."
					onClose={() => setShowQr(false)}
				/>
			)}

			{editing && (
				<EventDialog
					event={editing.event}
					categories={categories}
					onClose={closeEditor}
					onSave={saveEvent}
					onDiscardDraft={discardDraft}
					onDelete={editing.event ? deleteEvent : undefined}
				/>
			)}
			{leaving && (
				<LeavePopup
					title={leaving.title}
					mine={leaving.mine}
					place={{ eventId: leaving.id }}
					onConfirm={() => {
						setLeaving(null)
						toggleRsvp(leaving, { ok: true })
					}}
					onClose={() => setLeaving(null)}
				/>
			)}
		</DashboardShell>
	)
}
