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

export const YEARS = ['2025–26', '2024–25']

// Where money comes from, in slice order. The colours are the donut's and the
// ledger's dots — one place, so a category can't be green in one card and
// yellow in the other.
export const INCOME_CATEGORIES = [
	{ key: 'grants', label: 'grants', color: '#A7CC70' },
	{ key: 'fundraisers', label: 'fundraisers', color: '#FFDF2B' },
	{ key: 'dues', label: 'dues', color: '#FF8A78' },
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
	'under review': 'bg-blue-light text-blue-med',
	drafting: 'bg-yellow-light text-yellow-dark',
}

export const REQUEST_STATUSES = ['pending', 'approved', 'reimbursed', 'denied']
export const GRANT_STATUSES = ['drafting', 'under review', 'awarded', 'denied']

// What the year was budgeted at. The starting figures — the treasurer edits
// them from the summary cards, which is why the pages hold them in state.
export const INCOME_GOAL = { '2025–26': 10000, '2024–25': 6000 }
export const EXPENSE_BUDGET = { '2025–26': 9500, '2024–25': 6000 }

// What was in the account before the first row below. Everything else is this
// plus what came in, less what went out.
export const OPENING_BALANCE = 980

// ---- seeds -----------------------------------------------------------------

// Money in. `source` is what the treasurer would write on the deposit.
export const seedIncome = [
	{ id: 5101, date: '2024-08-27', source: 'Fall dues', category: 'dues', amount: 615 },
	{ id: 5102, date: '2024-09-19', source: 'Campus Micro-Grant award', category: 'grants', amount: 900 },
	{ id: 5103, date: '2024-10-22', source: 'Bake sale', category: 'fundraisers', amount: 296.25 },
	{ id: 5104, date: '2024-11-12', source: 'Local salon sponsorship', category: 'sponsors', amount: 400 },
	{ id: 5105, date: '2025-01-21', source: 'Spring dues', category: 'dues', amount: 720 },
	{ id: 5106, date: '2025-02-18', source: "Valentine's gram sale", category: 'fundraisers', amount: 318 },
	{ id: 5107, date: '2025-03-11', source: 'Student Org Fund award', category: 'grants', amount: 1100 },
	{ id: 5108, date: '2025-04-08', source: 'Spring merch drop', category: 'fundraisers', amount: 305 },
	{ id: 5109, date: '2025-05-06', source: 'Alumni gift', category: 'sponsors', amount: 200 },

	{ id: 5110, date: '2025-08-25', source: 'Fall dues — first wave', category: 'dues', amount: 690 },
	{ id: 5111, date: '2025-09-10', source: 'Fall dues — late sign-ups', category: 'dues', amount: 420 },
	{ id: 5112, date: '2025-09-22', source: 'Student Org Fund award', category: 'grants', amount: 1500 },
	{ id: 5113, date: '2025-10-08', source: 'Glow Bar sponsorship', category: 'sponsors', amount: 600 },
	{ id: 5114, date: '2025-10-27', source: 'Bake sale', category: 'fundraisers', amount: 385.5 },
	{ id: 5115, date: '2025-11-14', source: 'Lip gloss pop-up', category: 'fundraisers', amount: 512 },
	{ id: 5116, date: '2025-12-05', source: 'Winter merch drop', category: 'fundraisers', amount: 268 },
	{ id: 5117, date: '2026-01-20', source: 'Spring dues — first wave', category: 'dues', amount: 810 },
	{ id: 5118, date: '2026-01-28', source: 'STEM Outreach Mini-Grant', category: 'grants', amount: 1200 },
	{ id: 5119, date: '2026-02-11', source: "Valentine's gram sale", category: 'fundraisers', amount: 341 },
	{ id: 5120, date: '2026-02-26', source: 'Sephora Collegiate sponsorship', category: 'sponsors', amount: 600 },
	{ id: 5121, date: '2026-03-09', source: 'Campus Life Programming award', category: 'grants', amount: 800 },
	{ id: 5122, date: '2026-03-24', source: 'Spring dues — late sign-ups', category: 'dues', amount: 420 },
	{ id: 5123, date: '2026-04-15', source: 'Spring fling table', category: 'fundraisers', amount: 274 },
	{ id: 5124, date: '2026-06-12', source: 'Summer pop-up market', category: 'fundraisers', amount: 236 },
	{ id: 5125, date: '2026-07-08', source: 'Alumni sponsor gift', category: 'sponsors', amount: 300 },
]

