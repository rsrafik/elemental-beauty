'use client'

import { useState } from 'react'
import DashboardShell from '@/components/dashboards/DashboardShell'
import { currentUser } from '@/lib/roles'
import {
	Card,
	CardNote,
	CardTitle,
	BalanceCard,
	Dialog,
	DialogActions,
	FIELD,
	GrantTracker,
	Label,
	MonthStats,
	PageControls,
	PlusIcon,
	ReceiptIcon,
	Select,
	StatusPill,
	SummaryCard,
} from '@/components/analytics/parts'
import {
	EXPENSE_CATEGORIES,
	EXPENSE_BUDGET,
	INCOME_CATEGORIES,
	INCOME_GOAL,
	REQUEST_STATUSES,
	YEARS,
	balanceSeries,
	inYear,
	money,
	monthStats,
	nextId,
	prettyDate,
	seedExpenses,
	seedGrants,
	seedIncome,
	seedRequests,
	sum,
	total,
	totalsByCategory,
} from '@/lib/finances'

// /analytics — the officer's view of the books. What came in, what went out,
// where the balance sits, which grants are in flight, and where this officer's
// own compensation requests stand.
//
// Two kinds of thing on this page, and the split is the point:
//
//   the club's numbers — the three cards, the balance line, both summaries and
//     the grant tracker. Everyone on staff sees the same figures, and nobody
//     edits them here: the treasurer keeps the ledgers, on their own version of
//     this page.
//   this officer's own — the receipts they've handed in and the status of each.
//     Filed here, tracked here, and nobody else's shown.
//
// A receipt *is* the compensation request: one form, submitted here, settled by
// the treasurer. That's why the receipts card and the transaction history are
// two views of one list — the card is for handing something in and watching it
// move, the table is the whole record.

// ---- receipts --------------------------------------------------------------

