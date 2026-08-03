'use client'

import { useEffect, useRef, useState } from 'react'
import DashboardShell from '@/components/dashboards/DashboardShell'
import { currentRole, hasRole } from '@/lib/roles'
import { useDismiss } from '@/lib/dismiss'

// /students — officer and up only. The member roster as one sheet: search,
// sort by any column that holds a value, filter by role, add a student, and
// select rows to delete in a batch.
//
// The page keeps the cream background and the white stops at the table, so the
// roster reads as a sheet of paper laid on the desk rather than a second app
// chrome. Title, search and buttons all sit on the cream above it.
//
// Two things here are rank-gated, and both gates sit on the control itself
// rather than on the action, so nothing offers what it would then refuse:
//
//   deleting — officers and treasurers can only remove plain members; anyone
//     on staff (officer, treasurer, admin) can only be removed by an admin.
//     The gate is on the row's checkbox, so an untouchable row can't even be
//     picked up.
//   roles — only an admin can change anyone's role, which is also what the
//     API enforces on PUT /members/:id/role. For everyone else the pill is a
//     label rather than a button.

// ---- data ------------------------------------------------------------------

const ROLES = ['member', 'officer', 'treasurer', 'admin']

// Sorting roles alphabetically would put admin above officer for no reason —
// rank is the order anyone actually means by "sort by role". Mirrors RANK in
// lib/roles.js (minus 'user', which has no member row and so no table row).
const ROLE_ORDER = {
	member: 0,
	officer: 1,
	treasurer: 2,
	admin: 3,
}

const ROLE_PILL = {
	member: 'bg-salmon-lightest text-salmon-dark',
	officer: 'bg-blue-light text-blue-med',
	treasurer: 'bg-yellow-light text-yellow-dark',
	admin: 'bg-green text-green-dark',
}

// Placeholder rows until /students is wired to GET /members. `id` is the
// user_id the API returns; `joined` is users.created_at kept as 'YYYY-MM-DD',
// which sorts as a plain string and formats without a Date round-trip; `photo`
// is a path under public/ and falls back to the initials tile while profile
// pictures aren't uploaded yet.
const seedStudents = [
	{ id: 12289, first: 'Daisy', last: 'Scott', username: 'daisy22', role: 'member', points: 40, joined: '2026-07-14', photo: null },
	{ id: 12288, first: 'Isabel', last: 'Harris', username: 'isabel887', role: 'officer', points: 155, joined: '2025-09-02', photo: null },
	{ id: 12287, first: 'Dan', last: 'Thomas', username: 'dan87675', role: 'member', points: 25, joined: '2026-06-30', photo: null },
	{ id: 12286, first: 'Debra', last: 'Nelson', username: 'debra1212', role: 'treasurer', points: 130, joined: '2025-08-21', photo: null },
	{ id: 12285, first: 'Vera', last: 'Cooper', username: 'vera8888', role: 'member', points: 90, joined: '2026-02-11', photo: null },
	{ id: 12284, first: 'Brian', last: 'Miller', username: 'brian5564', role: 'member', points: 0, joined: '2026-07-28', photo: null },
	{ id: 12283, first: 'Lauren', last: 'Martin', username: 'lauren7712', role: 'officer', points: 205, joined: '2025-09-15', photo: null },
	{ id: 12282, first: 'Milton', last: 'Smith', username: 'milton2244', role: 'member', points: 65, joined: '2026-03-04', photo: null },
	{ id: 12281, first: 'Molly', last: 'White', username: 'molly4747', role: 'admin', points: 310, joined: '2025-08-04', photo: null },
	{ id: 12280, first: 'Priya', last: 'Anand', username: 'priya9021', role: 'member', points: 115, joined: '2025-11-19', photo: null },
	{ id: 12279, first: 'Grace', last: 'Kim', username: 'grace3310', role: 'member', points: 15, joined: '2026-07-22', photo: null },
	{ id: 12278, first: 'Nadia', last: 'Okafor', username: 'nadia1180', role: 'officer', points: 240, joined: '2025-09-08', photo: null },
	{ id: 12277, first: 'Sofia', last: 'Reyes', username: 'sofia6602', role: 'member', points: 75, joined: '2026-01-27', photo: null },
	{ id: 12276, first: 'Hana', last: 'Yamada', username: 'hana4429', role: 'member', points: 50, joined: '2026-05-06', photo: null },
]

// How tall a header row and a data row come out at this type size. Only the
// starting guess and the fallback for a table with nothing in it — the real
// numbers get measured off the rendered table.
const HEAD_HEIGHT = 49
const ROW_HEIGHT = 57

