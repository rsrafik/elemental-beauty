'use client'

import { useEffect, useRef, useState } from 'react'
import DashboardShell from '@/components/dashboards/DashboardShell'
import StoredImage from '@/components/StoredImage'
import { Card, CardNote, CardTitle, ConfirmDialog, Dialog, DialogActions, FIELD, Label, PlusIcon, TrashIcon } from '@/components/analytics/parts'
import { DateField } from '@/components/labs/DateTimeField'
import { landing as landingApi } from '@/lib/api'
import { useDismiss } from '@/lib/dismiss'
import { COVER_MAX, shrinkImage } from '@/lib/images'
import { canChange } from '@/lib/roles'

// /landing-editor: what the public landing page (/landing) shows, for an admin
// to keep. Three cards, one per section that has placeholders today:
//
//   the people   under "who we are": title (required — the rail shows it
//                before they're clicked), name, description, picture; in the
//                order they're listed here, which the arrows change
//   the album    the deck of cards: title and photo (required), date,
//                description; one card on the page per card here
//   sponsors     the pills: a picture behind a title (one of the two
//                required) and a website the pill opens in a new tab. Or
//                connect a sponsor the sponsors page already has.
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

function PictureField({ field, value, onChange, onError }) {
	const picker = useRef(null)

	const pick = async (event) => {
		const file = event.target.files?.[0]
		event.target.value = ''
		if (!file) return
		try {
			onChange(await shrinkImage(file, COVER_MAX))
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
					className="
						w-28
						h-28
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

// One item: its picture, its lines, and the buttons along the foot. The tile
// itself opens it for editing.
function Tile({ image, tall = false, lines, badge, onEdit, onRemove, editable, label, children }) {
	return (
		<li className="
			relative
			w-[176px]
			rounded-[12px]
			bg-cream
			p-3
		">
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

const Tiles = ({ children }) => (
	<ul className="
		mt-6
		flex
		flex-wrap
		gap-4
	">
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
	{ key: 'image', label: 'portrait (optional)', kind: 'image', hint: 'Taller than wide works best. Without one, the page shows a coloured swatch.' },
	{ key: 'title', label: 'title', kind: 'text', max: 80, placeholder: 'President' },
	{ key: 'name', label: 'name (optional)', kind: 'text', max: 80, placeholder: 'Ada Lovelace' },
	{ key: 'description', label: 'description (optional)', kind: 'textarea', max: 600, placeholder: 'What they study, and the thing they most like to make.' },
]

function PeopleCard({ people, editable, onChange, onError }) {
	const [editing, setEditing] = useState(null) // { person } — null person is adding
	const [removing, setRemoving] = useState(null)
	const [busy, setBusy] = useState(false)

	const save = async (values) => {
		const body = { title: clean(values.title), name: clean(values.name), description: clean(values.description), image: values.image ?? null }
		if (editing.person) await landingApi.updatePerson(editing.person.personId, body)
		else await landingApi.addPerson(body)
		await onChange()
	}

	const move = async (at, by) => {
		const ids = people.map((person) => person.personId)
		;[ids[at], ids[at + by]] = [ids[at + by], ids[at]]
		setBusy(true)
		try {
			await landingApi.orderPeople(ids)
			await onChange()
		} catch (err) {
			onError(err.message)
		} finally {
			setBusy(false)
		}
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
				note="The names on the two rails under “who we are”. The rail shows each one’s title; clicking it opens their portrait, name and description. They run in this order."
			>
				{editable && <AddButton onClick={() => setEditing({ person: null })}>add a person</AddButton>}
			</CardHead>

			{people.length === 0 ? (
				<Empty>Nobody yet, so the page shows its five stand-ins. Add the first person and only the real ones show.</Empty>
			) : (
				<Tiles>
					{people.map((person, at) => (
						<Tile
							key={person.personId}
							tall
							image={person.image}
							lines={[person.title, person.name, person.description]}
							label={person.title}
							editable={editable}
							onEdit={() => setEditing({ person })}
							onRemove={() => setRemoving(person)}
						>
							<SmallButton onClick={() => move(at, -1)} disabled={busy || at === 0} label={`Move ${person.title} earlier`}>←</SmallButton>
							<SmallButton onClick={() => move(at, 1)} disabled={busy || at === people.length - 1} label={`Move ${person.title} later`}>→</SmallButton>
						</Tile>
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
	{ key: 'image', label: 'photo', kind: 'image', required: true, hint: 'A little taller than wide (5 by 7) fills the card.' },
	{ key: 'title', label: 'title', kind: 'text', max: 80, placeholder: 'Fall callout' },
	{ key: 'date', label: 'date (optional)', kind: 'date' },
	{ key: 'description', label: 'description (optional)', kind: 'textarea', max: 400, placeholder: 'What was made, and who came.' },
]

function AlbumCardsCard({ album, editable, onChange, onError }) {
	const [editing, setEditing] = useState(null)
	const [removing, setRemoving] = useState(null)

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
				note="The deck of cards: one per card here, newest date first. Each needs a title and a photo."
			>
				{editable && <AddButton onClick={() => setEditing({ card: null })}>add a card</AddButton>}
			</CardHead>

			{album.length === 0 ? (
				<Empty>No cards yet, so the page shows its nine stand-ins. Add one and the deck becomes just yours.</Empty>
			) : (
				<Tiles>
					{album.map((card) => (
						<Tile
							key={card.cardId}
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
	{ key: 'image', label: 'background picture', kind: 'image', hint: 'A logo or a photo, behind the title. Wide works best.' },
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
				note="The pills under “kept stable by”: a picture behind a title (one of the two is enough). One with a website opens it in a new tab. Connecting a sponsor from the sponsors page makes it active there."
			>
				{editable && <ConnectSponsor onConnected={onChange} onError={onError} />}
				{editable && <AddButton onClick={() => setEditing({ pill: null })}>add a pill</AddButton>}
			</CardHead>

			{sponsors.length === 0 ? (
				<Empty>No pills yet, so the page shows its stand-in sponsors. Add or connect one and only the real ones show.</Empty>
			) : (
				<Tiles>
					{sponsors.map((pill) => (
						<Tile
							key={pill.sponsorId}
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
