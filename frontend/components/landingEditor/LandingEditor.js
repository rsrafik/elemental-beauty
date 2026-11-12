'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import DashboardShell from '@/components/dashboards/DashboardShell'
import StoredImage from '@/components/StoredImage'
import { Card, CardNote, CardTitle, ConfirmDialog, Dialog, DialogActions, FIELD, Label, PlusIcon, TrashIcon } from '@/components/analytics/parts'
import { DateField } from '@/components/labs/DateTimeField'
import { landing as landingApi } from '@/lib/api'
import { useDismiss } from '@/lib/dismiss'
import { useImageCrop } from '@/components/ImageCropper'
import { FRAMES } from '@/lib/images'
import { canChange } from '@/lib/roles'

// /landing-editor: what the public landing page (/landing) shows, for an admin
// to keep. Three cards, one per section that has placeholders today:
//
//   the people   under "who we are": title (required — the rail shows it
//                before they're clicked), name, description, picture
//   the album    the deck of cards: title and photo (required), date,
//                description; one card on the page per card here
//   sponsors     the pills: a picture behind a title (one of the two
//                required) and a website the pill opens in a new tab. Or
//                connect a sponsor the sponsors page already has.
//
// Each section runs in the order its cards are in here: drag a card by the
// dots in its corner (or focus them and use the arrow keys) — useReorder.
//
// A section with nothing here keeps its placeholders on the page; anything
// optional left empty is left off. The server holds the same rules
// (src/routes/landingRoutes.js), and only an admin can save — the advisor
// reads it all.

// ---- the form every item opens in ------------------------------------------

// `fields`: [{ key, label, kind: 'text' | 'textarea' | 'date' | 'image',
// placeholder?, max? }]. `check(values)` is what's still missing (a sentence)
// or null when it's ready to save.
function ItemDialog({ title, note, fields, initial, check, onSave, onClose, submitLabel }) {
	const { closing, dismiss } = useDismiss()
	const close = () => dismiss(onClose)
	const [values, setValues] = useState(initial)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState(null)
	const set = (key, value) => setValues((was) => ({ ...was, [key]: value }))

	const missing = check(values)
	const ready = !missing && !busy

	const submit = async (event) => {
		event.preventDefault()
		if (!ready) return
		setBusy(true)
		setError(null)
		try {
			await onSave(values)
			dismiss(onClose)
		} catch (err) {
			setError(err.message)
			setBusy(false)
		}
	}

	return (
		<Dialog title={title} note={note} onClose={close} onSubmit={submit} closing={closing} width="max-w-[500px]">
			<div className="
				mt-6
				flex
				flex-col
				gap-4
			">
				{fields.map((field) => (
					<Field
						key={field.key}
						field={field}
						value={values[field.key]}
						onChange={(value) => set(field.key, value)}
						onError={setError}
					/>
				))}

				{(error || missing) && (
					<p className={`
						font-vietnam
						text-sm
						${error ? 'text-salmon-dark' : 'text-black/45'}
					`}>
						{error || missing}
					</p>
				)}
			</div>

			<DialogActions
				onCancel={close}
				submitLabel={busy ? 'saving…' : submitLabel}
				ready={ready}
			/>
		</Dialog>
	)
}

function Field({ field, value, onChange, onError }) {
	if (field.kind === 'image') return <PictureField field={field} value={value} onChange={onChange} onError={onError} />
	if (field.kind === 'date') {
		return (
			<div>
				<Label>{field.label}</Label>
				<DateField value={value ?? ''} onChange={onChange} aria-label={field.label} />
			</div>
		)
	}
	const Input = field.kind === 'textarea' ? 'textarea' : 'input'
	return (
		<label className="block">
			<Label>{field.label}</Label>
			<Input
				type={Input === 'input' ? 'text' : undefined}
				value={value ?? ''}
				onChange={(event) => onChange(event.target.value)}
				maxLength={field.max}
				placeholder={field.placeholder}
				rows={Input === 'textarea' ? 4 : undefined}
				className={`${FIELD} ${Input === 'textarea' ? 'resize-y' : ''}`}
			/>
		</label>
	)
}