// '2026-07-14' -> 'Jul 14, 2026'. Split by hand rather than through Date, which
// reads a bare date string as UTC and can hand back the day before depending on
// the timezone.
function prettyDate(value) {
	if (!value) return ''
	const [year, month, day] = value.split('-').map(Number)
	return new Date(year, month - 1, day).toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	})
}

// Today as 'YYYY-MM-DD' in the officer's own timezone — the account a student
// creates right now is dated the day they see on their calendar, not the day
// it is in UTC. Built by hand for the same reason prettyDate is.
function today() {
	const now = new Date()
	const month = String(now.getMonth() + 1).padStart(2, '0')
	const day = String(now.getDate()).padStart(2, '0')
	return `${now.getFullYear()}-${month}-${day}`
}

// Initials tiles stand in for profile pictures. The colour is picked off the id
// so a student keeps the same one between renders and between pages.
const AVATAR_COLORS = [
	'bg-salmon',
	'bg-orange-light',
	'bg-yellow',
	'bg-green',
	'bg-blue-light',
	'bg-salmon-light',
	'bg-orange-lighter',
]

function initials(first, last) {
	return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
}

// ---- icons -----------------------------------------------------------------

function SearchIcon({ className = '' }) {
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
			<circle cx="11" cy="11" r="6.5" />
			<path d="M16 16l4.5 4.5" />
		</svg>
	)
}

function FilterIcon({ className = '' }) {
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
			<path d="M3.5 5.5h17l-6.5 7.5v6l-4 2.5v-8.5z" />
		</svg>
	)
}

function TrashIcon({ className = '' }) {
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
			<path d="M4 7h16" />
			<path d="M9.5 7V5h5v2" />
			<path d="M6.5 7l.8 12.5h9.4L17.5 7" />
			<path d="M10.5 10.5v6M13.5 10.5v6" />
		</svg>
	)
}

function PlusIcon({ className = '' }) {
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
			<path d="M12 6v12M6 12h12" />
		</svg>
	)
}

function CheckIcon({ className = '' }) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="3.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			<path d="M5 12.5l4.5 4.5L19 7" />
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

function ChevronIcon({ className = '' }) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			<path d="M9 5l7 7-7 7" />
		</svg>
	)
}

// Points up when ascending, down when descending. Dimmed and pointing both ways
// on the columns that aren't currently sorted, so every sortable header says so
// without shouting over the one that's active.
function SortArrow({ state, className = '' }) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			{state !== 'desc' && <path d="M7 11l5-5 5 5" />}
			{state !== 'asc' && <path d="M7 13l5 5 5-5" />}
		</svg>
	)
}

// ---- pieces ----------------------------------------------------------------

// A real checkbox kept for the keyboard and screen readers, with the visible
// box drawn next to it — `appearance-none` can't render the half-state the
// header needs when only some of the page is selected.
//
// `title` is what a disabled box says when it's hovered, which is the only
// place the rank rule gets explained.
function Checkbox({ checked, mixed = false, disabled = false, onChange, label, title }) {
	const on = checked || mixed

	return (
		<label
			title={title}
			className={`
				inline-flex
				items-center
				justify-center
				${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
			`}
		>
			<input
				type="checkbox"
				checked={checked}
				disabled={disabled}
				onChange={onChange}
				aria-label={label}
				className="peer sr-only"
			/>
			<span className={`
				w-[18px]
				h-[18px]
				flex
				items-center
				justify-center
				rounded-[5px]
				border
				transition-colors
				duration-150
				ease-out
				peer-focus-visible:ring-2
				peer-focus-visible:ring-blue-med
				peer-focus-visible:ring-offset-2
				${disabled
					? 'bg-black/[0.06] border-black/15'
					: on
						? 'bg-blue-med border-blue-med text-white'
						: 'bg-white border-black/30 hover:border-black/60'}
			`}>
				{mixed
					? <span className="
						w-2.5
						h-[2.5px]
						rounded-full
						bg-white
					" />
					: checked && <CheckIcon className="w-3 h-3" />}
			</span>
		</label>
	)
}

function Avatar({ student }) {
	const tint = AVATAR_COLORS[student.id % AVATAR_COLORS.length]

	return (
		<div className={`
			w-9
			h-9
			shrink-0
			flex
			items-center
			justify-center
			overflow-hidden
			rounded-full
			font-vietnam
			font-semibold
			text-[13px]
			text-black/70
			select-none
			${tint}
		`}>
			{student.photo
				? <img
					src={student.photo}
					alt=""
					className="
						w-full
						h-full
						object-cover
					"
				/>
				: initials(student.first, student.last)}
		</div>
	)
}

function RoleTag({ role, title }) {
	return (
		<span title={title} className={`
			inline-flex
			items-center
			rounded-full
			px-3
			py-1
			font-vietnam
			font-semibold
			text-xs
			${ROLE_PILL[role]}
		`}>
			{role}
		</span>
	)
}

