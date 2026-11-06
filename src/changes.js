// "Has anything on this lab's (or event's) check-in page changed?" — answered
// from memory, so the page can ask every few seconds without a query.
//
// Every write to the rows the page shows bumps a counter: a sign-up, a check-
// in, an offer, a payment sent in or looked at (src/prismaClient.js does it on
// the writes themselves, so no route can forget). A write that can't be pinned
// to one lab or event — dues paid, someone's name or role changed — bumps
// them all. The page asks GET /:id/roster/version and reads the roster again
// only when the answer's moved.
//
// It lives in this process, which is fine for the one server the club runs.
// Running more than one would need it shared (Postgres LISTEN/NOTIFY, or
// Redis) — otherwise a page polling one server misses writes on another.

// a restart starts over from a different place, so every page reads once
const BOOT = Date.now().toString(36)
const versions = new Map()
let everything = 0

// A write inside a transaction lands when it commits, which can be after the
// counter moved and a page re-read the roster too soon. Moving it again a
// moment later catches that.
const SETTLE_MS = 1500

function move(name) {
    if (name) { versions.set(name, (versions.get(name) ?? 0) + 1) } else { everything++ }
}

export function bump(kindName = null, id = null) {
    const name = kindName && id != null ? `${kindName}:${id}` : null
    move(name)
    setTimeout(() => move(name), SETTLE_MS).unref?.()
}

export function versionOf(kindName, id) {
    return `${BOOT}.${everything}.${versions.get(`${kindName}:${id}`) ?? 0}`
}