// `field.frame` is the frame (lib/images.js FRAMES) the picture is shown in on
// the landing page: a picked picture is cropped to its shape first, and the
// thumbnail here has that shape too.
function PictureField({ field, value, onChange, onError }) {
	const picker = useRef(null)
	const [crop, cropper] = useImageCrop()

	const pick = async (event) => {
		const file = event.target.files?.[0]
		event.target.value = ''
		if (!file) return
		try {
			const url = await crop(file, field.frame)
			if (url) onChange(url)
		} catch (err) {
			onError(err.message)
		}
	}

	return (
		<div>
			<Label>{field.label}</Label>
			<div className="
				flex
				items-center
				gap-4
			">
				<button
					type="button"
					onClick={() => picker.current?.click()}
					aria-label={value ? 'Change the picture' : 'Add a picture'}
					style={field.frame.aspect >= 1
						? { width: '9rem', aspectRatio: field.frame.aspect }
						: { height: '7rem', aspectRatio: field.frame.aspect }}
					className="
						shrink-0
						flex
						items-center
						justify-center
						rounded-[10px]
						overflow-hidden
						bg-white
						border
						border-dashed
						border-black/30
						cursor-pointer
						hover:border-black
					"
				>
					{value
						? <StoredImage src={value} alt="" className="w-full h-full object-cover" />
						: <PlusIcon className="w-6 h-6 text-black/35" />}
				</button>
				<div className="
					font-vietnam
					text-xs
					text-black/50
				">
					{field.hint}
					{value && !field.required && (
						<>
							<br />
							<button
								type="button"
								onClick={() => onChange(null)}
								className="
									mt-1
									underline
									underline-offset-2
									cursor-pointer
									hover:text-black
								"
							>
								remove it
							</button>
						</>
					)}
				</div>
				<input ref={picker} type="file" accept="image/*" onChange={pick} className="hidden" />
				{cropper}
			</div>
		</div>
	)
}

// ---- the pieces of each card -----------------------------------------------

function AddButton({ onClick, children }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="
				inline-flex
				items-center
				gap-2
				rounded-full
				bg-salmon
				px-4
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
			"
		>
			<PlusIcon className="w-4 h-4" />
			{children}
		</button>
	)
}

function CardHead({ title, note, children }) {
	return (
		<div className="
			flex
			flex-wrap
			items-start
			justify-between
			gap-4
		">
			<div className="max-w-[60ch]">
				<CardTitle>{title}</CardTitle>
				<CardNote>{note}</CardNote>
			</div>
			<div className="
				flex
				flex-wrap
				items-center
				gap-3
			">
				{children}
			</div>
		</div>
	)
}

function Empty({ children }) {
	return (
		<p className="
			mt-6
			font-vietnam
			text-sm
			text-black/45
		">
			{children}
		</p>
	)
}

function SmallButton({ onClick, label, disabled, danger = false, children }) {
	return (
		<button
			type="button"
			data-no-drag
			onClick={onClick}
			disabled={disabled}
			aria-label={label}
			title={label}
			className={`
				w-7
				h-7
				inline-flex
				items-center
				justify-center
				rounded-full
				cursor-pointer
				transition-colors
				disabled:opacity-30
				disabled:cursor-default
				${danger
					? 'bg-salmon-lightest text-salmon-dark hover:bg-red hover:text-white'
					: 'bg-white text-black/60 hover:bg-black hover:text-white'}
			`}
		>
			{children}
		</button>
	)
}