// The pill in a row is the control for changing that role: it hands its own
// position up to the page, which opens the menu against it. The caret is what
// says it's more than a label.
//
// `data-role-pill` is how the open menu recognises a click on a pill and leaves
// it to the pill's own handler — otherwise closing-on-outside-click and the
// click itself would fight, and the pill you're already on could never close.
function RolePill({ role, open, onOpen }) {
	return (
		<button
			type="button"
			data-role-pill
			onClick={(event) => onOpen(event.currentTarget.getBoundingClientRect())}
			aria-haspopup="listbox"
			aria-expanded={open}
			aria-label={`Change role, currently ${role}`}
			className={`
				group
				inline-flex
				items-center
				gap-1
				rounded-full
				pl-3
				pr-2
				py-1
				font-vietnam
				font-semibold
				text-xs
				cursor-pointer
				transition-all
				duration-150
				ease-out
				hover:-translate-y-0.5
				hover:shadow-md
				hover:shadow-black/20
				active:translate-y-0
				active:shadow-none
				${ROLE_PILL[role]}
			`}
		>
			{role}
			<ChevronIcon className={`
				w-2.5
				h-2.5
				shrink-0
				rotate-90
				transition-opacity
				duration-150
				ease-out
				${open ? 'opacity-100' : 'opacity-50 group-hover:opacity-100'}
			`} />
		</button>
	)
}

// Placed with fixed coordinates taken off the pill rather than positioned
// inside the cell: the pill sits within two overflow boxes — the card and its
// horizontal scroller — and an absolutely-positioned menu would be cut off on
// the bottom rows. The trade is that it can't follow its pill, so any scroll
// closes it.
function RoleMenu({ anchor, current, onPick, onClose }) {
	const menu = useRef(null)

	useEffect(() => {
		const onDown = (event) => {
			if (menu.current?.contains(event.target)) return
			// a click on any pill belongs to that pill, which toggles for itself
			if (event.target.closest?.('[data-role-pill]')) return
			onClose()
		}
		const onKey = (event) => {
			if (event.key === 'Escape') onClose()
		}
		window.addEventListener('mousedown', onDown)
		window.addEventListener('keydown', onKey)
		window.addEventListener('resize', onClose)
		// capture phase: the scroll that matters happens on the shell's content
		// area, and scroll events don't bubble
		window.addEventListener('scroll', onClose, true)
		return () => {
			window.removeEventListener('mousedown', onDown)
			window.removeEventListener('keydown', onKey)
			window.removeEventListener('resize', onClose)
			window.removeEventListener('scroll', onClose, true)
		}
	}, [onClose])

	// flips above the pill when the last rows don't leave room below
	const height = ROLES.length * 36 + 16
	const below = anchor.bottom + 6
	const top = below + height > window.innerHeight ? anchor.top - height - 6 : below

	return (
		<div
			ref={menu}
			role="listbox"
			aria-label="Role"
			style={{ top, left: anchor.left }}
			className="
				menu-open
				fixed
				z-50
				w-44
				rounded-[14px]
				bg-white
				p-2
				shadow-[0_10px_30px_rgba(0,0,0,0.2)]
			"
		>
			{ROLES.map((role) => (
				<button
					key={role}
					type="button"
					role="option"
					aria-selected={role === current}
					onClick={() => onPick(role)}
					className={`
						flex
						w-full
						items-center
						justify-between
						gap-2
						rounded-[8px]
						px-2
						py-1.5
						cursor-pointer
						transition-colors
						duration-150
						ease-out
						hover:bg-cream
						${role === current ? 'bg-cream' : ''}
					`}
				>
					<RoleTag role={role} />
					{role === current && <CheckIcon className="w-3 h-3 shrink-0 text-black/40" />}
				</button>
			))}
		</div>
	)
}

// One sortable column head. First click sorts ascending, clicking the column
// that's already sorted flips the direction.
function SortHeader({ label, column, sort, onSort }) {
	const active = sort.key === column
	const state = active ? sort.dir : 'none'

	return (
		<th scope="col" className="px-2 py-3 text-left whitespace-nowrap">
			<button
				type="button"
				onClick={() => onSort(column)}
				aria-label={`Sort by ${label}`}
				className={`
					group
					inline-flex
					items-center
					gap-1.5
					font-vietnam
					font-bold
					text-[12px]
					uppercase
					tracking-[0.08em]
					cursor-pointer
					transition-colors
					duration-150
					ease-out
					${active ? 'text-black' : 'text-black hover:text-black'}
				`}
			>
				{label}
				<SortArrow
					state={state}
					className={`
						w-3
						h-3
						shrink-0
						transition-opacity
						duration-150
						ease-out
						${active ? 'opacity-100' : 'opacity-40 group-hover:opacity-70'}
					`}
				/>
			</button>
		</th>
	)
}

