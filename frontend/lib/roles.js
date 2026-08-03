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

export const currentRole = 'member'   // 'user' | 'member' | 'officer' | 'treasurer' | 'admin'

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
