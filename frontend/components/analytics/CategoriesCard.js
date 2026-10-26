'use client'

import { useState } from 'react'
import { Card, CardNote, CardTitle, CategoryTag, FIELD, TrashIcon } from '@/components/analytics/parts'
import { financeCategories as financeCategoriesApi } from '@/lib/api'
import { CATEGORY_COLORS } from '@/lib/finances'

// What the club's money is filed under, for the treasurer (and admin) to add
// to and take from: each one is a slice of its summary's donut, a choice in
// the ledger's form, and — the expense ones — what a receipt is filed under.
//
// Three kinds can't be taken off, and say why instead of offering a bin:
//
//   locked    the app files money under it itself — awarded grants, dues,
//             entry fees and the treasury team's sponsorships (LOCKED in
//             src/financeCategories.js)
//   in use    a ledger row or a receipt is still filed under it — moving
//             them is what frees it, or that money would drop out of both
//             summaries
//   the last  of its half, since the forms always need something to file
//             under
//
// The server refuses all three regardless; this is the page not offering
// what it would refuse. `filedUnder` counts from the books the page already
// has, so a row deleted a moment ago frees its category without a refetch.
// `onChange` re-reads the categories after one is added or removed — the page
// redraws its donuts, filters and forms off them.

function LockIcon({ className = '' }) {
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
			<rect x="5" y="11" width="14" height="9" rx="2" />
			<path d="M8 11V8a4 4 0 0 1 8 0v3" />
		</svg>
	)
}

// One half: its categories, then the form that adds to it.
function CategoryList({ type, title, tint, categories, filedUnder, onAdd, onRemove, busy }) {
	const [label, setLabel] = useState('')
	const [description, setDescription] = useState('')
	// the first colour none of this half's slices use yet, until one is picked
	const unused = CATEGORY_COLORS.find((color) => !categories.some((category) => category.color === color))
	const [picked, setPicked] = useState(null)
	// the one chosen off the picker behind the + circle, which it then fills
	const [custom, setCustom] = useState(null)
	const color = picked ?? unused ?? CATEGORY_COLORS[0]
	const customPicked = custom !== null && picked === custom

	const trimmed = label.trim()
	const ready = trimmed !== '' && !busy

	const submit = async (event) => {
		event.preventDefault()
		if (!ready) return
		if (await onAdd({ label: trimmed, type, color, description: description.trim() })) {
			setLabel('')
			setDescription('')
			setPicked(null)
			setCustom(null)
		}
	}

	const pickCustom = (value) => {
		const hex = value.toUpperCase()
		setCustom(hex)
		setPicked(hex)
	}

	return (
		<div className="min-w-0">
			<span className={`
				inline-block
				rounded-full
				px-4
				py-1.5
				font-vietnam
				font-semibold
				text-sm
				text-black
				${tint}
			`}>
				{title}
			</span>

			<ul className="
				mt-3
				divide-y
				divide-black/10
			">
				{categories.map((category) => {
					const filed = filedUnder(category.key)
					const last = categories.length === 1
					return (
						<li
							key={category.key}
							className="
								flex
								items-center
								justify-between
								gap-3
								py-2.5
								min-h-[52px]
							"
						>
							<div className="min-w-0">
								<CategoryTag category={category.label} color={category.color} />
								{(category.description || category.locked) && (
									<span className="
										block
										mt-0.5
										pl-[18px]
										font-vietnam
										text-xs
										text-black/40
									">
										{category.description || category.locked}
									</span>
								)}
							</div>

							{category.locked ? (
								<span
									title="The app files money under this one itself, so it stays"
									className="
										w-8
										h-8
										shrink-0
										inline-flex
										items-center
										justify-center
										rounded-full
										bg-cream
										text-black/40
									"
								>
									<LockIcon className="w-4 h-4" />
									<span className="sr-only">locked</span>
								</span>
							) : filed > 0 || last ? (
								// why there's no bin
								<span
									title={last ? undefined : 'Move them to another category to remove this one'}
									className="
										shrink-0
										font-vietnam
										text-xs
										text-black/35
										text-right
									"
								>
									{last ? `the only ${type} one` : `${filed} filed here`}
								</span>
							) : (
								<button
									type="button"
									onClick={() => onRemove(category)}
									disabled={busy}
									aria-label={`Remove ${category.label}`}
									title={`Remove ${category.label}`}
									className="
										w-8
										h-8
										shrink-0
										inline-flex
										items-center
										justify-center
										rounded-full
										cursor-pointer
										bg-salmon-lightest
										text-salmon-dark
										transition-all
										duration-150
										ease-out
										hover:-translate-y-0.5
										hover:shadow-md
										hover:shadow-black/20
										hover:bg-red
										hover:text-white
										active:translate-y-0
										active:shadow-none
										disabled:opacity-40
										disabled:cursor-not-allowed
									"
								>
									<TrashIcon className="w-4 h-4" />
								</button>
							)}
						</li>
					)
				})}
			</ul>

			<form
				onSubmit={submit}
				className="
					mt-4
					rounded-[12px]
					bg-cream
					p-4
				"
			>
				<div className="
					grid
					grid-cols-[1fr_auto]
					items-center
					gap-x-3
					gap-y-2
				">
					<input
						type="text"
						value={label}
						onChange={(event) => setLabel(event.target.value)}
						maxLength={40}
						placeholder={`new ${type} category`}
						aria-label={`New ${type} category`}
						className={`${FIELD} min-w-0`}
					/>
					<button
						type="submit"
						disabled={!ready}
						className={`
							shrink-0
							h-[42px]
							rounded-full
							px-5
							font-vietnam
							font-semibold
							text-sm
							transition-all
							duration-200
							ease-out
							${ready
								? 'bg-salmon text-white cursor-pointer hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20'
								: 'bg-black/10 text-black/40 cursor-not-allowed'}
						`}
					>
						add
					</button>

					{/* optional — the line printed under it in the list */}
					<input
						type="text"
						value={description}
						onChange={(event) => setDescription(event.target.value)}
						maxLength={120}
						placeholder="description (optional)"
						aria-label={`Description for the new ${type} category`}
						className={`${FIELD} min-w-0`}
					/>
				</div>

				{/* its colour on the donut and the ledger's dots */}
				<div
					role="radiogroup"
					aria-label="Colour"
					className="
						mt-3
						flex
						flex-wrap
						gap-2
					"
				>
					{CATEGORY_COLORS.map((swatch) => (
						<button
							key={swatch}
							type="button"
							role="radio"
							aria-checked={swatch === color}
							aria-label={swatch}
							onClick={() => setPicked(swatch)}
							style={{ backgroundColor: swatch }}
							className={`
								w-6
								h-6
								rounded-full
								cursor-pointer
								transition-transform
								duration-150
								hover:scale-110
								${swatch === color && !customPicked ? 'ring-2 ring-black ring-offset-2 ring-offset-cream' : ''}
							`}
						/>
					))}

					{/* any other colour: light grey until one's chosen, then
					    that colour — clicking it again picks over it */}
					<span
						style={custom ? { backgroundColor: custom } : undefined}
						className={`
							relative
							w-6
							h-6
							rounded-full
							inline-flex
							items-center
							justify-center
							text-black/55
							transition-transform
							duration-150
							hover:scale-110
							has-[:focus-visible]:outline-2
							has-[:focus-visible]:outline-black
							${custom ? '' : 'bg-black/10'}
							${customPicked ? 'ring-2 ring-black ring-offset-2 ring-offset-cream' : ''}
						`}
					>
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2.5"
							strokeLinecap="round"
							className="w-3.5 h-3.5"
							aria-hidden="true"
						>
							<path d="M12 5v14M5 12h14" />
						</svg>
						<input
							type="color"
							role="radio"
							aria-checked={customPicked}
							aria-label={custom ? `Custom colour ${custom}` : 'Pick a custom colour'}
							value={(custom ?? '#CCCCCC').toLowerCase()}
							onClick={() => custom && setPicked(custom)}
							onChange={(event) => pickCustom(event.target.value)}
							className="
								absolute
								inset-0
								w-full
								h-full
								opacity-0
								cursor-pointer
							"
						/>
					</span>
				</div>
			</form>
		</div>
	)
}