// ---- dialogs ---------------------------------------------------------------

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

// Names are listed rather than counted alone: a selection can include rows that
// scrolled off the page or fell behind a filter, and this is the last place to
// notice one that shouldn't be there.
function ConfirmDeleteDialog({ students, onCancel, onConfirm }) {
	// dismiss plays the exit animation and then closes for real — see
	// lib/dismiss.js
	const { closing, dismiss } = useDismiss()
	const cancel = () => dismiss(onCancel)

	useEffect(() => {
		const onKey = (event) => {
			if (event.key === 'Escape') cancel()
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	})

	const many = students.length !== 1

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
				aria-label="Delete students"
				className="
					w-[460px]
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
					delete {many ? `${students.length} students` : 'student'}?
				</h2>
				<p className="
					font-vietnam
					text-sm
					text-black/60
					mt-3
				">
					Their points, lab sign-ups, and event history go with them. This
					can&apos;t be undone.
				</p>

				<ul className="
					mt-4
					max-h-40
					overflow-y-auto
					rounded-[10px]
					bg-white
					px-4
					py-3
					font-vietnam
					text-sm
					text-black/80
				">
					{students.map((student) => (
						<li key={student.id} className="py-0.5">
							{student.first} {student.last}
							<span className="text-black/40"> · {student.username}</span>
						</li>
					))}
				</ul>

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
						delete {many ? 'them' : 'student'}
					</button>
				</div>
			</div>
		</div>
	)
}