// ---- dragging the cards into order -----------------------------------------
//
// A card is picked up anywhere on it and follows the pointer; the others move
// out of its way as it passes over them, and letting go saves the new order.
// It only counts as a drag once the pointer has moved a few pixels, so a
// plain click still opens the card, and the bin never starts one. The six
// dots in its corner say it can be dragged. On a phone a swipe across a card
// scrolls the page, so a finger drags by the dots (they don't scroll).
// With the dots focused, the arrow keys move a card one place.
//
// `items` is the section as the API last sent it; `save(ids)` stores an order
// (and reloads). While a card is being dragged, and until the save has come
// back, the cards are shown in the order being made rather than `items`'.
function useReorder(items, idOf, save, onError) {
	const [order, setOrder] = useState(null)
	const [dragging, setDragging] = useState(null)
	const listRef = useRef(null)
	// { id, grabX, grabY, x, y }: where on the card it was picked up, and where
	// the pointer is now
	const held = useRef(null)

	const shown = order
		? order.map((id) => items.find((item) => idOf(item) === id)).filter(Boolean)
		: items

	// The held card sits wherever the pointer is: its slot in the list, moved
	// by however far the pointer is from where it would hold the card there.
	const follow = () => {
		const now = held.current
		const list = listRef.current
		const card = list?.querySelector(`[data-tile-id="${now?.id}"]`)
		if (!now || !card) return
		const box = list.getBoundingClientRect()
		const x = now.x - box.left - now.grabX - card.offsetLeft
		const y = now.y - box.top - now.grabY - card.offsetTop
		card.style.transform = `translate(${x}px, ${y}px)`
	}
	// after the list re-orders, the held card's slot has moved under it
	useLayoutEffect(follow, [order])

	const commit = async (ids) => {
		if (ids.join() === items.map(idOf).join()) {
			setOrder(null)
			return
		}
		setOrder(ids)
		try {
			await save(ids)
		} catch (err) {
			onError(err.message)
		} finally {
			setOrder(null)
		}
	}

	// a pointer pressed on the card: a drag once it has moved this far
	const SLOP = 5

	const press = (event, id) => {
		if (event.button !== 0 || event.target.closest('[data-no-drag]')) return
		// on the dots, nothing else should happen (focus, a touch scroll)
		if (event.target.closest('[data-grip]')) event.preventDefault()
		const card = event.currentTarget
		const box = card.getBoundingClientRect()
		const start = { x: event.clientX, y: event.clientY }
		let ids = items.map(idOf)
		let started = false

		const move = (moved) => {
			if (!started) {
				if (Math.hypot(moved.clientX - start.x, moved.clientY - start.y) < SLOP) return
				started = true
				held.current = { id, grabX: start.x - box.left, grabY: start.y - box.top, x: moved.clientX, y: moved.clientY }
				setOrder(ids)
				setDragging(id)
			}
			held.current.x = moved.clientX
			held.current.y = moved.clientY
			// the held card lets the pointer through, so this is what's under it
			const over = document.elementFromPoint(moved.clientX, moved.clientY)?.closest('[data-tile-id]')
			const target = over && listRef.current?.contains(over) ? Number(over.dataset.tileId) : null
			if (target !== null && target !== id) {
				// into the place the card under it had: it moves along one
				const to = ids.indexOf(target)
				ids = ids.filter((other) => other !== id)
				ids.splice(to, 0, id)
				setOrder(ids)
			} else {
				follow()
			}
		}
		const drop = () => {
			window.removeEventListener('pointermove', move)
			window.removeEventListener('pointerup', drop)
			window.removeEventListener('pointercancel', drop)
			if (!started) return
			const lifted = listRef.current?.querySelector(`[data-tile-id="${id}"]`)
			if (lifted) lifted.style.transform = ''
			held.current = null
			setDragging(null)
			// the click that ends a drag isn't one on the card
			const swallow = (click) => { click.stopPropagation(); click.preventDefault() }
			window.addEventListener('click', swallow, { capture: true, once: true })
			setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0)
			commit(ids)
		}
		window.addEventListener('pointermove', move)
		window.addEventListener('pointerup', drop)
		window.addEventListener('pointercancel', drop)
	}

	// the arrow keys, on a focused grip: one place earlier or later
	const nudge = (event, id) => {
		const by = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key]
		if (!by) return
		event.preventDefault()
		const ids = items.map(idOf)
		const at = ids.indexOf(id)
		if (at + by < 0 || at + by >= ids.length) return
		;[ids[at], ids[at + by]] = [ids[at + by], ids[at]]
		commit(ids)
	}

	return { shown, listRef, dragProps: (id) => ({ id, dragging: dragging === id, onPress: (event) => press(event, id), onNudge: (event) => nudge(event, id) }) }
}

function GripIcon({ className = '' }) {
	return (
		<svg viewBox="0 0 10 16" fill="currentColor" aria-hidden="true" className={className}>
			<circle cx="2.5" cy="3" r="1.5" />
			<circle cx="7.5" cy="3" r="1.5" />
			<circle cx="2.5" cy="8" r="1.5" />
			<circle cx="7.5" cy="8" r="1.5" />
			<circle cx="2.5" cy="13" r="1.5" />
			<circle cx="7.5" cy="13" r="1.5" />
		</svg>
	)
}

