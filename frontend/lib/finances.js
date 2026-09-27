// The club's books: the ledgers both analytics pages read from, and the sums
// they take off them.
//
// Everything on those pages is derived from three lists — money in, money out,
// and grant applications — rather than stored as a total anywhere. That's what
// lets the treasurer edit a single row and have the balance line, both
// summaries and the three cards at the top all answer for the change. It also
// means there's only one thing to swap when this comes from the API: the seeds
// below.
//
// A compensation request is the fourth list, and it's the same thing as a
// receipt — an officer hands in a photo of what they bought, the treasurer
// settles it, and settling it writes a row into the expense ledger. That's why
// the officer's receipts card and their transaction history are two views of
// one list rather than two lists.
//
// The club's year runs august to july, which is what `schoolYear` means by
// '2025–26' and the order MONTHS reads in.

// ---- shape -----------------------------------------------------------------

export const MONTHS = ['aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul']

const MONTH_NAMES = [
	'january', 'february', 'march', 'april', 'may', 'june',
	'july', 'august', 'september', 'october', 'november', 'december',
]

// Where money comes from, in slice order. The colours are the donut's and the
// ledger's dots — one place, so a category can't be green in one card and
// yellow in the other.
//
// 'fees' is what someone who hasn't paid dues pays at the door for a lab or a
// members-only event — the non-member price (see src/dues.js).
export const INCOME_CATEGORIES = [
	{ key: 'grants', label: 'grants', color: '#A7CC70' },
	{ key: 'fundraisers', label: 'fundraisers', color: '#FFDF2B' },
	{ key: 'dues', label: 'dues', color: '#FF8A78' },
	{ key: 'fees', label: 'entry fees', color: '#B07CE8' },
	{ key: 'sponsors', label: 'sponsors', color: '#3990FA' },
]

// Where it goes. These four are also what a receipt gets filed under, so a
// settled request lands in one of these slices.
export const EXPENSE_CATEGORIES = [
	{ key: 'lab', label: 'lab', color: '#FF7D45' },
	{ key: 'events', label: 'events', color: '#E35944' },
	{ key: 'guests', label: 'guests', color: '#FFDF2B' },
	{ key: 'marketing', label: 'marketing', color: '#4066FF' },
]

export function categoryLabel(key) {
	return [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES]
		.find((category) => category.key === key)?.label ?? key
}

export function categoryColor(key) {
	return [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES]
		.find((category) => category.key === key)?.color ?? '#171717'
}

// One palette for every status pill on both pages, so a "pending" request and a
// "pending" grant can't drift to different colours.
export const STATUS_PILL = {
	pending: 'bg-yellow-light text-yellow-dark',
	approved: 'bg-blue-light text-blue-med',
	reimbursed: 'bg-green text-green-dark',
	denied: 'bg-salmon-lightest text-salmon-dark',
	awarded: 'bg-green text-green-dark',
	under_review: 'bg-blue-light text-blue-med',
	drafting: 'bg-yellow-light text-yellow-dark',
}

export const REQUEST_STATUSES = ['pending', 'approved', 'reimbursed', 'denied']
export const GRANT_STATUSES = ['drafting', 'under_review', 'awarded', 'denied']

// What a status is called on screen. The values above are what the API stores
// and compares on — Postgres enum labels, so no spaces — and this is the only
// place that turns one back into the phrase a person reads.
export function statusLabel(status) {
	return String(status ?? '').replace(/_/g, ' ')
}

// Where a receipt's money goes back to — the officer picks one on the form and
// types the handle beside it. `handle` is that box's placeholder; cash is
// handed over in person, so it has none. Mirrors PAYOUT_METHODS in
// src/routes/reimbursementRoutes.js.
export const PAYOUT_METHODS = [
	{ key: 'zelle', label: 'Zelle', handle: 'phone number or email' },
	{ key: 'venmo', label: 'Venmo', handle: '@username' },
	{ key: 'cashapp', label: 'Cash App', handle: '$cashtag' },
	{ key: 'paypal', label: 'PayPal', handle: 'email or @username' },
	{ key: 'applecash', label: 'Apple Cash', handle: 'phone number or email' },
	{ key: 'cash', label: 'Cash', handle: null },
	{ key: 'check', label: 'Check', handle: 'name to make it out to' },
	{ key: 'other', label: 'Other', handle: 'how to pay you back' },
]