// Mounted only while open, so it always starts blank. Points aren't asked for —
// a new student starts at zero and earns from there.
function AddStudentDialog({ onClose, onSave }) {
	const { closing, dismiss } = useDismiss()
	const close = () => dismiss(onClose)

	const [form, setForm] = useState({
		first: '',
		last: '',
		username: '',
		role: 'member',
		password: '',
	})

	const set = (field) => (event) =>
		setForm((prev) => ({ ...prev, [field]: event.target.value }))

	useEffect(() => {
		const onKey = (event) => {
			if (event.key === 'Escape') close()
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	})

	const ready =
		form.first.trim() !== '' &&
		form.last.trim() !== '' &&
		form.username.trim() !== '' &&
		form.password !== ''

	const submit = (event) => {
		event.preventDefault()
		if (!ready) return
		dismiss(() =>
			onSave({
				...form,
				first: form.first.trim(),
				last: form.last.trim(),
				username: form.username.trim(),
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
				aria-label="Add a student"
				className="
					w-[560px]
					max-h-[85vh]
					overflow-y-auto
					bg-cream
					rounded-[50px]
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
						add a student
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
					<div className="
						grid
						grid-cols-2
						gap-4
					">
						<label className="block">
							<Label>first name</Label>
							<input
								type="text"
								value={form.first}
								onChange={set('first')}
								placeholder="Daisy"
								className={FIELD}
							/>
						</label>

						<label className="block">
							<Label>last name</Label>
							<input
								type="text"
								value={form.last}
								onChange={set('last')}
								placeholder="Scott"
								className={FIELD}
							/>
						</label>
					</div>

					<label className="block">
						<Label>username</Label>
						<input
							type="text"
							value={form.username}
							onChange={set('username')}
							placeholder="daisy22"
							autoComplete="off"
							className={FIELD}
						/>
					</label>

					<label className="block">
						<Label>role</Label>
						<select
							value={form.role}
							onChange={set('role')}
							className={`${FIELD} cursor-pointer`}
						>
							{ROLES.map((role) => (
								<option key={role} value={role}>
									{role}
								</option>
							))}
						</select>
					</label>

					{/* a starter password — they change it from /account once they're in */}
					<label className="block">
						<Label>password</Label>
						<input
							type="password"
							value={form.password}
							onChange={set('password')}
							placeholder="••••••••"
							autoComplete="new-password"
							className={FIELD}
						/>
					</label>
				</div>

				<div className="
					mt-8
					flex
					justify-end
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
						add student
					</button>
				</div>
			</form>
		</div>
	)
}

// ---- filter ----------------------------------------------------------------

// Ticking nothing means every role, which is also what the funnel starts as —
// so "clear" is just untick everything.
function RoleFilter({ roles, onChange }) {
	const [open, setOpen] = useState(false)
	const wrapper = useRef(null)

	useEffect(() => {
		if (!open) return
		const onDown = (event) => {
			if (!wrapper.current?.contains(event.target)) setOpen(false)
		}
		const onKey = (event) => {
			if (event.key === 'Escape') setOpen(false)
		}
		window.addEventListener('mousedown', onDown)
		window.addEventListener('keydown', onKey)
		return () => {
			window.removeEventListener('mousedown', onDown)
			window.removeEventListener('keydown', onKey)
		}
	}, [open])

	const toggle = (role) =>
		onChange(
			roles.includes(role)
				? roles.filter((kept) => kept !== role)
				: [...roles, role]
		)

	const filtering = roles.length > 0

	return (
		<div ref={wrapper} className="relative">
			<button
				type="button"
				onClick={() => setOpen((was) => !was)}
				aria-label="Filter by role"
				aria-expanded={open}
				className={`
					w-10
					h-10
					flex
					items-center
					justify-center
					rounded-full
					border
					cursor-pointer
					transition-all
					duration-200
					ease-out
					hover:-translate-y-0.5
					hover:shadow-lg
					hover:shadow-black/10
					active:translate-y-0
					active:shadow-none
					${filtering
						? 'bg-blue-med border-blue-med text-white'
						: 'bg-white border-black/20 text-black'}
				`}
			>
				<FilterIcon className="w-[18px] h-[18px]" />
			</button>

			{open && (
				<div className="
					menu-open
					absolute
					right-0
					top-12
					z-40
					w-52
					rounded-[14px]
					bg-white
					p-3
					shadow-[0_10px_30px_rgba(0,0,0,0.2)]
				">
					<p className="
						font-vietnam
						text-[11px]
						uppercase
						tracking-[0.12em]
						text-black/50
						px-1
						pb-2
					">
						role
					</p>

					<div className="
						flex
						flex-col
						gap-0.5
					">
						{ROLES.map((role) => (
							<label
								key={role}
								className="
									flex
									items-center
									gap-2.5
									rounded-[8px]
									px-2
									py-1.5
									font-vietnam
									text-sm
									text-black
									cursor-pointer
									transition-colors
									duration-150
									ease-out
									hover:bg-cream
								"
							>
								<Checkbox
									checked={roles.includes(role)}
									onChange={() => toggle(role)}
									label={role}
								/>
								{role}
							</label>
						))}
					</div>

					<button
						type="button"
						onClick={() => onChange([])}
						disabled={!filtering}
						className={`
							mt-2
							w-full
							rounded-full
							py-1.5
							font-vietnam
							font-semibold
							text-xs
							transition-colors
							duration-150
							ease-out
							${filtering
								? 'text-black/70 cursor-pointer hover:bg-cream'
								: 'text-black/25 cursor-not-allowed'}
						`}
					>
						show all roles
					</button>
				</div>
			)}
		</div>
	)
}

// ---- page ------------------------------------------------------------------

// `joined` falls through to the string branch on purpose: 'YYYY-MM-DD' sorts
// chronologically as text, so it needs no special case.
function compare(a, b, key) {
	if (key === 'id' || key === 'points') return a[key] - b[key]
	if (key === 'role') return ROLE_ORDER[a.role] - ROLE_ORDER[b.role]
	return a[key].localeCompare(b[key])
}

export default function OfficerStudents() {
	const [students, setStudents] = useState(seedStudents)
	const [query, setQuery] = useState('')
	const [roles, setRoles] = useState([])
	const [sort, setSort] = useState({ key: 'id', dir: 'asc' })
	const [selected, setSelected] = useState([])
	const [page, setPage] = useState(1)
	const [adding, setAdding] = useState(false)
	const [confirmingDelete, setConfirmingDelete] = useState(false)

	// null = closed; otherwise the row whose pill was clicked and the rectangle
	// that pill occupied, which is what the menu positions itself against.
	const [roleMenu, setRoleMenu] = useState(null)

	// How many rows a page holds is a question about the window, not about the
	// data: the sheet stretches from the toolbar down to the bottom of the
	// sidebar, and takes however many rows fit in what's left. That's what keeps
	// the last row and the pager sitting on the sidebar's bottom edge at any
	// window size instead of stopping short or running past it.
	const sheet = useRef(null)
	const rowMetrics = useRef({ head: HEAD_HEIGHT, row: ROW_HEIGHT })
	const [pageSize, setPageSize] = useState(10)

	// Search and filter change which rows exist, so page 3 of the old list is
	// meaningless against the new one — both reset to the top.
	const search = (value) => {
		setQuery(value)
		setPage(1)
	}

	const filterRoles = (value) => {
		setRoles(value)
		setPage(1)
	}

	// A second click on the sorted column flips it; a first click on any other
	// starts that one ascending.
	const sortBy = (key) =>
		setSort((prev) =>
			prev.key === key
				? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
				: { key, dir: 'asc' }
		)

	const needle = query.trim().toLowerCase()
	const rows = students
		.filter((student) => roles.length === 0 || roles.includes(student.role))
		.filter((student) =>
			needle === '' ||
			[student.first, student.last, student.username, student.role, String(student.id)]
				.some((field) => field.toLowerCase().includes(needle))
		)
		// Ties break on id so equal points (or duplicate names) hold a stable
		// order instead of shuffling between renders.
		.sort((a, b) => {
			const order = compare(a, b, sort.key) || a.id - b.id
			return sort.dir === 'asc' ? order : -order
		})

	const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
	// Deleting the last row of the last page can leave `page` past the end, so
	// the shown page is clamped rather than tracked.
	const current = Math.min(page, pageCount)
	const visible = rows.slice((current - 1) * pageSize, current * pageSize)

	// The sheet is a flex child, so its height comes from the window rather than
	// from the rows inside it — measuring it can't feed back into itself. Row
	// heights are read off the table and remembered, because the one row an
	// empty table draws is the tall "nothing matched" notice and measuring that
	// would collapse the page to a single row.
	useEffect(() => {
		const box = sheet.current
		if (!box) return

		const fit = () => {
			// a hidden tab or a collapsed pane measures zero, and taking that at
			// face value would drop the page to one row and leave it there until
			// something resized. Better to keep the last real count.
			if (box.clientHeight === 0) return

			const head = box.querySelector('thead')?.getBoundingClientRect().height
			const row = box.querySelector('tbody tr[data-student]')?.getBoundingClientRect().height
			if (head) rowMetrics.current.head = head
			if (row) rowMetrics.current.row = row
			const space = box.clientHeight - rowMetrics.current.head
			setPageSize(Math.max(1, Math.floor(space / rowMetrics.current.row)))
		}

		fit()
		const observer = new ResizeObserver(fit)
		observer.observe(box)
		// the observer catches the sheet changing size for reasons of its own
		// (a longer toolbar, a zoom change); the window listener is the one that
		// reliably fires when the window itself is dragged to a new size
		window.addEventListener('resize', fit)
		return () => {
			observer.disconnect()
			window.removeEventListener('resize', fit)
		}
	}, [rows.length])

	// Anyone on staff can only be removed by an admin; officers and treasurers
	// are left with plain members. Same rule the API has to enforce for real —
	// this only keeps the UI from offering what the server would refuse.
	const isAdmin = hasRole('admin', currentRole)
	const canRemove = (student) => isAdmin || student.role === 'member'

	const isSelected = (id) => selected.includes(id)
	const toggleRow = (id) =>
		setSelected((prev) =>
			prev.includes(id) ? prev.filter((kept) => kept !== id) : [...prev, id]
		)

	// The header box works on what's on screen: every row the current page
	// shows that this officer is allowed to remove, without disturbing rows
	// selected on other pages.
	const pageIds = visible.filter(canRemove).map((student) => student.id)
	const allOnPage = pageIds.length > 0 && pageIds.every(isSelected)
	const someOnPage = !allOnPage && pageIds.some(isSelected)

	const togglePage = () =>
		setSelected((prev) =>
			allOnPage
				? prev.filter((id) => !pageIds.includes(id))
				: [...new Set([...prev, ...pageIds])]
		)

	// Selection can outlive a filter change, so the confirmation is built from
	// the full roster rather than the visible rows. The rank check runs again
	// here: a row promoted out of reach while it sat ticked shouldn't ride along
	// into the delete.
	const selectedStudents = students.filter(
		(student) => isSelected(student.id) && canRemove(student)
	)
	const selectedIds = selectedStudents.map((student) => student.id)

	const deleteSelected = () => {
		setStudents((prev) =>
			prev.filter((student) => !selectedIds.includes(student.id))
		)
		setSelected([])
		setConfirmingDelete(false)
	}

	const addStudent = (values) => {
		setStudents((prev) => [
			...prev,
			{
				...values,
				id: Math.max(0, ...prev.map((student) => student.id)) + 1,
				points: 0,
				joined: today(),
				photo: null,
			},
		])
		setAdding(false)
	}

	// Clicking the pill that's already open closes it; any other pill moves the
	// menu over to that row.
	const openRoleMenu = (id) => (anchor) =>
		setRoleMenu((prev) => (prev?.id === id ? null : { id, anchor }))

	// Only ever reachable as an admin, since nobody else is given the pill to
	// click. Promoting someone who was already ticked leaves them ticked, which
	// is fine — an admin may delete any rank.
	const changeRole = (role) => {
		setStudents((prev) =>
			prev.map((student) =>
				student.id === roleMenu.id ? { ...student, role } : student
			)
		)
		setRoleMenu(null)
	}

	return (
		// the shell's content area scrolls, which makes it a clipping box: with
		// nothing between the table and its edge the card's shadow gets sliced
		// off down the left and along the bottom. The padding is what the
		// shadow falls into.
		<DashboardShell className="px-3">
			{/* a column the height of the shell: toolbar and pager keep their own
			    size and the sheet takes everything between them, which is what
			    lands the pager on the sidebar's bottom edge. page-stagger brings
			    the three in one after another on arrival (see globals.css) */}
			<div className="
				page-stagger
				flex
				flex-col
				h-full
			">
				{/* the title and the toolbar share a row, both sitting on the cream —
				    the white belongs to the table alone */}
				<div className="
					flex
					shrink-0
					items-end
					justify-between
					gap-4
					pt-15
					pb-6
				">
					<div className="
						flex
						items-center
						gap-3
					">
						<h1 className="
							font-canobis
							text-black
							text-[35px]
							[-webkit-text-stroke:1px_black]
							leading-none
							select-none

						">
							Students
						</h1>
						<span className="
							flex
							items-center
							justify-center
							rounded-full
							bg-yellow
							px-3
							h-7
							min-w-7
							font-vietnam
							font-semibold
							text-sm
							text-black
							tabular-nums
						">
							{rows.length}
						</span>
					</div>

					<div className="
						flex
						items-center
						gap-3
					">
						<div className="
							flex
							items-center
							gap-2
							border-b
							border-black/25
							pb-1
							w-56
							transition-colors
							duration-200
							ease-out
							focus-within:border-black
						">
							<SearchIcon className="w-4 h-4 shrink-0 text-black/50" />
							<input
								type="search"
								value={query}
								onChange={(event) => search(event.target.value)}
								placeholder="Search"
								aria-label="Search students"
								className="
									w-full
									bg-transparent
									font-vietnam
									text-sm
									text-black
									outline-none
									placeholder:text-black/40
								"
							/>
						</div>

						{/* only here once something is ticked, so the roster's resting
						    state has no delete button to hit by accident */}
						{selectedStudents.length > 0 && (
							<button
								type="button"
								onClick={() => setConfirmingDelete(true)}
								className="
									flex
									items-center
									gap-2
									rounded-full
									bg-red
									px-4
									h-10
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
								<TrashIcon className="w-4 h-4" />
								delete {selectedStudents.length}
							</button>
						)}

						<RoleFilter roles={roles} onChange={filterRoles} />

						<button
							type="button"
							onClick={() => setAdding(true)}
							className="
								flex
								items-center
								gap-1.5
								rounded-[10px]
								bg-salmon
								pl-3
								pr-5
								h-10
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
								active:translate-y-0
								active:shadow-none
							"
						>
							<PlusIcon className="w-4 h-4" />
							Add a student
						</button>
					</div>
				</div>

				{/* the corners are rounded on the outer card and the scrolling happens
				    on the inner one: with both on the same element a narrow window
				    clips the last column away with no way to reach it — and focusing
				    a row's hidden checkbox drags the whole table sideways */}
				<div
					ref={sheet}
					className="
						flex-1
						min-h-0
						rounded-[16px]
						bg-white
						overflow-hidden
						shadow-[0px_0px_20px_rgba(0,0,0,0.4)]
					"
				>
					<div className="overflow-x-auto">
						<table className="
							w-full
							min-w-[820px]
							border-collapse
						">
							<thead>
								<tr className="border-b border-black/10">
									{/* the tick column carries the sheet's left margin, so it
									    gets more room on its left than between columns */}
									<th scope="col" className="w-12 pl-4 pr-2 py-3">
										<Checkbox
											checked={allOnPage}
											mixed={someOnPage}
											disabled={pageIds.length === 0}
											onChange={togglePage}
											label="Select every student on this page"
											title={
												pageIds.length === 0
													? 'nothing on this page you can remove'
													: undefined
											}
										/>
									</th>
									{/* a picture has nothing to sort on, so this head stays a
									    plain label */}
									<th scope="col" className="
										w-20
										px-2
										py-3
										text-left
										font-vietnam
										font-bold
										text-[12px]
										uppercase
										tracking-[0.08em]
										text-black
									">
										photo
									</th>
									<SortHeader label="id" column="id" sort={sort} onSort={sortBy} />
									<SortHeader label="first name" column="first" sort={sort} onSort={sortBy} />
									<SortHeader label="last name" column="last" sort={sort} onSort={sortBy} />
									<SortHeader label="username" column="username" sort={sort} onSort={sortBy} />
									<SortHeader label="role" column="role" sort={sort} onSort={sortBy} />
									<SortHeader label="points" column="points" sort={sort} onSort={sortBy} />
									<SortHeader label="joined" column="joined" sort={sort} onSort={sortBy} />
								</tr>
							</thead>

							<tbody>
								{visible.map((student) => (
									<tr
										key={student.id}
										data-student
										className={`
											border-b
											border-black/[0.07]
											last:border-b-0
											transition-colors
											duration-150
											ease-out
											${isSelected(student.id) ? 'bg-blue-light/25' : 'hover:bg-cream'}
										`}
									>
										<td className="pl-4 pr-2 py-2.5">
											<Checkbox
												checked={isSelected(student.id)}
												disabled={!canRemove(student)}
												onChange={() => toggleRow(student.id)}
												label={`Select ${student.first} ${student.last}`}
												title={
													canRemove(student)
														? undefined
														: `only an admin can remove ${student.role}s`
												}
											/>
										</td>
										<td className="px-2 py-2.5">
											<Avatar student={student} />
										</td>
										<td className="
											px-2
											py-2.5
											font-vietnam
											text-sm
											text-black/70
											tabular-nums
										">
											{student.id}
										</td>
										<td className="
											px-2
											py-2.5
											font-vietnam
											text-sm
											text-black
										">
											{student.first}
										</td>
										<td className="
											px-2
											py-2.5
											font-vietnam
											text-sm
											text-black
										">
											{student.last}
										</td>
										<td className="
											px-2
											py-2.5
											font-vietnam
											text-sm
											text-black/70
										">
											{student.username}
										</td>
										{/* only an admin gets the clickable version — for anyone
										    else the role is a plain label, with no caret
										    advertising a menu they can't open */}
										<td className="px-2 py-2.5">
											{isAdmin ? (
												<RolePill
													role={student.role}
													open={roleMenu?.id === student.id}
													onOpen={openRoleMenu(student.id)}
												/>
											) : (
												<RoleTag
													role={student.role}
													title="only an admin can change roles"
												/>
											)}
										</td>
										<td className="
											px-2
											py-2.5
											font-vietnam
											font-semibold
											text-sm
											text-black
											tabular-nums
										">
											{student.points}
										</td>
										<td className="
											px-2
											py-2.5
											font-vietnam
											text-sm
											text-black/70
											whitespace-nowrap
										">
											{prettyDate(student.joined)}
										</td>
									</tr>
								))}

								{visible.length === 0 && (
									<tr>
										<td
											colSpan={9}
											className="
												px-4
												py-16
												text-center
												font-vietnam
												text-sm
												text-black/45
											"
										>
											no students match that search
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				</div>

				{/* pb-4 matches the sidebar's own p-4, which is what lands the
				    arrows on the same line as the profile button at its foot */}
				<div className="
					flex
					shrink-0
					items-center
					justify-center
					gap-4
					pt-6
					pb-4
				">
					<button
						type="button"
						onClick={() => setPage(current - 1)}
						disabled={current === 1}
						aria-label="Previous page"
						className={`
							w-9
							h-9
							flex
							items-center
							justify-center
							rounded-full
							transition-all
							duration-200
							ease-out
							${current === 1
								? 'bg-white text-black/25 cursor-not-allowed'
								: `bg-white
								   text-black
								   cursor-pointer
								   hover:-translate-y-0.5
								   hover:shadow-lg
								   hover:shadow-black/10
								   active:translate-y-0
								   active:shadow-none`}
						`}
					>
						<ChevronIcon className="w-4 h-4 rotate-180" />
					</button>

					<span className="
						font-vietnam
						text-sm
						text-black/60
						tabular-nums
						select-none
					">
						page {current} of {pageCount}
					</span>

					<button
						type="button"
						onClick={() => setPage(current + 1)}
						disabled={current === pageCount}
						aria-label="Next page"
						className={`
							w-9
							h-9
							flex
							items-center
							justify-center
							rounded-full
							transition-all
							duration-200
							ease-out
							${current === pageCount
								? 'bg-white text-black/25 cursor-not-allowed'
								: `bg-salmon
								   text-white
								   cursor-pointer
								   hover:-translate-y-0.5
								   hover:shadow-lg
								   hover:shadow-black/20
								   active:translate-y-0
								   active:shadow-none`}
						`}
					>
						<ChevronIcon className="w-4 h-4" />
					</button>
				</div>
			</div>

			{/* one menu for the whole table, moved to whichever pill is open —
			    it lives out here because it's positioned against the viewport,
			    not against the cell it belongs to */}
			{roleMenu && (
				<RoleMenu
					anchor={roleMenu.anchor}
					current={students.find((student) => student.id === roleMenu.id)?.role}
					onPick={changeRole}
					onClose={() => setRoleMenu(null)}
				/>
			)}

			{adding && (
				<AddStudentDialog
					onClose={() => setAdding(false)}
					onSave={addStudent}
				/>
			)}

			{confirmingDelete && (
				<ConfirmDeleteDialog
					students={selectedStudents}
					onCancel={() => setConfirmingDelete(false)}
					onConfirm={deleteSelected}
				/>
			)}
		</DashboardShell>
	)
}
