'use client'

import { useEffect, useState } from 'react'
import { Card, CardNote, CardTitle, FIELD } from '@/components/analytics/parts'
import { dues as duesApi, yearTargets } from '@/lib/api'
import { money, prettyDate, today } from '@/lib/finances'
import { roleLabel } from '@/lib/roles'

// The treasurer's dues sheet for the year on screen: every member, paid or
// not, and the button that marks them paid. Paying writes an income row under
// 'dues', so the income summary, the balance line and the ledger all move with
// it — which is why it calls `onChange` (the page re-reads the books).
//
// The amount at the top is what a member owes that year; it's the default for
// "paid", and stored with the year's other targets. "waive" records the year as
// settled with no money moving (and no ledger row).
//
// Taking a payment back deletes its ledger row too (src/routes/duesRoutes.js).

const FILTERS = [
	{ key: 'all', label: 'all' },
	{ key: 'unpaid', label: 'unpaid' },
	{ key: 'paid', label: 'paid' },
]

function SmallButton({ onClick, disabled, tone = 'plain', title, children }) {
	const tones = {
		plain: 'border border-black/25 text-black hover:border-black',
		green: 'bg-green text-[#295212] hover:brightness-95',
		quiet: 'text-black/45 hover:text-black',
	}
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			title={title}
			className={`
				rounded-full
				px-3
				py-1
				font-vietnam
				font-semibold
				text-xs
				whitespace-nowrap
				transition-all
				duration-200
				ease-out
				${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
				${tones[tone]}
			`}
		>
			{children}
		</button>
	)
}

