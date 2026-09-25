// The club's clock. Labs and events are typed in as a day and an 'HH:MM' on the
// wall in West Lafayette, but the server can be anywhere — most hosts run on
// UTC — so nothing here may lean on the server's own timezone. Every "when
// does it start", "what day is it" and "print this time" goes through here.
//
// CLUB_TZ overrides it, for a chapter somewhere else (or a test).
export const CLUB_TZ = process.env.CLUB_TZ || 'America/Indiana/Indianapolis'

// The pieces of `at` as they read on a clock in `timeZone`.
function wallClock(at, timeZone = CLUB_TZ) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).formatToParts(at)
    const get = (type) => Number(parts.find((p) => p.type === type).value)
    return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') }
}

// How far `timeZone` is ahead of UTC at the instant `at`, in ms (negative
// west of Greenwich). Daylight saving is why it takes an instant.
function offsetAt(at, timeZone = CLUB_TZ) {
    const w = wallClock(at, timeZone)
    const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second)
    return asUtc - Math.floor(at.getTime() / 1000) * 1000
}

// The instant a wall-clock time happens in the club's timezone.
// clubInstant('2026-10-01', '17:30') -> 2026-10-01T21:30:00.000Z (EDT)
export function clubInstant(day, time = '00:00', timeZone = CLUB_TZ) {
    const [y, m, d] = day.split('-').map(Number)
    const [h, min] = time.split(':').map(Number)
    const guess = Date.UTC(y, m - 1, d, h, min)
    // the offset at the guess is right except within an hour of a DST switch,
    // where a second pass lands it
    let at = new Date(guess - offsetAt(new Date(guess), timeZone))
    at = new Date(guess - offsetAt(at, timeZone))
    return at
}

// Today's date in the club's timezone, 'YYYY-MM-DD'.
export function clubToday(now = new Date(), timeZone = CLUB_TZ) {
    const w = wallClock(now, timeZone)
    return `${w.year}-${String(w.month).padStart(2, '0')}-${String(w.day).padStart(2, '0')}`
}

// A @db.Date column comes back as UTC midnight of that day; this is the value
// to compare one against — "before today" is `lt: dateColumn(clubToday())`.
export function dateColumn(day) {
    return new Date(`${day}T00:00:00.000Z`)
}

// When a lab or event starts — its date at its start time (the top of the day
// if it has none), on the club's clock. Null for a draft lab with no date.
export function startsAt(row) {
    if (!row?.date) { return null }
    return clubInstant(row.date.toISOString().slice(0, 10), row.startTime || '00:00')
}

// toLocaleString on the club's clock.
export function clubFormat(at, options) {
    return at.toLocaleString('en-US', { timeZone: CLUB_TZ, ...options })
}
