'use client'

import { useState } from 'react'
import DashboardShell from '@/components/dashboards/DashboardShell'
import { useDismiss } from '@/lib/dismiss'
import {
	Card,
	CardNote,
	CardTitle,
	CategoryTag,
	BalanceCard,
	CheckIcon,
	CloseIcon,
	ColumnFilter,
	ConfirmDialog,
	Dialog,
	DialogActions,
	FIELD,
	GrantTracker,
	Label,
	MonthStats,
	PageControls,
	PencilIcon,
	PlusIcon,
	ReceiptIcon,
	Select,
	SortHeader,
	StatusPill,
	SummaryCard,
	TrashIcon,
} from '@/components/analytics/parts'
import {
	EXPENSE_BUDGET,
	EXPENSE_CATEGORIES,
	GRANT_STATUSES,
	INCOME_CATEGORIES,
	INCOME_GOAL,
	REQUEST_STATUSES,
	categoryColor,
	categoryLabel,
	balanceSeries,
	inYear,
	money,
	monthStats,
	nextId,
	prettyDate,
	schoolYear,
	seedExpenses,
	seedGrants,
	seedIncome,
	seedRequests,
	sum,
	today,
	total,
	totalsByCategory,
	yearsIn,
} from '@/lib/finances'

// /analytics for the treasurer: the same books the officers read, plus every
// control for keeping them. Officers who aren't treasurer get OfficerAnalytics,
// which is this page with the pencils taken off.
//
// What only lives here:
//
//   the ledgers — income, expenses and grants, each row addable, editable and
//     deletable from the one card at the bottom. Every figure on the page is a
//     sum over these, so correcting a row moves the balance line, both
//     summaries and the three cards at the top with it.
//   the targets — the income goal and the spending budget, edited in place on
//     the summary cards they're measured against.
//   the queue — every officer's compensation requests, not just their own.
//     Approving says the club owes it; reimbursing says it's been paid, and
//     writes the expense row that says where the money went.
//
// The seeds are placeholders until this is talking to the API. Nothing here
// posts anywhere yet — it all lives in this page's state.

// ---- ledger ----------------------------------------------------------------

// One config per tab: the table's columns, what each one sorts on, what the
// funnel filters by, and what the add button says. Keeping the three shapes
// side by side is what stops the income table and the expense table drifting
// apart for no reason.
//
// `sortValue` is what a column compares on rather than what it draws — the
// category column shows a coloured dot and sorts on the name behind it, and
// the date column shows 'Jul 8, 2026' and sorts on '2026-07-08', which orders
// as plain text.
const categoryOptions = (categories) =>
	categories.map((category) => ({
		value: category.key,
		label: category.label,
		node: <CategoryTag category={category.label} color={category.color} />,
	}))