// One item: its picture, its lines, and the buttons along the foot. The tile
// itself opens it for editing.
// `drag` (from useReorder's dragProps) makes the card draggable, with the
// dots in its top right corner.
function Tile({ image, tall = false, lines, badge, onEdit, onRemove, editable, label, drag, children }) {
	return (
		<li
			data-tile-id={drag?.id}
			onPointerDown={editable ? drag?.onPress : undefined}
			// a picture's own browser drag would steal the pointer
			onDragStart={drag ? (event) => event.preventDefault() : undefined}
			className={`
				relative
				w-[176px]
				rounded-[12px]
				bg-cream
				p-3
				${drag?.dragging
					? 'z-20 pointer-events-none shadow-[0_12px_30px_rgba(0,0,0,0.25)] scale-[1.03] cursor-grabbing'
					: 'transition-shadow duration-200'}
			`}
		>
			{editable && drag && (
				<button
					type="button"
					data-grip
					onKeyDown={drag.onNudge}
					aria-label={`Drag ${label} to reorder (or use the arrow keys)`}
					title="Drag to reorder"
					className={`
						absolute
						top-1.5
						right-1.5
						z-10
						w-7
						h-7
						inline-flex
						items-center
						justify-center
						rounded-full
						bg-white/90
						text-black/55
						shadow-sm
						touch-none
						${drag.dragging ? 'cursor-grabbing' : 'cursor-grab hover:text-black'}
					`}
				>
					<GripIcon className="w-2.5 h-4" />
				</button>
			)}
			<button
				type="button"
				onClick={onEdit}
				disabled={!editable}
				aria-label={`Edit ${label}`}
				className="
					block
					w-full
					text-left
					rounded-[8px]
					enabled:cursor-pointer
					transition-transform
					duration-150
					enabled:hover:-translate-y-0.5
				"
			>
				<div className={`
					w-full
					${tall ? 'aspect-[3/4]' : 'aspect-[5/4]'}
					flex
					items-center
					justify-center
					rounded-[8px]
					overflow-hidden
					bg-white
				`}>
					{image
						? <StoredImage src={image} alt="" className="w-full h-full object-cover" />
						: <span className="font-vietnam text-xs text-black/35">no picture</span>}
				</div>
				{lines.filter(Boolean).map((line, at) => (
					<p
						key={at}
						className={`
							${at === 0 ? 'mt-2 font-semibold text-sm text-black' : 'mt-0.5 text-xs text-black/50'}
							font-vietnam
							break-words
							line-clamp-2
						`}
					>
						{line}
					</p>
				))}
				{badge && (
					<p className="
						mt-1.5
						inline-block
						rounded-full
						bg-yellow
						px-2
						py-0.5
						font-vietnam
						text-[11px]
						text-black/70
					">
						{badge}
					</p>
				)}
			</button>
			{editable && (
				<div className="
					mt-2
					flex
					items-center
					justify-end
					gap-1.5
				">
					{children}
					<SmallButton onClick={onRemove} label={`Remove ${label}`} danger>
						<TrashIcon className="w-3.5 h-3.5" />
					</SmallButton>
				</div>
			)}
		</li>
	)
}

// `listRef` is useReorder's: the list the cards are dragged within
const Tiles = ({ listRef, children }) => (
	<ul
		ref={listRef}
		className="
			relative
			mt-6
			flex
			flex-wrap
			gap-4
			select-none
		"
	>
		{children}
	</ul>
)

// what a value off a form is sent as: trimmed, and '' is nothing
const clean = (value) => (typeof value === 'string' ? value.trim() || null : value ?? null)

