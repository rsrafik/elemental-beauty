// The guard in front of everything that wipes the database — `npm run
// db:seed` (prisma/seed.js deletes every row before it lays down its fake
// accounts) and `npm run db:reset` (which drops the whole schema). Pointed at
// production by a stray DATABASE_URL in .env, either would take every
// member, lab and ledger row with it.
//
// They go ahead only when DATABASE_URL is on this machine — localhost, as the
// docker-compose Postgres and CI's are — and NODE_ENV isn't production.
// There's no override on purpose: the seed's accounts are admin/admin and
// friends, which don't belong on a hosted database either.
//
//   import { refuseUnlessLocal } from '../scripts/localDatabase.js'   (seed.js)
//   node --env-file=.env scripts/localDatabase.js                     (db:reset, before prisma runs)

import { fileURLToPath } from 'node:url'

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]', '::1']

// Why DATABASE_URL isn't safe to wipe, or null when it is.
export function wipeProblem(env = process.env) {
    if (env.NODE_ENV === 'production') {
        return 'NODE_ENV is production'
    }
    const raw = env.DATABASE_URL
    if (!raw) { return 'DATABASE_URL is not set' }
    let host
    try {
        host = new URL(raw).hostname
    } catch {
        return 'DATABASE_URL is not a valid URL'
    }
    // no host at all is a Unix socket on this machine
    if (host !== '' && !LOCAL_HOSTS.includes(host)) {
        return `DATABASE_URL points at ${host}, not this machine`
    }
    return null
}

export function refuseUnlessLocal(what, env = process.env) {
    const problem = wipeProblem(env)
    if (problem) {
        console.error(`Refusing to ${what}: ${problem}. This wipes every table, so it only runs against a local database.`)
        process.exit(1)
    }
}

// run directly: the check on its own, for a script that goes on to run
// something else (db:reset's `&& prisma migrate reset`)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    refuseUnlessLocal('reset the database')
}