const LEDGERS = {
	income: {
		label: 'income',
		add: 'record income',
		noun: 'entry',
		empty: 'nothing banked this year',
		defaultSort: { key: 'date', dir: 'desc' },
		filter: {
			column: 'category',
			label: 'category',
			options: categoryOptions(INCOME_CATEGORIES),
		},
		columns: [
			{
				key: 'date',
				label: 'date',
				nowrap: true,
				sortValue: (row) => row.date,
				cell: (row) => prettyDate(row.date),
				tone: 'muted',
			},
			{
				key: 'source',
				label: 'source',
				sortValue: (row) => row.source.toLowerCase(),
				cell: (row) => row.source,
				tone: 'strong',
			},
			{
				key: 'category',
				label: 'category',
				sortValue: (row) => categoryLabel(row.category),
				cell: (row) => (
					<CategoryTag
						category={categoryLabel(row.category)}
						color={categoryColor(row.category)}
					/>
				),
			},
			{
				key: 'amount',
				label: 'amount',
				align: 'right',
				nowrap: true,
				sortValue: (row) => row.amount,
				cell: (row) => money(row.amount),
				tone: 'strong',
			},
		],
	},

	expenses: {
		label: 'expenses',
		add: 'record expense',
		noun: 'entry',
		empty: 'nothing spent this year',
		defaultSort: { key: 'date', dir: 'desc' },
		filter: {
			column: 'category',
			label: 'category',
			options: categoryOptions(EXPENSE_CATEGORIES),
		},
		columns: [
			{
				key: 'date',
				label: 'date',
				nowrap: true,
				sortValue: (row) => row.date,
				cell: (row) => prettyDate(row.date),
				tone: 'muted',
			},
			{
				key: 'title',
				label: 'what for',
				sortValue: (row) => row.title.toLowerCase(),
				cell: (row) => (
					<>
						{row.title}
						{/* a row that came from settling a receipt says so, because
						    deleting it is really unpicking someone's reimbursement */}
						{row.requestId && (
							<span className="
								block
								font-vietnam
								text-xs
								text-black/40
							">
								reimbursed to {row.who} · #{row.requestId}
							</span>
						)}
					</>
				),
				tone: 'strong',
			},
			{
				key: 'category',
				label: 'category',
				sortValue: (row) => categoryLabel(row.category),
				cell: (row) => (
					<CategoryTag
						category={categoryLabel(row.category)}
						color={categoryColor(row.category)}
					/>
				),
			},
			{
				key: 'amount',
				label: 'amount',
				align: 'right',
				nowrap: true,
				sortValue: (row) => row.amount,
				cell: (row) => money(row.amount),
				tone: 'strong',
			},
		],
	},

	grants: {
		label: 'grants',
		add: 'add grant',
		noun: 'application',
		empty: 'no applications yet',
		defaultSort: { key: 'due', dir: 'desc' },
		filter: {
			column: 'status',
			label: 'status',
			options: GRANT_STATUSES.map((status) => ({
				value: status,
				label: status,
				node: <StatusPill status={status} />,
			})),
		},
		columns: [
			{
				key: 'name',
				label: 'grant',
				sortValue: (row) => row.name.toLowerCase(),
				cell: (row) => row.name,
				tone: 'strong',
			},
			{
				key: 'org',
				label: 'from',
				sortValue: (row) => row.org.toLowerCase(),
				cell: (row) => row.org,
				tone: 'muted',
			},
			{
				key: 'due',
				label: 'deadline',
				nowrap: true,
				sortValue: (row) => row.due,
				cell: (row) => prettyDate(row.due),
				tone: 'muted',
			},
			{
				key: 'status',
				label: 'status',
				// by how far along it is, not alphabetically — 'awarded' above
				// 'drafting' says nothing anyone means by sorting on status
				sortValue: (row) => GRANT_STATUSES.indexOf(row.status),
				cell: (row) => <StatusPill status={row.status} />,
			},
			{
				key: 'amount',
				label: 'amount',
				align: 'right',
				nowrap: true,
				sortValue: (row) => row.amount,
				cell: (row) => money(row.amount),
				tone: 'strong',
			},
		],
	},
}

function RowButton({ label, onClick, tone = 'plain', children }) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={label}
			title={label}
			className={`
				w-8
				h-8
				shrink-0
				inline-flex
				items-center
				justify-center
				rounded-full
				cursor-pointer
				transition-all
				duration-150
				ease-out
				hover:-translate-y-0.5
				hover:shadow-md
				hover:shadow-black/20
				active:translate-y-0
				active:shadow-none
				${tone === 'danger'
					? 'bg-salmon-lightest text-salmon-dark hover:bg-red hover:text-white'
					: 'bg-cream text-black/60 hover:text-black'}
			`}
		>
			{children}
		</button>
	)
}