// Money out. `requestId` marks a row that came from settling an officer's
// receipt rather than from the treasurer paying something directly — those two
// are the only ways a row gets in here, and the difference matters when someone
// asks why a line exists.
export const seedExpenses = [
	{ id: 6201, date: '2024-09-12', title: 'Bath bomb lab supplies', category: 'lab', amount: 388.5 },
	{ id: 6202, date: '2024-09-26', title: 'Flyer printing', category: 'marketing', amount: 96.3 },
	{ id: 6203, date: '2024-10-17', title: 'Welcome social — food', category: 'events', amount: 284 },
	{ id: 6204, date: '2024-11-07', title: 'Candle lab supplies', category: 'lab', amount: 452.75 },
	{ id: 6205, date: '2024-12-04', title: 'Winter social — venue', category: 'events', amount: 415 },
	{ id: 6206, date: '2025-01-29', title: 'Lip balm lab supplies', category: 'lab', amount: 398.2 },
	{ id: 6207, date: '2025-02-20', title: 'Guest esthetician honorarium', category: 'guests', amount: 300 },
	{ id: 6208, date: '2025-03-13', title: 'Sticker printing', category: 'marketing', amount: 142 },
	{ id: 6209, date: '2025-03-27', title: 'Scrub lab supplies', category: 'lab', amount: 471.05 },
	{ id: 6210, date: '2025-04-24', title: 'Spring banquet — catering', category: 'events', amount: 520 },
	{ id: 6211, date: '2025-05-15', title: 'Photo prints', category: 'marketing', amount: 88 },

	{ id: 6212, date: '2025-08-28', title: 'Welcome social — food', category: 'events', amount: 318 },
	{ id: 6213, date: '2025-09-04', title: 'Flyer printing', category: 'marketing', amount: 128.4 },
	{ id: 6214, date: '2025-09-18', title: 'Bath bomb lab supplies', category: 'lab', amount: 412.6 },
	{ id: 6215, date: '2025-10-03', title: 'Bubbles and Beakers — supplies', category: 'events', amount: 264.5 },
	{ id: 6216, date: '2025-10-15', title: 'Instagram ad boost', category: 'marketing', amount: 90 },
	{ id: 6217, date: '2025-10-21', title: 'Lip gloss lab base + pigments', category: 'lab', amount: 528.4 },
	{ id: 6218, date: '2025-11-06', title: 'Guest esthetician honorarium', category: 'guests', amount: 350 },
	{ id: 6219, date: '2025-11-19', title: 'Body butter lab jars', category: 'lab', amount: 366.15 },
	{ id: 6220, date: '2025-12-06', title: 'Winter formal — venue deposit', category: 'events', amount: 600 },
	{ id: 6221, date: '2026-01-09', title: 'Sticker + button printing', category: 'marketing', amount: 186 },
	{ id: 6222, date: '2026-01-15', title: 'Industry panel — speaker travel', category: 'guests', amount: 275 },
	{ id: 6223, date: '2026-01-27', title: 'Bronzer lab mica set', category: 'lab', amount: 489.9 },
	{ id: 6224, date: '2026-02-13', title: "Galentine's night — decor + food", category: 'events', amount: 372.4 },
	{ id: 6225, date: '2026-02-18', title: 'Sugar scrub lab supplies', category: 'lab', amount: 434.25 },
	{ id: 6226, date: '2026-02-24', title: 'Tabling banner', category: 'marketing', amount: 210 },
	{ id: 6227, date: '2026-03-05', title: 'Makeup artist workshop fee', category: 'guests', amount: 400 },
	{ id: 6228, date: '2026-03-19', title: 'Perfume lab oils', category: 'lab', amount: 561.3 },
	{ id: 6229, date: '2026-04-10', title: 'Spring banquet — catering', category: 'events', amount: 595.1 },
	{ id: 6230, date: '2026-04-22', title: 'Face mask lab clays', category: 'lab', amount: 448.15 },
	{ id: 6231, date: '2026-04-30', title: 'Guest speaker gift baskets', category: 'guests', amount: 75 },
	{ id: 6232, date: '2026-05-06', title: 'End-of-year photo booth prints', category: 'marketing', amount: 166 },
	{ id: 6233, date: '2026-06-25', title: 'Summer social — cookout', category: 'events', amount: 182.5 },
	{ id: 6234, date: '2026-07-16', title: 'Officer retreat supplies', category: 'events', amount: 96 },

	// settled receipts — each one is the payout for the request it names
	{ id: 6235, date: '2026-05-09', title: 'Body butter jars', category: 'lab', amount: 92.15, requestId: 8803, who: 'Isabel Harris' },
	{ id: 6236, date: '2026-05-28', title: 'Banner reprint', category: 'marketing', amount: 88, requestId: 8805, who: 'Molly White' },
	{ id: 6237, date: '2026-06-13', title: 'Bronzer lab jars', category: 'lab', amount: 145.6, requestId: 8807, who: 'Nadia Okafor' },
	{ id: 6238, date: '2026-06-26', title: 'Bake sale supplies', category: 'events', amount: 118.72, requestId: 8809, who: 'Isabel Harris' },
	{ id: 6239, date: '2026-07-10', title: 'Guest speaker gift', category: 'guests', amount: 55, requestId: 8811, who: 'Debra Nelson' },
	{ id: 6240, date: '2026-07-17', title: 'GBM snacks', category: 'events', amount: 63.8, requestId: 8812, who: 'Nadia Okafor' },
]

