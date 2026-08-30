// Single source of truth for "who is looking at this page".
//
// Right now `currentRole` is a hardcoded preview switch — flip it to see any
// role's version of any page. When auth lands, replace the constant with a read
// of the session (cookie / context / server fetch) and every route below
// follows automatically, because they all ask this module instead of deciding
// on their own.
//
// Ranks mirror src/middleware/requireRole.js on the backend, plus 'user' for
// someone who has an account but no member row yet.

export const RANK = {
	user: 0,
	member: 1,
	officer: 2,
	treasurer: 3,
	admin: 4,
}

export let currentRole = 'officer'   // 'user' | 'member' | 'officer' | 'treasurer' | 'admin'

// Change who is looking, at runtime. The sign-up flow calls this with 'user'
// once the emailed code checks out, because somebody who just made an account
// has one but no member row yet.
//
// A `let` and a setter rather than a store: every module here imports the
// binding rather than copying it, and ES modules make those live, so a page
// that reads `currentRole` while rendering picks up the new value with no
// wiring. Nothing reads it at module scope, which is what would go stale.
//
// In memory only, and deliberately. It lasts as long as the tab does and resets
// on reload — the same lifetime the hardcoded constant already had. Persisting
// it properly means a cookie, not localStorage: the pages that branch on the
// role render on the server, and a value only the browser knows would disagree
// with what the server sent. That belongs with the session read this whole
// module is waiting on.
export function setRole(role) {
	if (!(role in RANK)) return
	currentRole = role
}

// Which member is looking, not just at what rank. Pages that show someone their
// own rows — an officer's compensation requests, say — filter on this rather
// than showing everybody's. Hardcoded alongside `currentRole` for now, and
// replaced by the same session read when auth lands. `id` is the user_id the
// API returns.
export const currentUser = { id: 12288, first: 'Isabel', last: 'Harris' }

// hasRole('officer') -> true for officer, treasurer, admin.
export function hasRole(min, role = currentRole) {
	return (RANK[role] ?? -1) >= (RANK[min] ?? Infinity)
}

// Exact match, for the one case that isn't a rank check: the treasurer's own
// version of analytics. Admin gets it too since admin outranks treasurer —
// swap to `role === 'treasurer'` if it should be treasurer and nobody else.
export function isTreasurer(role = currentRole) {
	return hasRole('treasurer', role)
}
