// What goes on the calendar, and where it comes from.
//
// The grid draws two different tables as one thing: labs, which carry sign-ups
// and check-in and are scheduled from /labs, and events, which are everything
// else. Neither page should have to know that — they ask for a month and get
// days with things on them.
//
// The shape both calendars read is:
//
//   { '2026-08': { 6: [ { type, title, track, time }, … ], … }, … }
//
// A day is always a list, even with one thing on it. The member grid has room
// for one and takes the first; the officer grid stacks them.

import { isoDate } from '@/lib/dates'

// 'Lab' is the type a lab gets on the grid, and it isn't one of the editable
// tags — /api/event-categories refuses to create it. Labs are always members'
// business, so they carry that track without being asked.
const LAB_TYPE = 'Lab'
const LAB_TRACK = 'members'

// An event whose tag was deleted off the legend keeps its place on the grid;
// it just has nothing to file it under any more.
const UNTAGGED = 'Event'

function put(months, date, entry) {
	const iso = isoDate(date)
	if (!iso) return
	const key = iso.slice(0, 7)
	const day = Number(iso.slice(8, 10))
	if (!day) return

	if (!months[key]) months[key] = {}
	if (!months[key][day]) months[key][day] = []
	months[key][day].push(entry)
}

// Labs and events, folded into one month map. Both lists come straight from
// their endpoints — including the track filtering, which the API has already
// done for a member, so an officers-only event simply isn't in `events` when a
// member asks.
export function buildMonths(labs = [], events = []) {
	const months = {}

	for (const lab of labs) {
		put(months, lab.date, {
			id: `lab-${lab.labId}`,
			type: LAB_TYPE,
			title: lab.title,
			track: LAB_TRACK,
			time: null,
		})
	}

	for (const event of events) {
		put(months, event.date, {
			id: `event-${event.eventId}`,
			type: event.category?.name ?? UNTAGGED,
			title: event.title,
			track: event.track,
			time: event.startTime ?? null,
		})
	}

	// Within a day: timed things in clock order, untimed ones first — a
	// deadline with no hour on it isn't "before" a 9am meeting, and putting it
	// at the top keeps it from looking like it is.
	for (const month of Object.values(months)) {
		for (const day of Object.values(month)) {
			day.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
		}
	}

	return months
}

// The legend's chip list: every type actually on the calendar, plus every tag
// the club has defined even if nothing is filed under it yet — an officer who
// just added a tag should see it appear.
export function typesIn(months, categories = []) {
	const found = new Set([LAB_TYPE])
	for (const category of categories) found.add(category.name)
	for (const month of Object.values(months)) {
		for (const day of Object.values(month)) {
			for (const entry of day) found.add(entry.type)
		}
	}
	return [...found]
}