// The books, as three tabs of the same table. Every row carries its own pencil
// and bin, because the whole point of this card is that the treasurer can put a
// number right without asking anyone.
//
// Sorting and filtering work the way they do on the roster — click a column to
// sort by it, click again to flip it, and the funnel narrows the table to the
// categories (or statuses) that are ticked. Both are view state and both belong
// to the tab that's open, which is why the page mounts this per tab.
function LedgerCard({ tab, onTab, rows, year, onAdd, onEdit, onDelete }) {
	const ledger = LEDGERS[tab]
	const [sort, setSort] = useState(ledger.defaultSort)
	const [picked, setPicked] = useState([])

	// A second click on the sorted column flips it; a first click on any other
	// starts that one ascending.
	const sortBy = (key) =>
		setSort((previous) =>
			previous.key === key
				? { key, dir: previous.dir === 'asc' ? 'desc' : 'asc' }
				: { key, dir: 'asc' }
		)

	const column = ledger.columns.find((entry) => entry.key === sort.key) ?? ledger.columns[0]

	// Ties break on id so two rows with the same date (or the same amount) hold
	// a stable order instead of shuffling between renders.
	const visible = rows
		.filter((row) => picked.length === 0 || picked.includes(row[ledger.filter.column]))
		.slice()
		.sort((a, b) => {
			const left = column.sortValue(a)
			const right = column.sortValue(b)
			const order = typeof left === 'number'
				? left - right
				: String(left).localeCompare(String(right))
			return (sort.dir === 'asc' ? order : -order) || a.id - b.id
		})

	// The note counts what's on screen rather than what's on file, so a funnel
	// with something ticked reads as an answer: four lab entries, this much.
	const note = tab === 'grants'
		? `${visible.length} applications · ${money(sum(visible.map((row) => row.amount)), false)} asked for, all years`
		: `${visible.length} entries · ${money(total(visible))} in ${year}`

	return (
		<Card>
			<div className="
				flex
				flex-wrap
				items-center
				justify-between
				gap-4
			">
				<div>
					<CardTitle>the books</CardTitle>
					<CardNote>{note}</CardNote>
				</div>

				<div className="
					flex
					flex-wrap
					items-center
					gap-3
				">
					<div className="
						flex
						flex-wrap
						gap-2
					">
						{Object.entries(LEDGERS).map(([key, config]) => (
							<button
								key={key}
								type="button"
								onClick={() => onTab(key)}
								className={`
									rounded-full
									border
									px-4
									py-1.5
									font-vietnam
									text-sm
									cursor-pointer
									transition-all
									duration-200
									ease-out
									hover:-translate-y-0.5
									active:translate-y-0
									${key === tab
										? 'border-black bg-black text-cream'
										: 'border-black/25 bg-white text-black/70 hover:border-black/60'}
								`}
							>
								{config.label}
							</button>
						))}
					</div>

					<ColumnFilter
						label={ledger.filter.label}
						options={ledger.filter.options}
						picked={picked}
						onChange={setPicked}
					/>

					<button
						type="button"
						onClick={onAdd}
						className="
							group
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
						<PlusIcon className="
							w-4
							h-4
							transition-transform
							duration-200
							ease-out
							group-hover:rotate-90
						" />
						{ledger.add}
					</button>
				</div>
			</div>

			<div className="
				mt-5
				max-h-[460px]
				overflow-auto
			">
				<table className="
					w-full
					min-w-[720px]
					border-collapse
				">
					<thead className="
						sticky
						top-0
						bg-white
					">
						<tr className="border-b border-black/10">
							{ledger.columns.map((heading) => (
								<SortHeader
									key={heading.key}
									label={heading.label}
									column={heading.key}
									sort={sort}
									onSort={sortBy}
									align={heading.align}
								/>
							))}
							<th scope="col" className="w-24 px-2 py-3">
								<span className="sr-only">actions</span>
							</th>
						</tr>
					</thead>

					<tbody>
						{visible.map((row) => (
							<tr
								key={row.id}
								className="
									group
									border-b
									border-black/[0.07]
									last:border-b-0
									transition-colors
									duration-150
									ease-out
									hover:bg-cream
								"
							>
								{ledger.columns.map((column) => (
									<td
										key={column.key}
										className={`
											px-2
											py-3
											font-vietnam
											text-sm
											${column.align === 'right' ? 'text-right' : 'text-left'}
											${column.nowrap ? 'whitespace-nowrap' : ''}
											${column.tone === 'strong' ? 'font-semibold text-black' : ''}
											${column.tone === 'muted' ? 'text-black/70' : ''}
											${column.tone ? '' : 'text-black'}
											${column.align === 'right' ? 'tabular-nums' : ''}
										`}
									>
										{column.cell(row)}
									</td>
								))}

								<td className="px-2 py-3">
									<div className="
										flex
										items-center
										justify-end
										gap-2
									">
										<RowButton label="Edit" onClick={() => onEdit(row)}>
											<PencilIcon className="w-4 h-4" />
										</RowButton>
										<RowButton label="Delete" tone="danger" onClick={() => onDelete(row)}>
											<TrashIcon className="w-4 h-4" />
										</RowButton>
									</div>
								</td>
							</tr>
						))}

						{visible.length === 0 && (
							<tr>
								<td
									colSpan={ledger.columns.length + 1}
									className="
										px-4
										py-12
										text-center
										font-vietnam
										text-sm
										text-black/45
									"
								>
									{picked.length > 0
										? `nothing filed under that ${ledger.filter.label}`
										: ledger.empty}
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</Card>
	)
}

// ---- ledger dialogs --------------------------------------------------------

// Income and expenses are the same four fields under different names, so
// they're the same form. `entry` null means adding; anything else is the row
// being corrected, and the form opens on what it currently says.
function EntryDialog({ kind, entry, onClose, onSave }) {
	const { closing, dismiss } = useDismiss()
	const close = () => dismiss(onClose)

	const income = kind === 'income'
	const categories = income ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
	const field = income ? 'source' : 'title'

	const [form, setForm] = useState({
		date: entry?.date ?? today(),
		description: entry?.[field] ?? '',
		category: entry?.category ?? categories[0].key,
		amount: entry ? String(entry.amount) : '',
	})

	const set = (key) => (event) =>
		setForm((previous) => ({ ...previous, [key]: event.target.value }))

	const amount = Number(form.amount)
	const ready =
		form.description.trim() !== '' &&
		form.date !== '' &&
		form.amount !== '' &&
		Number.isFinite(amount) &&
		amount > 0

	const submit = (event) => {
		event.preventDefault()
		if (!ready) return
		dismiss(() =>
			onSave({
				date: form.date,
				[field]: form.description.trim(),
				category: form.category,
				amount,
			})
		)
	}

	return (
		<Dialog
			title={entry
				? `edit ${income ? 'income' : 'expense'}`
				: `record ${income ? 'income' : 'expense'}`}
			note={income
				? 'Goes straight into the income summary and the balance line.'
				: 'Goes straight into the expense summary and the balance line.'}
			onClose={close}
			onSubmit={submit}
			closing={closing}
		>
			<div className="
				mt-6
				flex
				flex-col
				gap-4
			">
				<label className="block">
					<Label>{income ? 'source' : 'what for'}</Label>
					<input
						type="text"
						value={form.description}
						onChange={set('description')}
						placeholder={income ? 'Fall dues — first wave' : 'Bath bomb lab supplies'}
						className={FIELD}
					/>
				</label>

				<div className="
					grid
					grid-cols-2
					gap-4
				">
					<label className="block">
						<Label>category</Label>
						<select
							value={form.category}
							onChange={set('category')}
							className={`${FIELD} cursor-pointer`}
						>
							{categories.map((category) => (
								<option key={category.key} value={category.key}>
									{category.label}
								</option>
							))}
						</select>
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
				</div>

				<label className="block">
					<Label>amount</Label>
					<div className="relative">
						<span className="
							pointer-events-none
							absolute
							left-4
							top-1/2
							-translate-y-1/2
							font-vietnam
							text-sm
							text-black/45
						">
							$
						</span>
						<input
							type="number"
							min="0"
							step="0.01"
							value={form.amount}
							onChange={set('amount')}
							placeholder="0.00"
							className={`${FIELD} pl-8 tabular-nums`}
						/>
					</div>
				</label>
			</div>

			<DialogActions
				onCancel={close}
				submitLabel={entry ? 'save changes' : 'record it'}
				ready={ready}
			/>
		</Dialog>
	)
}

// A grant is tracked from before it's sent, so `amount` is what was asked for
// and the status is what says whether the club ever saw it. Only 'awarded' ones
// count toward money in hand — and the deposit itself is a separate income row,
// because the cheque and the decision don't arrive on the same day.
function GrantDialog({ grant, onClose, onSave }) {
	const { closing, dismiss } = useDismiss()
	const close = () => dismiss(onClose)

	const [form, setForm] = useState({
		name: grant?.name ?? '',
		org: grant?.org ?? '',
		amount: grant ? String(grant.amount) : '',
		status: grant?.status ?? GRANT_STATUSES[0],
		due: grant?.due ?? today(),
	})

	const set = (key) => (event) =>
		setForm((previous) => ({ ...previous, [key]: event.target.value }))

	const amount = Number(form.amount)
	const ready =
		form.name.trim() !== '' &&
		form.org.trim() !== '' &&
		form.due !== '' &&
		form.amount !== '' &&
		Number.isFinite(amount) &&
		amount > 0

	const submit = (event) => {
		event.preventDefault()
		if (!ready) return
		dismiss(() =>
			onSave({
				name: form.name.trim(),
				org: form.org.trim(),
				amount,
				status: form.status,
				due: form.due,
			})
		)
	}

	return (
		<Dialog
			title={grant ? 'edit grant' : 'add a grant'}
			note="Awarding one doesn't bank it — record the deposit as income when the money lands."
			onClose={close}
			onSubmit={submit}
			closing={closing}
		>
			<div className="
				mt-6
				flex
				flex-col
				gap-4
			">
				<label className="block">
					<Label>grant</Label>
					<input
						type="text"
						value={form.name}
						onChange={set('name')}
						placeholder="STEM Outreach Mini-Grant"
						className={FIELD}
					/>
				</label>

				<label className="block">
					<Label>from</Label>
					<input
						type="text"
						value={form.org}
						onChange={set('org')}
						placeholder="College of Sciences"
						className={FIELD}
					/>
				</label>

				<div className="
					grid
					grid-cols-2
					gap-4
				">
					<label className="block">
						<Label>status</Label>
						<select
							value={form.status}
							onChange={set('status')}
							className={`${FIELD} cursor-pointer`}
						>
							{GRANT_STATUSES.map((status) => (
								<option key={status} value={status}>
									{status}
								</option>
							))}
						</select>
					</label>

					<label className="block">
						<Label>deadline</Label>
						<input
							type="date"
							value={form.due}
							onChange={set('due')}
							className={FIELD}
						/>
					</label>
				</div>

				<label className="block">
					<Label>amount asked for</Label>
					<div className="relative">
						<span className="
							pointer-events-none
							absolute
							left-4
							top-1/2
							-translate-y-1/2
							font-vietnam
							text-sm
							text-black/45
						">
							$
						</span>
						<input
							type="number"
							min="0"
							step="50"
							value={form.amount}
							onChange={set('amount')}
							placeholder="0.00"
							className={`${FIELD} pl-8 tabular-nums`}
						/>
					</div>
				</label>
			</div>

			<DialogActions
				onCancel={close}
				submitLabel={grant ? 'save changes' : 'add grant'}
				ready={ready}
			/>
		</Dialog>
	)
}

// ---- the queue -------------------------------------------------------------

// The receipt photo, full size. Its own component rather than inline in the
// page so it can hold the closing state its exit animation needs.
function PhotoDialog({ request, onClose }) {
	const { closing, dismiss } = useDismiss()

	return (
		<Dialog
			title={request.what}
			note={`${request.who} · ${prettyDate(request.date)} · ${money(request.amount)}`}
			onClose={() => dismiss(onClose)}
			closing={closing}
			width="w-[520px]"
		>
			<img
				src={request.image.preview}
				alt={`Receipt for ${request.what}`}
				className="
					mt-6
					w-full
					rounded-[12px]
				"
			/>
		</Dialog>
	)
}

// Turning someone down costs them their own money, so it can't be done with one
// click and no explanation: the reason is required, it's what the officer sees
// on their own page, and it's what they'd have to answer when they send it back.
function DenyDialog({ request, onClose, onSave }) {
	const { closing, dismiss } = useDismiss()
	const close = () => dismiss(onClose)

	const [reason, setReason] = useState('')
	const ready = reason.trim() !== ''

	const submit = (event) => {
		event.preventDefault()
		if (!ready) return
		dismiss(() => onSave(reason.trim()))
	}

	return (
		<Dialog
			title="deny this request?"
			note={`${request.who} · ${request.what} · ${money(request.amount)}`}
			onClose={close}
			onSubmit={submit}
			closing={closing}
			width="w-[520px]"
		>
			<div className="mt-6">
				<label className="block">
					<Label>why</Label>
					<textarea
						value={reason}
						onChange={(event) => setReason(event.target.value)}
						rows={4}
						autoFocus
						placeholder="What's wrong with it, and what would make it right."
						className={`${FIELD} resize-none`}
					/>
				</label>

				<p className="
					mt-3
					font-vietnam
					text-sm
					text-black/50
				">
					They see this on their own analytics page, and can fix what you&apos;ve
					asked about and send it back to you.
				</p>
			</div>

			<DialogActions
				onCancel={close}
				submitLabel="deny it"
				ready={ready}
				tint="bg-red"
			/>
		</Dialog>
	)
}

function QueueAction({ label, tint, onClick, children }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`
				inline-flex
				items-center
				gap-1
				rounded-full
				pl-2
				pr-3
				py-1.5
				font-vietnam
				font-semibold
				text-[11px]
				whitespace-nowrap
				cursor-pointer
				transition-all
				duration-200
				ease-out
				hover:-translate-y-0.5
				hover:shadow-lg
				hover:shadow-black/20
				active:translate-y-0
				active:shadow-none
				${tint}
			`}
		>
			{children}
			{label}
		</button>
	)
}