export function payoutLabel(key) {
	return PAYOUT_METHODS.find((method) => method.key === key)?.label ?? key
}

// 'Zelle · 765-555-0100', 'Cash', or '' on a request filed before the form asked
export function payoutText(request) {
	if (!request.payoutMethod) return ''
	return [payoutLabel(request.payoutMethod), request.payoutHandle].filter(Boolean).join(' · ')
}

// What was in the account before the earliest row in the ledger. Nothing here
// stores a running total — every figure on both pages is a sum over the
// transaction rows — so this is the offset that makes "current balance" match
// the actual bank statement rather than only the rows anyone has typed in.
//
// 0: the club's books start from nothing — every dollar is a ledger row.
export const OPENING_BALANCE = 0

// ---- what the API sends, in the shape these pages read ----------------------

// Every one of the four lists below arrives from its own endpoint and is
// reshaped here rather than in the pages, so both analytics pages agree on what
// a row is called. The pages then do all their arithmetic over these — nothing
// on either page is a stored total.
//
// Amounts come back from Postgres NUMERIC as strings, so every one of them goes
// through Number() on the way in. Miss one and `a + b` silently concatenates.
//
// Dates arrive as full ISO timestamps and are cut back to 'YYYY-MM-DD', which
// is what the date inputs want, what these functions compare on, and what sorts
// correctly as plain text.

function day(value) {
	return String(value ?? '').slice(0, 10)
}

