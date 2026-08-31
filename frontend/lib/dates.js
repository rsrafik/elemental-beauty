// Dates, handled as text.
//
// Every date the API sends is a full ISO timestamp ('2026-08-30T00:00:00.000Z')
// and every date an <input type="date"> wants is 'YYYY-MM-DD'. That form also
// sorts and compares correctly as a plain string, so nothing here goes through
// Date except to *format* — passing a bare date string to `new Date()` reads it
// as UTC and can hand back the day before depending on the timezone.

// Anything the API sent -> 'YYYY-MM-DD'.
export function isoDate(value) {
	return String(value ?? '').slice(0, 10)
}

// Today in the viewer's own timezone, not UTC — a lab happening tonight is
// today on their calendar, whatever it is in London.
export function today() {
	const now = new Date()
	const month = String(now.getMonth() + 1).padStart(2, '0')
	const day = String(now.getDate()).padStart(2, '0')
	return `${now.getFullYear()}-${month}-${day}`
}

// '2026-08-30' -> 'August 30, 2026'
export function longDate(value) {
	const [year, month, day] = isoDate(value).split('-').map(Number)
	if (!year || !month || !day) return ''
	return new Date(year, month - 1, day).toLocaleDateString('en-US', {
		month: 'long',
		day: 'numeric',
		year: 'numeric',
	})
}

// '18:00' -> '6:00 PM'. Null and '' both come back empty, so a row with no
// clock time on it just prints nothing.
export function prettyTime(value) {
	if (!value) return ''
	const [hour, minute] = value.split(':').map(Number)
	if (Number.isNaN(hour)) return ''
	const suffix = hour >= 12 ? 'PM' : 'AM'
	const twelve = hour % 12 === 0 ? 12 : hour % 12
	return `${twelve}:${String(minute).padStart(2, '0')} ${suffix}`
}

// Which panel a row belongs in. 'current' is everything up to and including
// today, 'upcoming' is after it — the two panels the labs and events pages
// stack on top of each other.
export function isUpcoming(value) {
	return isoDate(value) > today()
}