export default function DuesCard({ year, onChange }) {
	const [data, setData] = useState(null)
	const [error, setError] = useState(null)
	const [busy, setBusy] = useState(null)
	const [query, setQuery] = useState('')
	const [filter, setFilter] = useState('all')
	// the owed amount as typed, before it's saved
	const [amountDraft, setAmountDraft] = useState('')

	useEffect(() => {
		if (!year) return
		let live = true
		duesApi
			.list(year)
			.then((reply) => {
				if (!live) return
				setData(reply)
				setAmountDraft(reply.duesAmount ? String(reply.duesAmount) : '')
				setError(null)
			})
			.catch((err) => live && setError(err.message))
		return () => { live = false }
	}, [year])

	const reload = async () => {
		const reply = await duesApi.list(year)
		setData(reply)
	}

	const owed = data?.duesAmount ?? 0

	const saveAmount = async () => {
		const amount = Number(amountDraft)
		if (!Number.isFinite(amount) || amount < 0 || amount === owed) return
		setError(null)
		try {
			await yearTargets.set(year, { duesAmount: amount })
			setData((previous) => ({ ...previous, duesAmount: amount }))
		} catch (err) {
			setError(err.message)
		}
	}

	const run = async (id, call) => {
		setBusy(id)
		setError(null)
		try {
			await call()
			await reload()
			await onChange?.()
		} catch (err) {
			setError(err.message)
		} finally {
			setBusy(null)
		}
	}

	const pay = (member, amount) =>
		run(member.userId, () => duesApi.pay({ memberId: member.userId, schoolYear: year, amount, paidOn: today() }))
	const undo = (member) => run(member.userId, () => duesApi.remove(member.payment.duesId))

	const members = data?.members ?? []
	const paid = members.filter((member) => member.payment)
	const collected = paid.reduce((total, member) => total + member.payment.amount, 0)
	const needle = query.trim().toLowerCase()
	const shown = members
		.filter((member) => filter === 'all' || (filter === 'paid') === Boolean(member.payment))
		.filter((member) =>
			needle === '' ||
			[member.firstName, member.lastName, member.username].some((field) => field.toLowerCase().includes(needle)))

	return (
		<Card className="
			flex
			flex-col
		">
			<div className="
				flex
				flex-wrap
				items-start
				justify-between
				gap-4
			">
				<div>
					<CardTitle>dues</CardTitle>
					<CardNote>
						{data
							? `${paid.length} of ${members.length} paid for ${year} · ${money(collected)} collected`
							: `who's paid for ${year}`}
					</CardNote>
				</div>

				<label className="
					flex
					items-center
					gap-2
					font-vietnam
					text-sm
					text-black/60
				">
					owed per member
					<span className="
						relative
						block
						w-[110px]
					">
						<span className="
							pointer-events-none
							absolute
							left-3
							top-1/2
							-translate-y-1/2
							text-black/45
						">
							$
						</span>
						<input
							type="number"
							min="0"
							step="5"
							value={amountDraft}
							onChange={(event) => setAmountDraft(event.target.value)}
							onBlur={saveAmount}
							onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
							placeholder="0"
							aria-label={`Dues owed per member for ${year}`}
							className={`${FIELD} pl-7 tabular-nums`}
						/>
					</span>
				</label>
			</div>

			<div className="
				mt-5
				flex
				flex-wrap
				items-center
				gap-3
			">
				<div className="
					flex-1
					min-w-[160px]
				">
					<input
						type="search"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Search members"
						aria-label="Search members"
						className={FIELD}
					/>
				</div>
				<div className="
					flex
					rounded-full
					bg-cream
					p-1
				">
					{FILTERS.map((option) => (
						<button
							key={option.key}
							type="button"
							onClick={() => setFilter(option.key)}
							className={`
								rounded-full
								px-3
								py-1
								font-vietnam
								font-semibold
								text-xs
								cursor-pointer
								transition-colors
								duration-200
								${filter === option.key ? 'bg-white text-black shadow-sm' : 'text-black/50 hover:text-black'}
							`}
						>
							{option.label}
						</button>
					))}
				</div>
			</div>

			{error && (
				<p className="
					mt-3
					font-vietnam
					text-sm
					text-salmon-dark
				">
					{error}
				</p>
			)}

			<ul className="
				mt-4
				max-h-[420px]
				overflow-y-auto
				divide-y
				divide-black/[0.07]
			">
				{shown.map((member) => {
					const name = [member.firstName, member.lastName].filter(Boolean).join(' ') || `@${member.username}`
					const working = busy === member.userId
					return (
						<li
							key={member.userId}
							className="
								flex
								flex-wrap
								items-center
								justify-between
								gap-3
								py-2.5
							"
						>
							<div className="min-w-0">
								<p className="
									font-vietnam
									font-semibold
									text-sm
									text-black
									truncate
								">
									{name}
								</p>
								<p className="
									font-vietnam
									text-xs
									text-black/45
								">
									@{member.username} · {roleLabel(member.role)}
								</p>
							</div>

							{member.payment ? (
								<div className="
									flex
									items-center
									gap-2
								">
									<span className="
										font-vietnam
										text-xs
										font-semibold
										text-green-dark
									">
										{member.payment.amount > 0
											? `paid ${money(member.payment.amount)} · ${prettyDate(member.payment.paidOn)}`
											: 'waived'}
									</span>
									<SmallButton tone="quiet" onClick={() => undo(member)} disabled={working} title="Take this payment back (its ledger row goes too)">
										{working ? '…' : 'undo'}
									</SmallButton>
								</div>
							) : (
								<div className="
									flex
									items-center
									gap-2
								">
									<SmallButton
										tone="green"
										onClick={() => pay(member, owed)}
										disabled={working || owed <= 0}
										title={owed > 0 ? `Mark ${money(owed)} paid today` : 'Set the amount owed first'}
									>
										{working ? 'saving…' : 'mark paid'}
									</SmallButton>
									<SmallButton onClick={() => pay(member, 0)} disabled={working} title="Settle the year with no money moving">
										waive
									</SmallButton>
								</div>
							)}
						</li>
					)
				})}

				{data && shown.length === 0 && (
					<li className="
						py-8
						text-center
						font-vietnam
						text-sm
						text-black/45
					">
						{members.length === 0 ? 'no members yet' : 'nobody matches that'}
					</li>
				)}
			</ul>
		</Card>
	)
}
