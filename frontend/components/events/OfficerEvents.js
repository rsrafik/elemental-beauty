'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDismiss } from '@/lib/dismiss'
import DashboardShell from '@/components/dashboards/DashboardShell'
import { eventCategories, events as eventsApi } from '@/lib/api'
import { isoDate, prettyTime } from '@/lib/dates'

// /events for officer / treasurer / admin: every event on one sheet. Clicking
// a card opens its check-in page; the dots in its corner edit it.
//
// Same page as /labs for officers — cards with a dots menu, a + in the header,
// one dialog serving both — but the dialog is the calendar's new-event form:
// name, date, time, category, who it's for, description, picture.

// ---- data ------------------------------------------------------------------

// The tag list is a table now, not a constant — officers add to it and remove
// from it on the calendar page, so this page fetches it. Labs are still absent
// from it on purpose: they carry sign-ups and check-in, so they're created from
// /labs instead, and /api/event-categories refuses 'lab' as a tag name.

// Who the event is for. Officers-only events stay off the member calendar.
const TRACKS = {
	members: 'members',
	officers: 'officers',
	open: 'open to all',
	online: 'online',
}

const TRACK_KEYS = Object.keys(TRACKS)

// GET /api/events, flattened for the cards. `date` is kept the way the date
// input wants it ('YYYY-MM-DD') so editing prefills instead of re-parsing what
// the card prints.
function toCard(event) {
	return {
		id: event.eventId,
		title: event.title,
		date: isoDate(event.date),
		time: event.startTime ?? '',
		categoryId: event.categoryId ?? null,
		track: event.track,
		type: event.type,
		image: event.image,
		description: event.description ?? '',
		capacity: event.capacity ?? null,
		location: event.location ?? '',
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
function EventCard({ title, date, time, location, image, onOpen, onEdit }) {
	return (
		<div
			role="link"
			tabIndex={0}
			onClick={onOpen}
			onKeyDown={(event) => {
				if (event.key === 'Enter') onOpen()
			}}
			className="
			group
			relative
			bg-white
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
		"
		>
			<div className="
				aspect-[4/3]
				w-full
				overflow-hidden
				rounded-[10px]
				bg-blue-light/50
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
					onClick={(clicked) => {
						clicked.stopPropagation()
						onEdit()
					}}
					aria-label={`Edit ${title}`}
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

// Mounted only while open, so it always starts from whatever `event` it was
// handed — an existing row to edit, or nothing for a new one. Same fields as
// the calendar's new-event dialog.
//
// The picked image is held as an object URL, which is enough to draw it on the
// card. Swap it for the uploaded path once /events is posting to the API.
//
// `onDelete` only comes in when there's an event to delete, which is what puts
// the delete button on the footer.
function EventDialog({ event, categories, onClose, onSave, onDelete }) {
	// dismiss plays the exit animation and then closes for real — lib/dismiss.js
	const { closing, dismiss } = useDismiss()
	const close = () => dismiss(onClose)

	const [form, setForm] = useState({
		title: event?.title ?? '',
		date: event?.date ?? '',
		time: event?.time ?? '',
		categoryId: event?.categoryId ?? categories[0]?.categoryId ?? '',
		track: event?.track ?? 'members',
		description: event?.description ?? '',
		spots: event?.capacity == null ? '' : String(event.capacity),
		location: event?.location ?? '',
	})
	const [image, setImage] = useState(event?.image ?? null)
	const [confirmingDelete, setConfirmingDelete] = useState(false)

	const set = (field) => (changed) =>
		setForm((prev) => ({ ...prev, [field]: changed.target.value }))

	// Escape closes, same as the backdrop — but not while the delete
	// confirmation is up, or one keypress would dismiss both layers at once.
	useEffect(() => {
		const onKey = (pressed) => {
			if (pressed.key === 'Escape' && !confirmingDelete) close()
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
		const reader = new FileReader()
		reader.onload = () => setImage(reader.result)
		reader.readAsDataURL(file)
		// so picking the same file twice still fires a change
		changed.target.value = ''
	}

	// blank = unlimited; anything else has to be a whole number of seats
	const spotsOk = form.spots.trim() === '' || (Number.isInteger(Number(form.spots)) && Number(form.spots) > 0)
	const ready = form.title.trim() !== '' && form.date !== '' && spotsOk

	const submit = (submitted) => {
		submitted.preventDefault()
		if (!ready) return
		dismiss(() =>
			onSave({
				...form,
				title: form.title.trim(),
				description: form.description.trim(),
				image,
			})
		)
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
			onClick={close}
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

				<p className="
					font-vietnam
					text-sm
					text-black/50
					mt-2
				">
					Labs are scheduled from the labs page — they need sign-ups and
					check-in.
				</p>

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
							className={FIELD}
						/>
					</label>

					<div className="
						grid
						grid-cols-1
						sm:grid-cols-2
						gap-4
					">
						<label className="block">
							<Label>date</Label>
							<input
								type="date"
								value={form.date}
								onChange={set('date')}
								className={FIELD}
							/>
						</label>
						<label className="block">
							<Label>time</Label>
							<input
								type="time"
								value={form.time}
								onChange={set('time')}
								className={FIELD}
							/>
						</label>
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
								className={`${FIELD} cursor-pointer`}
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
								className={`${FIELD} cursor-pointer`}
							>
								{TRACK_KEYS.map((key) => (
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
						<label className="block">
							<Label>location</Label>
							<input
								type="text"
								value={form.location}
								onChange={set('location')}
								placeholder="WTHR 200"
								className={FIELD}
							/>
						</label>

						{/* optional: set it and rsvps stop at that many, with a
						    waitlist after; leave it blank for no limit */}
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
								className={`${FIELD} ${spotsOk ? '' : 'border-red focus:border-red'}`}
							/>
						</label>
					</div>

					<label className="block">
						<Label>description</Label>
						<textarea
							value={form.description}
							onChange={set('description')}
							rows={3}
							placeholder="What's happening, where to meet, what to bring."
							className={`${FIELD} resize-none`}
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
									<img
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
				</div>

				{/* delete sits apart from the pair on the right, so it can't be hit
				    while reaching for save */}
				<div className="
					mt-8
					flex
					items-center
					justify-between
					gap-3
				">
					{onDelete ? (
						<button
							type="button"
							onClick={() => setConfirmingDelete(true)}
							className="
								rounded-full
								border
								border-red
								px-6
								py-2
								font-vietnam
								font-semibold
								text-sm
								text-red
								cursor-pointer
								transition-all
								duration-200
								ease-out
								hover:bg-red
								hover:text-white
								hover:-translate-y-0.5
								hover:shadow-lg
								hover:shadow-black/10
								active:translate-y-0
								active:shadow-none
							"
						>
							delete event
						</button>
					) : (
						<span />
					)}

					<div className="
						flex
						gap-3
					">
						<button
							type="button"
							onClick={close}
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
							type="submit"
							disabled={!ready}
							className={`
								rounded-full
								px-6
								py-2
								font-vietnam
								font-semibold
								text-sm
								transition-all
								duration-200
								ease-out
								${ready
									? `bg-blue
									   text-white
									   cursor-pointer
									   hover:-translate-y-0.5
									   hover:shadow-lg
									   hover:shadow-black/20
									   active:translate-y-0
									   active:shadow-none`
									: 'bg-black/10 text-black/40 cursor-not-allowed'}
							`}
						>
							{event ? 'save changes' : 'add event'}
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
			</form>
		</div>
	)
}

// ---- page ------------------------------------------------------------------

export default function OfficerEvents({ openNew = false }) {
	const router = useRouter()
	const [events, setEvents] = useState([])
	const [categories, setCategories] = useState([])
	const [error, setError] = useState(null)

	// null = closed. { event: null } opens an empty dialog, { event } loads that
	// row into it — one dialog serving both the + and the dots.
	const [editing, setEditing] = useState(openNew ? { event: null } : null)

	// Closing the form takes `?new` back off the URL, so a refresh doesn't
	// reopen something you just dismissed. Done on close rather than on arrival
	// because the parameter is what seeds the state above — stripping it the
	// moment the page mounts would race that.
	const closeEditor = () => {
		setEditing(null)
		if (openNew) router.replace('/events')
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
		return () => { live = false }
	}, [])

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
	const saveEvent = async (values) => {
		const target = editing.event
		const body = {
			title: values.title,
			date: values.date,
			startTime: values.time || null,
			categoryId: values.categoryId === '' ? null : Number(values.categoryId),
			track: values.track,
			description: values.description,
			image: values.image,
			capacity: values.spots.trim() === '' ? null : Number(values.spots),
			location: values.location.trim() || null,
		}

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
				<button
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
				</button>
			</div>

			<div className="
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
			">
				{events.map((row) => (
					<EventCard
						key={row.id}
						title={row.title}
						date={row.date}
						time={row.time}
						location={row.location}
						image={row.image}
						onOpen={() => router.push(`/events/view?id=${row.id}`)}
						onEdit={() => setEditing({ event: row })}
					/>
				))}
			</div>

			{editing && (
				<EventDialog
					event={editing.event}
					categories={categories}
					onClose={closeEditor}
					onSave={saveEvent}
					onDelete={editing.event ? deleteEvent : undefined}
				/>
			)}
		</DashboardShell>
	)
}
