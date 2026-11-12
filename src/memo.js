// A few things every page asks about and almost nothing changes: who's
// signed in and their role, the year's dues amounts, the calendar's tags, the
// ways to pay, the goggle price. Each is kept here for a short while instead
// of asked of the database on every request — the database is metered by
// what it sends back (Neon's network transfer), and these are asked a lot.
//
// Nothing goes stale: a write to any of them clears what's kept (the Prisma
// client does it on the write itself, src/prismaClient.js), so the next read
// is fresh. The time limit is only a backstop.

const kept = new Map()

// what's run out is dropped now and then, so keys nobody asks for again
// (one per person, per lab) don't pile up
function prune() {
    const now = Date.now()
    for (const [key, entry] of kept) {
        if (entry.until <= now) { kept.delete(key) }
    }
}
setInterval(prune, 5 * 60 * 1000).unref?.()

export async function memo(key, ms, read) {
    const hit = kept.get(key)
    if (hit && hit.until > Date.now()) { return hit.value }
    // the promise is kept, so two requests at once share one read
    const value = read()
    kept.set(key, { value, until: Date.now() + ms })
    try {
        return await value
    } catch (err) {
        kept.delete(key)
        throw err
    }
}

// forget everything kept under keys that start with `prefix`
export function bust(prefix) {
    for (const key of kept.keys()) {
        if (key.startsWith(prefix)) { kept.delete(key) }
    }
}

// A write inside a transaction lands when it commits, which can be after
// what's kept was cleared and a read put the old rows straight back. Clearing
// again a moment later catches that (as src/changes.js does for its counters)
// — it matters for the things kept for minutes rather than seconds.
const SETTLE_MS = 1500

export function bustSoon(prefix) {
    bust(prefix)
    setTimeout(() => bust(prefix), SETTLE_MS).unref?.()
}

// Kept for minutes: the rows a whole page of people share and only staff
// change — the landing page, the list of events, a lab's text. Every write to
// them clears what's kept (KEPT in src/prismaClient.js), so the limit is only
// how long a change made straight in the database, behind the API's back,
// takes to show.
export const SHARED_MS = 10 * 60 * 1000