const prettyDate = (ymd) => {
	if (!ymd) return null
	const [year, month, day] = ymd.split('-').map(Number)
	return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

// ---- the people ------------------------------------------------------------

const PERSON_FIELDS = [
	{ key: 'image', label: 'portrait (optional)', kind: 'image', frame: FRAMES.person, hint: 'Cropped to the portrait’s shape (3 by 4). Without one, the page shows a coloured swatch.' },
	{ key: 'title', label: 'title', kind: 'text', max: 80, placeholder: 'President' },
	{ key: 'name', label: 'name (optional)', kind: 'text', max: 80, placeholder: 'Ada Lovelace' },
	{ key: 'description', label: 'description (optional)', kind: 'textarea', max: 600, placeholder: 'What they study, and the thing they most like to make.' },
]

function PeopleCard({ people, editable, onChange, onError }) {
	const [editing, setEditing] = useState(null) // { person } — null person is adding
	const [removing, setRemoving] = useState(null)
	const { shown, listRef, dragProps } = useReorder(people, (person) => person.personId, async (ids) => {
		await landingApi.orderPeople(ids)
		await onChange()
	}, onError)

	const save = async (values) => {
		const body = { title: clean(values.title), name: clean(values.name), description: clean(values.description), image: values.image ?? null }
		if (editing.person) await landingApi.updatePerson(editing.person.personId, body)
		else await landingApi.addPerson(body)
		await onChange()
	}

	const remove = async (person) => {
		try {
			await landingApi.removePerson(person.personId)
			await onChange()
		} catch (err) {
			onError(err.message)
		}
	}

	return (
		<Card>
			<CardHead
				title="about us · the people"
				note="The names on the two rails under “who we are”. The rail shows each one’s title; clicking it opens their portrait, name and description. They run in this order: drag a card to move it."
			>
				{editable && <AddButton onClick={() => setEditing({ person: null })}>add a person</AddButton>}
			</CardHead>

			{people.length === 0 ? (
				<Empty>Nobody yet, so the page shows its five stand-ins. Add the first person and only the real ones show.</Empty>
			) : (
				<Tiles listRef={listRef}>
					{shown.map((person) => (
						<Tile
							key={person.personId}
							drag={dragProps(person.personId)}
							tall
							image={person.image}
							lines={[person.title, person.name, person.description]}
							label={person.title}
							editable={editable}
							onEdit={() => setEditing({ person })}
							onRemove={() => setRemoving(person)}
						/>
					))}
				</Tiles>
			)}

			{editing && (
				<ItemDialog
					title={editing.person ? 'edit this person' : 'add a person'}
					note="Only the title is needed. Anything left empty is left off the page."
					fields={PERSON_FIELDS}
					initial={editing.person ?? {}}
					check={(values) => (clean(values.title) ? null : 'Give them a title: it’s what the rail shows.')}
					onSave={save}
					onClose={() => setEditing(null)}
					submitLabel={editing.person ? 'save changes' : 'add them'}
				/>
			)}
			{removing && (
				<ConfirmDialog
					title={`remove ${removing.title}?`}
					body="They come off the landing page straight away."
					confirmLabel="remove"
					onCancel={() => setRemoving(null)}
					onConfirm={() => { remove(removing); setRemoving(null) }}
				/>
			)}
		</Card>
	)
}

// ---- the album -------------------------------------------------------------

const CARD_FIELDS = [
	{ key: 'image', label: 'photo', kind: 'image', frame: FRAMES.album, required: true, hint: 'Cropped to the photo on the card (the 5 by 7 card, above its title strip).' },
	{ key: 'title', label: 'title', kind: 'text', max: 80, placeholder: 'Fall callout' },
	{ key: 'date', label: 'date (optional)', kind: 'date' },
	{ key: 'description', label: 'description (optional)', kind: 'textarea', max: 400, placeholder: 'What was made, and who came.' },
]

function AlbumCardsCard({ album, editable, onChange, onError }) {
	const [editing, setEditing] = useState(null)
	const [removing, setRemoving] = useState(null)
	const { shown, listRef, dragProps } = useReorder(album, (card) => card.cardId, async (ids) => {
		await landingApi.orderCards(ids)
		await onChange()
	}, onError)

	const save = async (values) => {
		const body = { title: clean(values.title), date: values.date || null, description: clean(values.description), image: values.image }
		if (editing.card) await landingApi.updateCard(editing.card.cardId, body)
		else await landingApi.addCard(body)
		await onChange()
	}

	const remove = async (card) => {
		try {
			await landingApi.removeCard(card.cardId)
			await onChange()
		} catch (err) {
			onError(err.message)
		}
	}

	return (
		<Card>
			<CardHead
				title="album"
				note="The deck of cards: one per card here, left to right in this order (a new one goes first; drag a card to move it). Each needs a title and a photo."
			>
				{editable && <AddButton onClick={() => setEditing({ card: null })}>add a card</AddButton>}
			</CardHead>

			{album.length === 0 ? (
				<Empty>No cards yet, so the page shows its nine stand-ins. Add one and the deck becomes just yours.</Empty>
			) : (
				<Tiles listRef={listRef}>
					{shown.map((card) => (
						<Tile
							key={card.cardId}
							drag={dragProps(card.cardId)}
							image={card.image}
							lines={[card.title, prettyDate(card.date), card.description]}
							label={card.title}
							editable={editable}
							onEdit={() => setEditing({ card })}
							onRemove={() => setRemoving(card)}
						/>
					))}
				</Tiles>
			)}

			{editing && (
				<ItemDialog
					title={editing.card ? 'edit this card' : 'add a card'}
					note="The date and description are left off the card when they’re empty."
					fields={CARD_FIELDS}
					initial={editing.card ?? {}}
					check={(values) => {
						if (!values.image) return 'Every card needs a photo.'
						if (!clean(values.title)) return 'Give the card a title.'
						return null
					}}
					onSave={save}
					onClose={() => setEditing(null)}
					submitLabel={editing.card ? 'save changes' : 'add it'}
				/>
			)}
			{removing && (
				<ConfirmDialog
					title={`remove ${removing.title}?`}
					body="The card comes out of the deck straight away."
					confirmLabel="remove"
					onCancel={() => setRemoving(null)}
					onConfirm={() => { remove(removing); setRemoving(null) }}
				/>
			)}
		</Card>
	)
}

// ---- the sponsors ----------------------------------------------------------

const PILL_FIELDS = [
	{ key: 'image', label: 'background picture', kind: 'image', frame: FRAMES.sponsor, hint: 'A logo or a photo, behind the title, cropped to the pill’s shape.' },
	{ key: 'title', label: 'title', kind: 'text', max: 60, placeholder: 'Acme Labs' },
	{ key: 'website', label: 'website (optional)', kind: 'text', max: 500, placeholder: 'acme.com' },
]

const STATUS_LABELS = { pending: 'pending', contacting: 'contacting', active: 'active', archive: 'archived' }

function ConnectSponsor({ onConnected, onError }) {
	const [options, setOptions] = useState(null)
	const [picked, setPicked] = useState('')
	const [busy, setBusy] = useState(false)

	useEffect(() => {
		let live = true
		landingApi.connectable()
			.then((rows) => live && setOptions(rows))
			.catch((err) => live && onError(err.message))
		return () => { live = false }
	}, [onError])

	const connect = async () => {
		if (!picked) return
		setBusy(true)
		try {
			await landingApi.connect(Number(picked))
			setPicked('')
			setOptions(await landingApi.connectable())
			await onConnected()
		} catch (err) {
			onError(err.message)
		} finally {
			setBusy(false)
		}
	}

	const none = options !== null && options.length === 0

	return (
		<div className="
			flex
			items-center
			gap-2
		">
			<select
				value={picked}
				onChange={(event) => setPicked(event.target.value)}
				disabled={options === null || none || busy}
				aria-label="Connect an existing sponsor"
				className="
					rounded-full
					border
					border-black/25
					bg-white
					px-4
					py-2
					font-vietnam
					text-sm
					text-black
					max-w-[260px]
					disabled:text-black/40
				"
			>
				<option value="">
					{options === null ? 'loading sponsors…' : none ? 'no other sponsors yet' : 'connect an existing sponsor…'}
				</option>
				{(options ?? []).map((row) => (
					<option key={row.sponsorId} value={row.sponsorId}>
						{row.name || `sponsor #${row.sponsorId}`} · {STATUS_LABELS[row.status] ?? row.status}
					</option>
				))}
			</select>
			{picked && (
				<button
					type="button"
					onClick={connect}
					disabled={busy}
					className="
						rounded-full
						border
						border-black/70
						px-4
						py-2
						font-vietnam
						font-semibold
						text-sm
						text-black
						cursor-pointer
						hover:bg-black
						hover:text-white
						disabled:opacity-40
					"
				>
					{busy ? 'connecting…' : 'connect'}
				</button>
			)}
		</div>
	)
}

function SponsorsCard({ sponsors, editable, onChange, onError }) {
	const [editing, setEditing] = useState(null)
	const [removing, setRemoving] = useState(null)
	const { shown, listRef, dragProps } = useReorder(sponsors, (pill) => pill.sponsorId, async (ids) => {
		await landingApi.orderPills(ids)
		await onChange()
	}, onError)

	const save = async (values) => {
		const body = { title: clean(values.title), website: clean(values.website), image: values.image ?? null }
		if (editing.pill) await landingApi.updatePill(editing.pill.sponsorId, body)
		else await landingApi.addPill(body)
		await onChange()
	}

	const remove = async (pill) => {
		try {
			await landingApi.removePill(pill.sponsorId)
			await onChange()
		} catch (err) {
			onError(err.message)
		}
	}

	const nameOf = (pill) => pill.title || pill.companyName || 'this sponsor'

	return (
		<Card>
			<CardHead
				title="sponsors"
				note="The pills under “kept stable by”: a picture behind a title (one of the two is enough). One with a website opens it in a new tab. They run in this order: drag a card to move it. Connecting a sponsor from the sponsors page makes it active there."
			>
				{editable && <ConnectSponsor onConnected={onChange} onError={onError} />}
				{editable && <AddButton onClick={() => setEditing({ pill: null })}>add a pill</AddButton>}
			</CardHead>

			{sponsors.length === 0 ? (
				<Empty>No pills yet, so the page shows its stand-in sponsors. Add or connect one and only the real ones show.</Empty>
			) : (
				<Tiles listRef={listRef}>
					{shown.map((pill) => (
						<Tile
							key={pill.sponsorId}
							drag={dragProps(pill.sponsorId)}
							image={pill.image}
							lines={[pill.title || '(picture only)', pill.website?.replace(/^https?:\/\//, '').replace(/\/$/, '')]}
							badge={pill.shown ? null : `not shown: ${STATUS_LABELS[pill.status] ?? pill.status} on the sponsors page`}
							label={nameOf(pill)}
							editable={editable}
							onEdit={() => setEditing({ pill })}
							onRemove={() => setRemoving(pill)}
						/>
					))}
				</Tiles>
			)}

			{editing && (
				<ItemDialog
					title={editing.pill ? 'edit this pill' : 'add a sponsor pill'}
					note="Give it a picture, a title, or both."
					fields={PILL_FIELDS}
					initial={editing.pill ?? {}}
					check={(values) => (values.image || clean(values.title) ? null : 'Add a picture or a title (or both).')}
					onSave={save}
					onClose={() => setEditing(null)}
					submitLabel={editing.pill ? 'save changes' : 'add it'}
				/>
			)}
			{removing && (
				<ConfirmDialog
					title={`take ${nameOf(removing)} off the page?`}
					body={removing.source === 'form' || removing.companyName
						? 'It comes off the landing page. The sponsor stays on the sponsors page.'
						: 'It comes off the landing page straight away.'}
					confirmLabel="take it off"
					onCancel={() => setRemoving(null)}
					onConfirm={() => { remove(removing); setRemoving(null) }}
				/>
			)}
		</Card>
	)
}

// ---- the page --------------------------------------------------------------

export default function LandingEditor({ user }) {
	const [content, setContent] = useState(null)
	const [error, setError] = useState(null)
	const editable = canChange(user?.role)

	const load = () => landingApi.admin().then(setContent)

	useEffect(() => {
		let live = true
		landingApi.admin()
			.then((rows) => live && setContent(rows))
			.catch((err) => live && setError(err.message))
		return () => { live = false }
	}, [])

	const changed = async () => {
		setError(null)
		await load()
	}

	return (
		<DashboardShell className="
			lg:-mt-8
			lg:-mb-8
			lg:-mr-8
			py-2
			lg:py-8
			pr-3
			lg:pr-11
			pl-3
		">
			<div className="
				page-stagger
				flex
				flex-col
				gap-6
			">
				<div className="
					flex
					flex-wrap
					items-center
					justify-between
					gap-3
				">
					<p className="
						font-vietnam
						text-sm
						text-black/55
					">
						What the public landing page shows. Changes are live as soon as they’re saved.
					</p>
					<a
						href="/landing"
						target="_blank"
						rel="noopener noreferrer"
						className="
							rounded-full
							border
							border-black/25
							bg-white
							px-4
							py-2
							font-vietnam
							font-semibold
							text-sm
							text-black
							hover:border-black
						"
					>
						open the landing page ↗
					</a>
				</div>

				{error && (
					<p className="
						font-vietnam
						text-sm
						text-salmon-dark
					">
						{error}
					</p>
				)}

				{content === null ? (
					!error && (
						<p className="
							font-vietnam
							text-sm
							text-black/40
						">
							loading…
						</p>
					)
				) : (
					<>
						<PeopleCard people={content.people} editable={editable} onChange={changed} onError={setError} />
						<AlbumCardsCard album={content.album} editable={editable} onChange={changed} onError={setError} />
						<SponsorsCard sponsors={content.sponsors} editable={editable} onChange={changed} onError={setError} />
					</>
				)}
			</div>
		</DashboardShell>
	)
}