// Mounted only while open, so a new receipt always starts on a blank form.
//
// `request` is the other way in: one that came back denied, opened on what it
// said last time with the treasurer's objection at the top of it. Same form
// either way — fixing what was wrong and sending it back is the same act as
// filing it in the first place.
//
// The picked photo is held as an object URL for the preview. Nothing uploads
// yet — it rides along on the request so the thumbnail has something to draw
// once this is posting to the API.
function ReceiptDialog({ request, onClose, onSave }) {
	const [form, setForm] = useState({
		what: request?.what ?? '',
		reason: request?.reason ?? '',
		category: request?.category ?? EXPENSE_CATEGORIES[0].key,
		date: request?.date ?? '',
		amount: request ? String(request.amount) : '',
	})
	const [image, setImage] = useState(request?.image ?? null) // { file, preview }

	const set = (field) => (event) =>
		setForm((previous) => ({ ...previous, [field]: event.target.value }))

	const pickImage = (event) => {
		const file = event.target.files?.[0]
		if (!file) return
		setImage((previous) => {
			if (previous?.preview) URL.revokeObjectURL(previous.preview)
			return { file, preview: URL.createObjectURL(file) }
		})
	}

	const amount = Number(form.amount)
	const ready =
		form.what.trim() !== '' &&
		form.date !== '' &&
		form.amount !== '' &&
		Number.isFinite(amount) &&
		amount > 0

	const submit = (event) => {
		event.preventDefault()
		if (!ready) return
		onSave({
			what: form.what.trim(),
			reason: form.reason.trim(),
			category: form.category,
			date: form.date,
			amount,
			image,
		})
	}

	return (
		<Dialog
			title={request ? 'send it back' : 'submit a receipt'}
			note={request
				? 'Change what they asked about, and it goes back into their queue as pending.'
				: 'The category is what the expense summary files it under. The treasurer sees it as soon as you send it.'}
			onClose={onClose}
			onSubmit={submit}
		>
			{/* the objection, kept in front of the form it's about — answering it is
			    the whole reason this dialog is open */}
			{request?.denialReason && (
				<div className="
					mt-5
					rounded-[12px]
					bg-salmon-lightest
					px-5
					py-4
				">
					<p className="
						font-vietnam
						text-[11px]
						uppercase
						tracking-[0.12em]
						text-salmon-dark
					">
						why it came back
					</p>
					<p className="
						mt-1.5
						font-vietnam
						text-sm
						text-black/75
					">
						{request.denialReason}
					</p>
				</div>
			)}

			<div className="
				mt-6
				flex
				flex-col
				gap-4
			">
				<label className="block">
					<Label>title</Label>
					<input
						type="text"
						value={form.what}
						onChange={set('what')}
						placeholder="Lip gloss base"
						className={FIELD}
					/>
				</label>

				<label className="block">
					<Label>reason</Label>
					<textarea
						value={form.reason}
						onChange={set('reason')}
						rows={3}
						placeholder="What it was bought for."
						className={`${FIELD} resize-none`}
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
							{EXPENSE_CATEGORIES.map((category) => (
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

				<div>
					<Label>receipt photo</Label>
					<div className="
						flex
						items-center
						gap-4
					">
						<div className="
							w-20
							h-20
							shrink-0
							flex
							items-center
							justify-center
							rounded-[10px]
							overflow-hidden
							bg-white
							border
							border-black/25
						">
							{image
								? <img
									src={image.preview}
									alt=""
									className="
										w-full
										h-full
										object-cover
									"
								/>
								: <ReceiptIcon className="w-7 h-7 text-black/25" />}
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
							{image ? 'change photo' : 'upload photo'}
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

			<DialogActions
				onCancel={onClose}
				submitLabel={request ? 'send it back' : 'submit receipt'}
				ready={ready}
			/>
		</Dialog>
	)
}

// Everything handed in that hasn't been paid out yet — waiting, agreed, or sent
// back. Anything reimbursed has stopped being something to watch and lives in
// the table below.
function ReceiptsCard({ receipts, onSubmit, onRevise }) {
	const owed = sum(
		receipts
			.filter((receipt) => receipt.status !== 'denied')
			.map((receipt) => receipt.amount)
	)
	const returned = receipts.filter((receipt) => receipt.status === 'denied').length

	return (
		<Card className="
			flex
			flex-col
		">
			{/* the button keeps its own width in the header rather than stretching
			    across the card, which at full width turns it into a banner */}
			<div className="
				flex
				flex-wrap
				items-center
				justify-between
				gap-4
			">
				<div>
					<CardTitle>receipts</CardTitle>
					<CardNote>
						{receipts.length - returned} in flight · {money(owed)} owed to you
						{returned > 0 && ` · ${returned} sent back`}
					</CardNote>
				</div>

				<button
					type="button"
					onClick={onSubmit}
					className="
						group
						flex
						items-center
						gap-2
						rounded-full
						bg-salmon
						pl-4
						pr-5
						py-2.5
						font-vietnam
						font-semibold
						text-white
						text-sm
						uppercase
						tracking-[0.12em]
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
					submit a receipt
				</button>
			</div>

			<div className="
				mt-4
				flex
				flex-col
				gap-2.5
				overflow-y-auto
			">
				{receipts.map((receipt) => (
					<div
						key={receipt.id}
						className="
							rounded-[12px]
							bg-cream
							px-3
							py-2.5
							transition-transform
							duration-200
							ease-out
							hover:-translate-y-0.5
						"
					>
						<div className="
							flex
							items-center
							gap-3
						">
							<div className="
								w-10
								h-10
								shrink-0
								flex
								items-center
								justify-center
								overflow-hidden
								rounded-[8px]
								bg-white
							">
								{receipt.image
									? <img
										src={receipt.image.preview}
										alt=""
										className="
											w-full
											h-full
											object-cover
										"
									/>
									: <ReceiptIcon className="w-5 h-5 text-black/30" />}
							</div>
	
							{/* same two-line shape as a grant row: the title never has to
							    share its line with the pill */}
							<div className="
								min-w-0
								flex-1
							">
								<div className="
									flex
									items-baseline
									justify-between
									gap-3
								">
									<p className="
										min-w-0
										flex-1
										font-vietnam
										font-semibold
										text-sm
										text-black
										truncate
									">
										{receipt.what}
									</p>
									<span className="
										shrink-0
										font-vietnam
										font-bold
										text-sm
										text-black
										tabular-nums
									">
										{money(receipt.amount)}
									</span>
								</div>
	
								<div className="
									mt-1
									flex
									items-center
									justify-between
									gap-3
								">
									<p className="
										min-w-0
										flex-1
										font-vietnam
										text-xs
										text-black/45
										truncate
									">
										{receipt.category} · {prettyDate(receipt.date)}
									</p>
									<StatusPill status={receipt.status} />
								</div>
							</div>
						</div>

						{/* one that came back: what the treasurer wants changed, and the
						    way to change it. The note is quoted in full rather than
						    truncated — it's an instruction, not a label */}
						{receipt.status === 'denied' && receipt.denialReason && (
							<div className="
								mt-2.5
								rounded-[10px]
								bg-salmon-lightest
								px-3
								py-2.5
							">
								<p className="
									font-vietnam
									text-xs
									text-black/75
								">
									{receipt.denialReason}
								</p>

								<button
									type="button"
									onClick={() => onRevise(receipt)}
									className="
										mt-2.5
										rounded-full
										bg-salmon-dark
										px-4
										py-1.5
										font-vietnam
										font-semibold
										text-xs
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
									fix it and send it back
								</button>
							</div>
						)}
					</div>
				))}

				{receipts.length === 0 && (
					<p className="
						py-8
						text-center
						font-vietnam
						text-sm
						text-black/45
					">
						nothing waiting on the treasurer
					</p>
				)}
			</div>
		</Card>
	)
}

// ---- transaction history ---------------------------------------------------

// The signed-in officer's compensation requests, and where each one got to.
// Filtering is by status because that's the only question anyone brings to this
// table. Every officer's requests together is the treasurer's view, not this
// one — an officer sees their own and nobody else's.
function RequestHistory({ requests, filter, onFilter }) {
	const rows = filter === 'all'
		? requests
		: requests.filter((request) => request.status === filter)

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
					<CardTitle>transaction history</CardTitle>
					<CardNote>
						your compensation requests · {money(owed)} still owed to you
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
				<table className="
					w-full
					min-w-[560px]
					border-collapse
				">
					<thead>
						<tr className="border-b border-black/10">
							{/* no name column: every row on this table is the same person */}
							{['request', 'date', 'status', 'amount'].map((heading) => (
								<th
									key={heading}
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
										${heading === 'amount' ? 'text-right' : 'text-left'}
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
								<td className="
									px-2
									py-3
									font-vietnam
									text-sm
									text-black
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

									{/* the record keeps the reason it was turned down, so the
									    table answers "why" without anyone having to remember */}
									{request.denialReason && (
										<span className="
											block
											font-vietnam
											text-xs
											text-salmon-dark
										">
											{request.denialReason}
										</span>
									)}
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
								<td className="px-2 py-3">
									<StatusPill status={request.status} />
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
							</tr>
						))}

						{rows.length === 0 && (
							<tr>
								<td
									colSpan={4}
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

export default function OfficerAnalytics() {
	const [year, setYear] = useState(YEARS[0])
	const [requests, setRequests] = useState(seedRequests)
	// null = closed. Otherwise the receipt form is open, on a blank one or on the
	// request being sent back.
	const [composing, setComposing] = useState(null)
	const [statusFilter, setStatusFilter] = useState('all')

	// The ledgers are read-only here — an officer can't post to them, so there's
	// nothing to hold in state. What they submit goes into `requests`, and only
	// becomes a line of spending once the treasurer settles it.
	const income = inYear(seedIncome, year)
	const expenses = inYear(seedExpenses, year)
	const stats = monthStats(seedIncome, seedExpenses)

	// Their own requests, newest first. The API has to hold the same line on GET
	// — this filter is for the display, not the gate.
	const mine = requests
		.filter((request) => request.memberId === currentUser.id)
		.sort((a, b) => b.date.localeCompare(a.date))

	// Anything not paid out yet, which includes the ones sent back — those are
	// the ones with something left to do about them.
	const open = mine.filter((request) => request.status !== 'reimbursed')

	// A new receipt joins the list; one being sent back keeps its own id and
	// goes to the back of the queue as pending, carrying the objection it was
	// answering so the treasurer can see this is a second attempt.
	const send = (values) => {
		const revising = composing.request

		setRequests((previous) =>
			revising
				? previous.map((entry) =>
					entry.id === revising.id
						? {
							...entry,
							...values,
							status: 'pending',
							previousDenial: entry.denialReason ?? entry.previousDenial ?? null,
							denialReason: null,
						}
						: entry
				)
				: [
					{
						...values,
						id: nextId(previous),
						memberId: currentUser.id,
						who: `${currentUser.first} ${currentUser.last}`,
						status: 'pending',
					},
					...previous,
				]
		)
		setComposing(null)
	}

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
			{/* no padding under the last card: scrolled to the end, the page stops
			    on the sidebar's bottom edge rather than short of it */}
			<div className="
				flex
				flex-col
				gap-6
			">
				<PageControls>
					<Select
						value={year}
						onChange={setYear}
						options={YEARS}
						label="School year"
					/>
				</PageControls>

				<MonthStats stats={stats} />

				{/* the balance line takes two thirds, the grant tracker the rest */}
				<div className="
					grid
					grid-cols-1
					gap-6
					lg:grid-cols-3
				">
					<BalanceCard
						series={balanceSeries(seedIncome, seedExpenses, year)}
						year={year}
						note="what was in the account at the close of each month"
					/>

					<GrantTracker grants={seedGrants} />
				</div>

				{/* the two summaries, side by side so the split reads as one pair */}
				<div className="
					grid
					grid-cols-1
					gap-6
					xl:grid-cols-2
				">
					<SummaryCard
						title="income summary"
						categories={INCOME_CATEGORIES}
						totals={totalsByCategory(income, INCOME_CATEGORIES)}
						total={total(income)}
						goal={INCOME_GOAL[year]}
						goalNote="income goal"
						tint="bg-green"
						year={year}
					/>

					<SummaryCard
						title="expense summary"
						categories={EXPENSE_CATEGORIES}
						totals={totalsByCategory(expenses, EXPENSE_CATEGORIES)}
						total={total(expenses)}
						goal={EXPENSE_BUDGET[year]}
						goalNote="budget spent"
						tint="bg-orange"
						year={year}
					/>
				</div>

				{/* receipts on the left, the request history filling the rest — but
				    only once there's room for both: a third of a 1280 window leaves
				    the history table narrower than its own columns, and it ends up
				    scrolling sideways with the status hidden off the edge */}
				<div className="
					grid
					grid-cols-1
					gap-6
					2xl:grid-cols-3
				">
					<ReceiptsCard
						receipts={open}
						onSubmit={() => setComposing({ request: null })}
						onRevise={(request) => setComposing({ request })}
					/>

					<div className="2xl:col-span-2">
						<RequestHistory
							requests={mine}
							filter={statusFilter}
							onFilter={setStatusFilter}
						/>
					</div>
				</div>
			</div>

			{composing && (
				<ReceiptDialog
					request={composing.request}
					onClose={() => setComposing(null)}
					onSave={send}
				/>
			)}
		</DashboardShell>
	)
}
