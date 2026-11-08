// Getting to the "new lab" and "new event" forms without a bare address that
// some other visit has already claimed.
//
// In the static export, Next's router remembers the last full address it saw
// for a page, query and all, and sends every later plain link to that page
// there. So:
//
//   - after the dashboard's /labs?new=1, the sidebar's /labs kept bouncing
//     into the lab editor
//   - after editing lab 5, a plain /labs/edit (the + on /labs) opened
//     /labs/edit?id=5, filled in
//   - after /events?new=1, the sidebar's /events kept opening the form
//
// Each lasted until a reload. The fixes: a new lab gets a query of its own,
// and "New Event" hands its request over in memory instead of in the address.

// The lab editor, empty. (A bare /labs/edit typed in still opens a new lab;
// it's only never linked to.)
export const NEW_LAB = '/labs/edit?new=1'

// The dashboard's "New Event" asking /events to open its form when it lands.
// Held in the module, like lib/history.js: per tab and per load, and nothing
// needs to redraw when it changes. A reload forgets it, which is the point —
// a refresh shouldn't reopen a form.
let pending = null

export function openNewOn(page) {
	pending = page
}

// Read while the page sets up its state, then cleared once it's mounted (see
// doneOpeningNew). Reading clears nothing, so StrictMode's second render in
// development sees the same answer as the first.
export function wantsNew(page) {
	return pending === page
}

export function doneOpeningNew(page) {
	if (pending === page) pending = null
}