export const seedGrants = [
	{ id: 7301, name: 'Campus Micro-Grant', org: 'Student Government', amount: 900, status: 'awarded', due: '2024-09-01' },
	{ id: 7302, name: 'Student Org Fund', org: 'Student Government', amount: 1100, status: 'awarded', due: '2025-02-14' },
	{ id: 7303, name: 'Student Org Fund', org: 'Student Government', amount: 1500, status: 'awarded', due: '2025-09-01' },
	{ id: 7304, name: 'STEM Outreach Mini-Grant', org: 'College of Sciences', amount: 1200, status: 'awarded', due: '2026-01-15' },
	{ id: 7305, name: 'Campus Life Programming', org: 'Dean of Students', amount: 800, status: 'awarded', due: '2026-03-02' },
	{ id: 7306, name: 'Wellness Programming', org: 'Health Center', amount: 900, status: 'denied', due: '2026-04-20' },
	{ id: 7307, name: 'Beauty Industry Fund', org: 'Glow Foundation', amount: 2000, status: 'under review', due: '2026-09-12' },
	{ id: 7308, name: 'Sustainability Micro-Grant', org: 'Green Campus', amount: 650, status: 'drafting', due: '2026-10-05' },
]

// A receipt an officer handed in, which is the same row the treasurer settles.
// `memberId` is who's owed the money; `image` is the photo, held as an object
// URL until there's somewhere to upload it to.
//
// A denial carries `denialReason` — the treasurer has to say why, and it's what
// the officer answers when they fix the request and send it back. A request
// that's been round once keeps the old objection as `previousDenial`, so the
// treasurer can see it's a second attempt and at what.
export const seedRequests = [
	{ id: 8803, memberId: 12288, who: 'Isabel Harris', what: 'Body butter jars', reason: 'jars for the body butter lab', category: 'lab', date: '2026-05-08', amount: 92.15, image: null, status: 'reimbursed' },
	{ id: 8804, memberId: 12288, who: 'Isabel Harris', what: 'Mixing bowls', reason: 'replacements after the scrub lab', category: 'lab', date: '2026-05-20', amount: 39.99, image: null, status: 'denied', denialReason: 'There are six bowls in the supply closet — check there before buying more. If they were all cracked, say so and send it back.' },
	{ id: 8805, memberId: 12281, who: 'Molly White', what: 'Banner reprint', reason: 'the tabling banner tore', category: 'marketing', date: '2026-05-27', amount: 88, image: null, status: 'reimbursed' },
	{ id: 8806, memberId: 12288, who: 'Isabel Harris', what: 'Lab goggles + gloves', reason: 'safety kit for the bronzer lab', category: 'lab', date: '2026-06-04', amount: 52.3, image: null, status: 'approved' },
	{ id: 8807, memberId: 12278, who: 'Nadia Okafor', what: 'Bronzer lab jars', reason: 'packaging for 20 attendees', category: 'lab', date: '2026-06-11', amount: 145.6, image: null, status: 'reimbursed' },
	{ id: 8808, memberId: 12283, who: 'Lauren Martin', what: 'Sticker printing', reason: 'giveaways for tabling', category: 'marketing', date: '2026-06-18', amount: 74.25, image: null, status: 'denied', denialReason: 'No photo of the receipt attached, and marketing was already at budget in june. Attach it and I can move it to next year.' },
	{ id: 8809, memberId: 12288, who: 'Isabel Harris', what: 'Bake sale supplies', reason: 'flour, sugar, packaging', category: 'events', date: '2026-06-24', amount: 118.72, image: null, status: 'reimbursed' },
	{ id: 8810, memberId: 12288, who: 'Isabel Harris', what: 'Instagram ad boost', reason: 'promoting the summer pop-up', category: 'marketing', date: '2026-07-02', amount: 30, image: null, status: 'approved' },
	{ id: 8811, memberId: 12286, who: 'Debra Nelson', what: 'Guest speaker gift', reason: 'thank-you basket for the panel', category: 'guests', date: '2026-07-09', amount: 55, image: null, status: 'reimbursed' },
	{ id: 8812, memberId: 12278, who: 'Nadia Okafor', what: 'GBM snacks', reason: 'refreshments for the july GBM', category: 'events', date: '2026-07-15', amount: 63.8, image: null, status: 'reimbursed' },
	{ id: 8813, memberId: 12283, who: 'Lauren Martin', what: 'Photoshoot props', reason: 'props for the merch shoot', category: 'marketing', date: '2026-07-22', amount: 42.15, image: null, status: 'approved' },
	{ id: 8814, memberId: 12288, who: 'Isabel Harris', what: 'Lip gloss base + pigments', reason: 'restock for the august lab', category: 'lab', date: '2026-07-28', amount: 86.4, image: null, status: 'pending' },
]

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

export function inYear(entries, year) {
	return entries.filter((entry) => schoolYear(entry.date) === year)
}

// Which years the picker offers. Read off the ledgers rather than listed by
// hand, so a row dated into a year nobody has used yet brings that year with
// it instead of disappearing into a view that can't be selected. YEARS is
// folded in so an empty year the club is partway through still shows up.
export function yearsIn(...lists) {
	const found = new Set(YEARS)
	for (const entry of lists.flat()) found.add(schoolYear(entry.date))
	return [...found].sort().reverse()
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
// then, on top of the balance the books started at.
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
export function balanceSeries(income, expenses, year) {
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
