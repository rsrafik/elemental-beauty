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
