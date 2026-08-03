'use client'

import { useEffect, useState } from 'react'
import { useDismiss } from '@/lib/dismiss'
import DashboardShell from '@/components/dashboards/DashboardShell'

// /labs for officer / treasurer / admin: every lab on one sheet, each one
// editable from the dots in its corner.
//
// Same card as the member page — photo, name, date — with the status icon in
// the bottom-right swapped for the dots menu. The dots and the + in the header
// open the same dialog: + starts an empty one, the dots load that card into it.

// ---- data ------------------------------------------------------------------

// Placeholder rows until /labs is wired to the API. `date` is stored the way
// the date input wants it ('YYYY-MM-DD') and formatted for the card, so editing
// a lab prefills instead of re-parsing prose. `image` is a path under public/ —
// cards fall back to a blank tile while those don't exist yet.
const seedLabs = [
	{ id: 1, title: 'Bronzer', date: '2026-08-30', image: null, description: '' },
	{ id: 2, title: 'Lipstick', date: '2026-08-30', image: null, description: '' },
	{ id: 3, title: 'Lip Gloss', date: '2026-08-30', image: null, description: '' },
	{ id: 4, title: 'Lip Gloss', date: '2026-08-30', image: null, description: '' },
	{ id: 5, title: 'Bronzer', date: '2026-09-06', image: null, description: '' },
	{ id: 6, title: 'Lipstick', date: '2026-09-06', image: null, description: '' },
	{ id: 7, title: 'Lip Gloss', date: '2026-09-06', image: null, description: '' },
	{ id: 8, title: 'Lip Gloss', date: '2026-09-06', image: null, description: '' },
]

// '2026-08-30' -> 'August 30, 2026'. Split by hand rather than through Date,
// which reads a bare date string as UTC and can hand back the day before
// depending on the timezone.
function prettyDate(value) {
	if (!value) return ''
	const [year, month, day] = value.split('-').map(Number)
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
function LabCard({ title, date, image, onEdit }) {
	return (
		<div className="
			group
			relative
			bg-white
			rounded-[10px]
			p-3
			pb-4
			shadow-[0_4px_10px_rgba(0,0,0,0.15)]
			transition-all
			duration-200
			ease-out
			hover:-translate-y-1
			hover:shadow-[-5px_5px_5px_rgba(0,0,0,0.5)]
			active:translate-y-0
			active:shadow-[0_4px_10px_rgba(0,0,0,0.15)]
		">
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
					<p className="
						font-vietnam
						text-black/70
						text-sm
						mt-1
						truncate
					">
						{prettyDate(date)}
					</p>
				</div>

				<button
					type="button"
					onClick={onEdit}
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
				p-8
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
					w-[420px]
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

// Mounted only while open, so it always starts from whatever `lab` it was
// handed — an existing row to edit, or nothing for a new one.
//
// The picked image is held as an object URL, which is enough to draw it on the
// card. Swap it for the uploaded path once /labs is posting to the API.
//
// `onDelete` only comes in when there's a lab to delete, which is what puts the
// delete button on the footer.
function LabDialog({ lab, onClose, onSave, onDelete }) {
	// dismiss plays the exit animation and then closes for real — lib/dismiss.js
	const { closing, dismiss } = useDismiss()
	const close = () => dismiss(onClose)

	const [form, setForm] = useState({
		title: lab?.title ?? '',
		date: lab?.date ?? '',
		description: lab?.description ?? '',
	})
	const [image, setImage] = useState(lab?.image ?? null)
	const [confirmingDelete, setConfirmingDelete] = useState(false)

	const set = (field) => (event) =>
		setForm((prev) => ({ ...prev, [field]: event.target.value }))

	// Escape closes, same as the backdrop — but not while the delete
	// confirmation is up, or one keypress would dismiss both layers at once.
	useEffect(() => {
		const onKey = (event) => {
			if (event.key === 'Escape' && !confirmingDelete) close()
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	})

	const pickImage = (event) => {
		const file = event.target.files?.[0]
		if (!file) return
		setImage(URL.createObjectURL(file))
	}

	const ready = form.title.trim() !== '' && form.date !== ''

	const submit = (event) => {
		event.preventDefault()
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
				p-8
				${closing ? 'dialog-leaving' : 'dialog-open'}
			`}
			onClick={close}
		>
			{/* the card swallows clicks so only the backdrop itself closes */}
			<form
				onClick={(event) => event.stopPropagation()}
				onSubmit={submit}
				role="dialog"
				aria-modal="true"
				aria-label={lab ? 'Edit lab' : 'New lab'}
				className="
					w-[560px]
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
						{lab ? 'edit lab' : 'new lab'}
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
							placeholder="Lip Gloss"
							className={FIELD}
						/>
					</label>

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
						<Label>description</Label>
						<textarea
							value={form.description}
							onChange={set('description')}
							rows={3}
							placeholder="What members will make, what to bring."
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
							delete lab
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
						{lab ? 'save changes' : 'add lab'}
					</button>
					</div>
				</div>

				{confirmingDelete && (
					<ConfirmDeleteDialog
						label={lab.title}
						onCancel={() => setConfirmingDelete(false)}
						onConfirm={onDelete}
					/>
				)}
			</form>
		</div>
	)
}

// ---- page ------------------------------------------------------------------

export default function OfficerLabs() {
	const [labs, setLabs] = useState(seedLabs)

	// null = closed. { lab: null } opens an empty dialog, { lab } loads that row
	// into it — one dialog serving both the + and the dots.
	const [editing, setEditing] = useState(null)

	// Confirming a delete takes the lab out and closes both layers at once,
	// since the dialog it was opened from no longer has anything to edit.
	const deleteLab = () => {
		setLabs((prev) => prev.filter((lab) => lab.id !== editing.lab.id))
		setEditing(null)
	}

	const saveLab = (values) => {
		const target = editing.lab
		setLabs((prev) =>
			target
				? prev.map((lab) => (lab.id === target.id ? { ...lab, ...values } : lab))
				: [...prev, { ...values, id: Math.max(0, ...prev.map((l) => l.id)) + 1 }]
		)
		setEditing(null)
	}

	return (
		<DashboardShell>
			<div className="
				flex
				items-center
				justify-center
				gap-5
				pt-6
				pb-10
			">
				<h1 className="
					font-canobis
					[-webkit-text-stroke:2px_black]
					text-black
					text-[45px]
					select-none
				">
					ALL LABS
				</h1>
				<button
					type="button"
					onClick={() => setEditing({ lab: null })}
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

			<div className="
				grid
				grid-cols-5
				gap-8
				px-3
				pb-3
			">
				{labs.map((lab) => (
					<LabCard
						key={lab.id}
						title={lab.title}
						date={lab.date}
						image={lab.image}
						onEdit={() => setEditing({ lab })}
					/>
				))}
			</div>

			{editing && (
				<LabDialog
					lab={editing.lab}
					onClose={() => setEditing(null)}
					onSave={saveLab}
					onDelete={editing.lab ? deleteLab : undefined}
				/>
			)}
		</DashboardShell>
	)
}