function name(user) {
	return `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()
}

// GET /transactions, split by the ledger it belongs to. Income rows call their
// description `source`, expense rows call it `title` — the two tables label
// that column differently, and the ledger card's config is written against
// those names.
export function toIncome(transactions) {
	return transactions
		.filter((row) => row.type === 'income')
		.map((row) => ({
			id: row.transactionId,
			date: day(row.date),
			source: row.source,
			category: row.category,
			amount: Number(row.amount),
			// set on an awarded grant's row — which is the grant itself, kept
			// in step with the tracker, and changed only from there
			grantId: row.grantId ?? undefined,
		}))
}

export function toExpenses(transactions) {
	return transactions
		.filter((row) => row.type === 'expense')
		.map((row) => ({
			id: row.transactionId,
			date: day(row.date),
			title: row.source,
			category: row.category,
			amount: Number(row.amount),
			// only on a row that came from settling a receipt — that's what the
			// ledger flags as somebody's reimbursement
			requestId: row.reimbursementId ?? undefined,
			who: row.reimbursement ? name(row.reimbursement.member?.user) : undefined,
		}))
}

// GET /grants. `amount` is what was asked for, `awarded` what was actually
// granted (null until it is — often less than was asked), and `due` is the
// application deadline — an application that isn't awarded yet has no other
// date on it.
export function toGrants(grants) {
	return grants.map((row) => ({
		id: row.grantId,
		name: row.name,
		org: row.org,
		amount: Number(row.amountRequested),
		awarded: row.amountAwarded == null ? null : Number(row.amountAwarded),
		status: row.status,
		due: day(row.deadline),
		// the day it was awarded — which year its income lands in
		granted: row.dateGranted ? day(row.dateGranted) : null,
	}))
}

// GET /reimbursements (the treasurer's queue) or /reimbursements/mine.
// `what` is the title, `reason` is what it was bought for — the form asks for
// both and the row keeps them apart.
export function toRequests(rows) {
	return rows.map((row) => ({
		id: row.reimbursementId,
		memberId: row.memberId,
		who: name(row.member?.user),
		what: row.title,
		reason: row.explanation ?? '',
		category: row.category,
		date: day(row.date),
		amount: Number(row.amountRequested),
		// the receipt photo, stored as a data URL until there's somewhere to
		// upload a file to. The dialogs read `image.preview`.
		image: row.receipt ? { preview: row.receipt } : null,
		status: row.status,
		denialReason: row.denialExplanation ?? null,
		previousDenial: row.previousDenial ?? null,
		payoutMethod: row.payoutMethod ?? '',
		payoutHandle: row.payoutHandle ?? '',
	}))
}

// GET /year-targets -> { '2025–26': 10000 }, one map per figure, which is the
// shape the summary cards index into. `years` is every year that has a row —
// the years the treasurer added, which the picker offers even before any
// money lands in them — and `contents` what the server found in each, the
// reasons it can't be deleted ([] when it can).
export function toTargets(rows) {
	const goals = {}
	const budgets = {}
	const contents = {}
	for (const row of rows) {
		goals[row.schoolYear] = Number(row.incomeGoal)
		budgets[row.schoolYear] = Number(row.expenseBudget)
		contents[row.schoolYear] = row.contents ?? []
	}
	return { goals, budgets, contents, years: rows.map((row) => row.schoolYear) }
}

// ---- numbers ---------------------------------------------------------------

export function sum(values) {
	return values.reduce((total, value) => total + value, 0)
}

export function money(value, cents = true) {
	return value.toLocaleString('en-US', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: cents ? 2 : 0,
		maximumFractionDigits: cents ? 2 : 0,
	})
}

// '2026-07-14' -> 'Jul 14, 2026'. Split by hand rather than through Date, which
// reads a bare date string as UTC and can hand back the day before depending on
// the timezone.
export function prettyDate(value) {
	if (!value) return ''
	const [year, month, day] = value.split('-').map(Number)
	return new Date(year, month - 1, day).toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	})
}

// Today as 'YYYY-MM-DD' in the treasurer's own timezone — a row they add right
// now is dated the day on their calendar, not the day it is in UTC. Built by
// hand for the same reason prettyDate is.
export function today() {
	const now = new Date()
	const month = String(now.getMonth() + 1).padStart(2, '0')
	const day = String(now.getDate()).padStart(2, '0')
	return `${now.getFullYear()}-${month}-${day}`
}

export function nextId(rows) {
	return Math.max(0, ...rows.map((row) => row.id)) + 1
}

// '2026-07-28' -> '2025–26'. August starts a new one.
export function schoolYear(date) {
	const [year, month] = date.split('-').map(Number)
	const start = month >= 8 ? year : year - 1
	return `${start}–${String(start + 1).slice(2)}`
}

// '2025–26' -> '2025-08-01', which is where its ledger opens. ISO dates compare
// as strings, so this is all the arithmetic a year boundary needs.
export function yearStart(year) {
	return `${year.slice(0, 4)}-08-01`
}

export function monthSlot(date) {
	return (Number(date.split('-')[1]) - 8 + 12) % 12
}

// The year picker's "all years": every page figure over the whole history.
export const ALL_YEARS = 'all'

// '2025–26', or 'all years'
export function yearLabel(year) {
	return year === ALL_YEARS ? 'all years' : year
}

export function inYear(entries, year) {
	if (year === ALL_YEARS) return entries
	return entries.filter((entry) => schoolYear(entry.date) === year)
}

// The school year a grant belongs to: an awarded one the year its income
// landed in (the day it was granted), anything else the year it's due.
export function grantYear(grant) {
	return schoolYear(grant.status === 'awarded' && grant.granted ? grant.granted : grant.due)
}

export function grantsInYear(grants, year) {
	if (year === ALL_YEARS) return grants
	return grants.filter((grant) => grantYear(grant) === year)
}

// A figure kept per year (the income goal, the budget): the year's own, or
// every year's added up for "all years".
export function forYear(byYear, year) {
	if (year === ALL_YEARS) return sum(Object.values(byYear))
	return byYear[year] ?? 0
}

// Which years the picker offers, newest first. Read off the ledgers rather
// than listed by hand, so a row dated into a year nobody has used yet brings
// that year with it instead of disappearing into a view that can't be
// selected. The year we're in now is always there, and so is every year the
// treasurer has added (`added` — the year-target rows, see toTargets), so an
// empty year still shows up and its dues can be marked before any money lands.
export function yearsIn(ledgers, added = []) {
	const found = new Set([...added, schoolYear(today())])
	for (const entry of ledgers) found.add(schoolYear(entry.date))
	return [...found].sort().reverse()
}

// '2026–27' -> '2025–26'
export function previousYear(year) {
	return yearFrom(Number(year.slice(0, 4)) - 1)
}

// Whether anything was filed before this year opened — false for the club's
// first year on the books, which has nothing to carry over.
export function hasHistoryBefore(income, expenses, year) {
	const start = yearStart(year)
	return [...income, ...expenses].some((entry) => entry.date < start)
}

// '2026' -> '2026–27', the en dash every school year is written with
export function yearFrom(start) {
	return `${start}–${String(Number(start) + 1).slice(2)}`
}

export function totalsByCategory(entries, categories) {
	const totals = {}
	for (const category of categories) totals[category.key] = 0
	for (const entry of entries) {
		totals[entry.category] = (totals[entry.category] ?? 0) + entry.amount
	}
	return totals
}

export function total(entries) {
	return sum(entries.map((entry) => entry.amount))
}

// What was in the account the day this year opened: everything banked before
// then, on top of the balance the books started at. This is how one year's
// closing balance carries into the next — the new year's tables start empty,
// but its balance line starts where the last one ended.
export function openingBalance(income, expenses, year) {
	const start = yearStart(year)
	return (
		OPENING_BALANCE +
		total(income.filter((entry) => entry.date < start)) -
		total(expenses.filter((entry) => entry.date < start))
	)
}

// The balance at the close of each month, which is what the chart plots. Months
// with nothing in them hold the line flat rather than dropping it to zero.
//
// For "all years" it's one point per school year instead — the balance at the
// close of each — after the balance the books started at.
export function balanceSeries(income, expenses, year, years = []) {
	if (year === ALL_YEARS) {
		const series = [{ month: 'start', value: OPENING_BALANCE }]
		for (const each of [...years].sort()) {
			const end = yearEnd(each)
			series.push({
				month: each,
				value: OPENING_BALANCE +
					total(income.filter((entry) => entry.date <= end)) -
					total(expenses.filter((entry) => entry.date <= end)),
			})
		}
		return series
	}
	const net = MONTHS.map(() => 0)
	for (const entry of inYear(income, year)) net[monthSlot(entry.date)] += entry.amount
	for (const entry of inYear(expenses, year)) net[monthSlot(entry.date)] -= entry.amount

	const series = []
	let running = openingBalance(income, expenses, year)
	for (let slot = 0; slot < MONTHS.length; slot++) {
		running += net[slot]
		series.push({ month: MONTHS[slot], value: running })
	}
	return series
}

export function currentBalance(income, expenses) {
	return OPENING_BALANCE + total(income) - total(expenses)
}

function shiftMonth(stamp, by) {
	const [year, month] = stamp.split('-').map(Number)
	const moved = new Date(year, month - 1 + by, 1)
	return `${moved.getFullYear()}-${String(moved.getMonth() + 1).padStart(2, '0')}`
}

function inMonth(entries, stamp) {
	return total(entries.filter((entry) => entry.date.startsWith(stamp)))
}

// The three cards at the top of both pages. "This month" is the last month the
// books have anything in — reading it off the ledger rather than off the clock
// keeps the cards from going blank at the start of a month, and keeps them
// honest about which month they're actually describing.
//
// `change` comes back null when the month before was empty: a percentage
// against zero says nothing, and the card leaves the pill off.
export function monthStats(income, expenses) {
	const stamps = [...income, ...expenses].map((entry) => entry.date.slice(0, 7)).sort()
	const stamp = stamps[stamps.length - 1] ?? today().slice(0, 7)
	const before = shiftMonth(stamp, -1)

	const earnings = inMonth(income, stamp)
	const spendings = inMonth(expenses, stamp)
	const earnedBefore = inMonth(income, before)
	const spentBefore = inMonth(expenses, before)

	const balance = currentBalance(income, expenses)
	const net = earnings - spendings
	const change = (now, then) => (then === 0 ? null : ((now - then) / then) * 100)

	const [year, month] = stamp.split('-').map(Number)

	return {
		stamp,
		label: `${MONTH_NAMES[month - 1]} ${year}`,
		earnings: { value: earnings, delta: earnings - earnedBefore, change: change(earnings, earnedBefore) },
		spendings: { value: spendings, delta: spendings - spentBefore, change: change(spendings, spentBefore) },
		balance: { value: balance, delta: net, change: change(balance, balance - net) },
	}
}

// What an awarded grant is actually worth: what was granted if that's been
// recorded, what was asked for until then.
export function grantValue(grant) {
	return grant.awarded ?? grant.amount
}

// '2025–26' -> '2026-07-31', the last day of its ledger (see yearStart)
export function yearEnd(year) {
	return `${Number(year.slice(0, 4)) + 1}-07-31`
}
