import { today } from '@/lib/dates'

// The officer /labs and /events sheets in two parts: what's coming up or on
// today, then a divider, then what's already happened, greyed out.
//
// Rows carry `date` as 'YYYY-MM-DD' (or '' for a draft lab with no date yet,
// which counts as still to come). Upcoming keeps the soonest first; completed
// runs the other way, so the one that just happened sits right under the
// divider.
export function splitByDate(rows) {
	const now = today()
	const upcoming = []
	const completed = []
	for (const row of rows) {
		if (row.date && row.date < now) completed.push(row)
		else upcoming.push(row)
	}
	upcoming.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'))
	completed.sort((a, b) => b.date.localeCompare(a.date))
	return { upcoming, completed }
}

// What a finished card wears: colour drained and faded back, coming most of the
// way up again under the pointer so it's still easy to read and open.
export const COMPLETED_CARD = `
	grayscale
	opacity-[0.55]
	hover:opacity-90
`

export function CompletedDivider({ count }) {
	return (
		<div
			role="separator"
			aria-label="Completed"
			className="
				flex
				items-center
				gap-4
				px-3
				pt-8
				pb-6
				sm:pt-10
				sm:pb-8
			"
		>
			<span className="
				h-px
				flex-1
				bg-black/15
			" />
			<span className="
				font-vietnam
				font-semibold
				text-[12px]
				uppercase
				tracking-[0.14em]
				text-black/45
			">
				completed · {count}
			</span>
			<span className="
				h-px
				flex-1
				bg-black/15
			" />
		</div>
	)
}