// Every officer's receipts, and the two decisions that move one along:
// approving says the club agrees it owes the money, reimbursing says it's been
// handed back — and that second one is what writes the expense row.
function RequestQueue({ requests, filter, onFilter, onApprove, onDeny, onReimburse, onPhoto }) {
	const rows = filter === 'all'
		? requests
		: requests.filter((request) => request.status === filter)

	const waiting = requests.filter((request) => request.status === 'pending')
	const owed = sum(
		requests
			.filter((request) => request.status === 'pending' || request.status === 'approved')
			.map((request) => request.amount)
	)

	return (
		<Card>
			<div className="
				flex
				flex-wrap
				items-center
				justify-between
				gap-4
			">
				<div>
					<CardTitle>compensation requests</CardTitle>
					<CardNote>
						{waiting.length} waiting on you · {money(owed)} to settle
					</CardNote>
				</div>

				<div className="
					flex
					flex-wrap
					gap-2
				">
					{['all', ...REQUEST_STATUSES].map((status) => (
						<button
							key={status}
							type="button"
							onClick={() => onFilter(status)}
							className={`
								rounded-full
								border
								px-4
								py-1.5
								font-vietnam
								text-sm
								cursor-pointer
								transition-all
								duration-200
								ease-out
								hover:-translate-y-0.5
								active:translate-y-0
								${status === filter
									? 'border-black bg-black text-cream'
									: 'border-black/25 bg-white text-black/70 hover:border-black/60'}
							`}
						>
							{status}
						</button>
					))}
				</div>
			</div>

			<div className="
				mt-5
				overflow-x-auto
			">
				{/* fixed columns: what someone bought can be a sentence long, and left
				    to size itself it pushes the buttons off the end of the card. The
				    widths are what let the request cell truncate instead */}
				<table className="
					w-full
					min-w-[760px]
					table-fixed
					border-collapse
				">
					<colgroup>
						<col className="w-[28%]" />
						<col className="w-[13%]" />
						<col className="w-[12%]" />
						<col className="w-[11%]" />
						<col className="w-[12%]" />
						<col className="w-[24%]" />
					</colgroup>
					<thead>
						<tr className="border-b border-black/10">
							{['request', 'officer', 'date', 'amount', 'status', ''].map((heading, index) => (
								<th
									key={heading || 'actions'}
									scope="col"
									className={`
										px-2
										py-3
										font-vietnam
										font-bold
										text-[12px]
										uppercase
										tracking-[0.08em]
										text-black
										whitespace-nowrap
										${index === 3 ? 'text-right' : 'text-left'}
									`}
								>
									{heading}
								</th>
							))}
						</tr>
					</thead>

					<tbody>
						{rows.map((request) => (
							<tr
								key={request.id}
								className="
									border-b
									border-black/[0.07]
									last:border-b-0
									transition-colors
									duration-150
									ease-out
									hover:bg-cream
								"
							>
								<td className="px-2 py-3">
									<div className="
										flex
										items-center
										gap-3
									">
										{/* the photo is the evidence — clickable when there is
										    one, a plain placeholder when there isn't */}
										<button
											type="button"
											onClick={() => request.image && onPhoto(request)}
											disabled={!request.image}
											aria-label={request.image ? 'View receipt photo' : 'No photo attached'}
											className={`
												w-10
												h-10
												shrink-0
												flex
												items-center
												justify-center
												overflow-hidden
												rounded-[8px]
												bg-cream
												transition-transform
												duration-200
												ease-out
												${request.image
													? 'cursor-pointer hover:-translate-y-0.5'
													: 'cursor-default'}
											`}
										>
											{request.image
												? <img
													src={request.image.preview}
													alt=""
													className="
														w-full
														h-full
														object-cover
													"
												/>
												: <ReceiptIcon className="w-5 h-5 text-black/30" />}
										</button>

										<div className="
											min-w-0
											flex-1
										">
											<p className="
												font-vietnam
												font-semibold
												text-sm
												text-black
												truncate
											">
												{request.what}
												<span className="
													ml-2
													font-vietnam
													text-xs
													text-black/35
													tabular-nums
												">
													#{request.id}
												</span>
												{/* one that's been round once already, so the same
												    objection doesn't get raised twice */}
												{request.previousDenial && (
													<span
														title={`previously denied: ${request.previousDenial}`}
														className="
															ml-2
															rounded-full
															bg-yellow-light
															px-2
															py-0.5
															font-vietnam
															font-semibold
															text-[10px]
															uppercase
															tracking-[0.08em]
															text-yellow-dark
														"
													>
														resent
													</span>
												)}
											</p>

											{/* once it's been turned down, the reason is the thing
											    worth reading on the row */}
											<p
												title={request.denialReason ?? request.reason}
												className={`
													font-vietnam
													text-xs
													truncate
													${request.denialReason ? 'text-salmon-dark' : 'text-black/45'}
												`}
											>
												{request.denialReason
													? `denied · ${request.denialReason}`
													: `${categoryLabel(request.category)}${request.reason ? ` · ${request.reason}` : ''}`}
											</p>
										</div>
									</div>
								</td>

								<td className="
									px-2
									py-3
									font-vietnam
									text-sm
									text-black/70
									truncate
								">
									{request.who}
								</td>

								<td className="
									px-2
									py-3
									font-vietnam
									text-sm
									text-black/70
									whitespace-nowrap
								">
									{prettyDate(request.date)}
								</td>

								<td className="
									px-2
									py-3
									font-vietnam
									font-semibold
									text-sm
									text-black
									tabular-nums
									text-right
									whitespace-nowrap
								">
									{money(request.amount)}
								</td>

								<td className="px-2 py-3">
									<StatusPill status={request.status} />
								</td>

								{/* what's offered follows the status, so nothing here can be
								    clicked into a state it shouldn't reach */}
								<td className="px-2 py-3">
									<div className="
										flex
										items-center
										justify-end
										gap-2
									">
										{request.status === 'pending' && (
											<>
												<QueueAction
													label="approve"
													tint="bg-blue-light text-blue-med"
													onClick={() => onApprove(request)}
												>
													<CheckIcon className="w-3 h-3" />
												</QueueAction>
												<QueueAction
													label="deny"
													tint="bg-salmon-lightest text-salmon-dark"
													onClick={() => onDeny(request)}
												>
													<CloseIcon className="w-3 h-3" />
												</QueueAction>
											</>
										)}

										{request.status === 'approved' && (
											<>
												<QueueAction
													label="reimburse"
													tint="bg-green text-green-dark"
													onClick={() => onReimburse(request)}
												>
													<CheckIcon className="w-3 h-3" />
												</QueueAction>
												<QueueAction
													label="deny"
													tint="bg-salmon-lightest text-salmon-dark"
													onClick={() => onDeny(request)}
												>
													<CloseIcon className="w-3 h-3" />
												</QueueAction>
											</>
										)}

										{(request.status === 'reimbursed' || request.status === 'denied') && (
											<span className="
												font-vietnam
												text-xs
												text-black/35
												whitespace-nowrap
											">
												settled
											</span>
										)}
									</div>
								</td>
							</tr>
						))}

						{rows.length === 0 && (
							<tr>
								<td
									colSpan={6}
									className="
										px-4
										py-12
										text-center
										font-vietnam
										text-sm
										text-black/45
									"
								>
									no {filter} requests
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</Card>
	)
}

// ---- page ------------------------------------------------------------------

export default function TreasurerAnalytics() {
	const [income, setIncome] = useState(seedIncome)
	const [expenses, setExpenses] = useState(seedExpenses)
	const [grants, setGrants] = useState(seedGrants)
	const [requests, setRequests] = useState(seedRequests)

	const [goals, setGoals] = useState(INCOME_GOAL)
	const [budgets, setBudgets] = useState(EXPENSE_BUDGET)

	const years = yearsIn(income, expenses)
	const [year, setYear] = useState(years[0])

	const [tab, setTab] = useState('income')
	// null = closed. Otherwise the kind being worked on and the row it's opened
	// against — `row` null means adding a new one.
	const [editing, setEditing] = useState(null)
	const [deleting, setDeleting] = useState(null)
	// the request being turned down, held while its reason is written
	const [denying, setDenying] = useState(null)
	const [queueFilter, setQueueFilter] = useState('all')
	const [photo, setPhoto] = useState(null)

	const yearIncome = inYear(income, year)
	const yearExpenses = inYear(expenses, year)
	const stats = monthStats(income, expenses)

	const listFor = (kind) => (kind === 'income' ? income : kind === 'expenses' ? expenses : grants)
	const setListFor = (kind) =>
		kind === 'income' ? setIncome : kind === 'expenses' ? setExpenses : setGrants

	// The ledger shows one year at a time; grants don't belong to a year the way
	// a deposit does — an application open now is usually for next year — so
	// that tab shows every one of them. Ordering is the card's own business.
	const rows = tab === 'grants'
		? grants
		: tab === 'income' ? yearIncome : yearExpenses

	const save = (values) => {
		const { kind, row } = editing
		setListFor(kind)((previous) =>
			row
				? previous.map((entry) => (entry.id === row.id ? { ...entry, ...values } : entry))
				: [...previous, { ...values, id: nextId(previous) }]
		)
		// a row dated outside the year on screen would save and then vanish, so
		// the page follows it to the year it landed in
		if (values.date && schoolYear(values.date) !== year) setYear(schoolYear(values.date))
		setEditing(null)
	}

	const remove = () => {
		const { kind, row } = deleting
		setListFor(kind)((previous) => previous.filter((entry) => entry.id !== row.id))
		setDeleting(null)
	}

	const patchRequest = (request, changes) =>
		setRequests((previous) =>
			previous.map((entry) => (entry.id === request.id ? { ...entry, ...changes } : entry))
		)

	// Approving clears any earlier objection off the row — it's been answered,
	// and leaving it there would keep flagging a settled argument.
	const approve = (request) => patchRequest(request, { status: 'approved', denialReason: null })

	const deny = (reason) => {
		patchRequest(denying, { status: 'denied', denialReason: reason })
		setDenying(null)
	}

	// Paying someone back is the moment the money actually leaves, so it writes
	// the expense row. It's dated the day of the purchase rather than today, so
	// the spending lands in the month the club incurred it.
	const reimburse = (request) => {
		setExpenses((previous) => [
			...previous,
			{
				id: nextId(previous),
				date: request.date,
				title: request.what,
				category: request.category,
				amount: request.amount,
				requestId: request.id,
				who: request.who,
			},
		])
		patchRequest(request, { status: 'reimbursed', denialReason: null })
	}

	const queue = [...requests].sort((a, b) => b.date.localeCompare(a.date))

	return (
		// The scrolling column is pushed out to the window's top, bottom and right
		// edge — the negative margins cancel the shell's own p-8 on those three
		// sides — and the space is put back as padding *inside* it. Same result on
		// screen, except the scrollbar now runs the full height of the window at
		// the very edge of it rather than floating in a frame of cream.
		//
		// pr-11 is that 32px plus the 12px the cards were already inset by: the
		// column scrolls, which makes it a clipping box, and with nothing between
		// a card and its edge the shadow gets sliced off down the sides. py-8
		// leaves the same air over the first card and under the last one.
		<DashboardShell className="-my-8 -mr-8 py-8 pr-11 pl-3">
			{/* the cards are a level in from the shell, so the stagger is repeated
			    here — otherwise the whole page would arrive as one block */}
			<div className="
				page-stagger
				flex
				flex-col
				gap-6
			">
				<PageControls>
					<Select
						value={year}
						onChange={setYear}
						options={years}
						label="School year"
					/>
				</PageControls>

				<MonthStats stats={stats} />

				{/* the balance line takes two thirds, the grant tracker the rest —
				    and here every grant row opens for editing */}
				<div className="
					grid
					grid-cols-1
					gap-6
					lg:grid-cols-3
				">
					<BalanceCard
						series={balanceSeries(income, expenses, year)}
						year={year}
						note="what was in the account at the close of each month"
					/>

					<GrantTracker
						grants={grants}
						onEdit={(grant) => setEditing({ kind: 'grants', row: grant })}
						onAdd={() => setEditing({ kind: 'grants', row: null })}
					/>
				</div>

				{/* the two summaries, with their targets editable in place */}
				<div className="
					grid
					grid-cols-1
					gap-6
					xl:grid-cols-2
				">
					<SummaryCard
						title="income summary"
						categories={INCOME_CATEGORIES}
						totals={totalsByCategory(yearIncome, INCOME_CATEGORIES)}
						total={total(yearIncome)}
						goal={goals[year] ?? 0}
						goalNote="income goal"
						onGoal={(amount) => setGoals((previous) => ({ ...previous, [year]: amount }))}
						tint="bg-green"
						year={year}
					/>

					<SummaryCard
						title="expense summary"
						categories={EXPENSE_CATEGORIES}
						totals={totalsByCategory(yearExpenses, EXPENSE_CATEGORIES)}
						total={total(yearExpenses)}
						goal={budgets[year] ?? 0}
						goalNote="budget spent"
						onGoal={(amount) => setBudgets((previous) => ({ ...previous, [year]: amount }))}
						tint="bg-orange"
						year={year}
					/>
				</div>

				{/* keyed on the tab so the sort and the funnel start fresh on each
				    one — a category ticked on expenses means nothing on income */}
				<LedgerCard
					key={tab}
					tab={tab}
					onTab={setTab}
					rows={rows}
					year={year}
					onAdd={() => setEditing({ kind: tab, row: null })}
					onEdit={(row) => setEditing({ kind: tab, row })}
					onDelete={(row) => setDeleting({ kind: tab, row })}
				/>

				<RequestQueue
					requests={queue}
					filter={queueFilter}
					onFilter={setQueueFilter}
					onApprove={approve}
					onDeny={setDenying}
					onReimburse={reimburse}
					onPhoto={setPhoto}
				/>
			</div>

			{editing && editing.kind === 'grants' && (
				<GrantDialog
					grant={editing.row}
					onClose={() => setEditing(null)}
					onSave={save}
				/>
			)}

			{editing && editing.kind !== 'grants' && (
				<EntryDialog
					kind={editing.kind}
					entry={editing.row}
					onClose={() => setEditing(null)}
					onSave={save}
				/>
			)}

			{denying && (
				<DenyDialog
					request={denying}
					onClose={() => setDenying(null)}
					onSave={deny}
				/>
			)}

			{deleting && (
				<ConfirmDialog
					title={`delete this ${LEDGERS[deleting.kind].noun}?`}
					body={
						deleting.row.requestId
							? `${deleting.row.title} — ${money(deleting.row.amount)}. This row is ${deleting.row.who}'s reimbursement, and deleting it takes the payout off the books while their request still says reimbursed.`
							: `${deleting.row.source ?? deleting.row.title ?? deleting.row.name} — ${money(deleting.row.amount)}. Every total on this page is a sum over these rows, so they all move. This can't be undone.`
					}
					confirmLabel="delete it"
					onCancel={() => setDeleting(null)}
					onConfirm={remove}
				/>
			)}

			{photo && (
				<PhotoDialog
					request={photo}
					onClose={() => setPhoto(null)}
				/>
			)}
		</DashboardShell>
	)
}