export default function CategoriesCard({ categories, filedUnder, onChange }) {
	const [error, setError] = useState(null)
	const [busy, setBusy] = useState(false)

	const run = async (call) => {
		setBusy(true)
		setError(null)
		try {
			await call()
			await onChange?.()
			return true
		} catch (err) {
			setError(err.message)
			return false
		} finally {
			setBusy(false)
		}
	}

	const add = (category) => run(() => financeCategoriesApi.add(category))
	const remove = (category) => run(() => financeCategoriesApi.remove(category.key))

	const half = (type) => (categories ?? []).filter((category) => category.type === type)

	return (
		<Card>
			<CardTitle>categories</CardTitle>
			<CardNote>
				The categories money is filed under. Each one is a slice of its summary, and receipts can be filed under the expense ones. You can remove one once nothing is filed under it. The app fills in the locked ones itself.
			</CardNote>

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

			{categories === null ? (
				<p className="
					mt-6
					font-vietnam
					text-sm
					text-black/40
				">
					loading…
				</p>
			) : (
				<div className="
					mt-6
					grid
					grid-cols-1
					gap-8
					md:grid-cols-2
				">
					<CategoryList
						type="income"
						title="income"
						tint="bg-green"
						categories={half('income')}
						filedUnder={filedUnder}
						onAdd={add}
						onRemove={remove}
						busy={busy}
					/>
					<CategoryList
						type="expense"
						title="expenses"
						tint="bg-orange"
						categories={half('expense')}
						filedUnder={filedUnder}
						onAdd={add}
						onRemove={remove}
						busy={busy}
					/>
				</div>
			)}
		</Card>
	)
}
