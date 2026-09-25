// How the roles rank, and the two questions the pages ask about them.
//
// This used to also hold a hardcoded `currentRole` / `currentUser` — the preview
// switch every page built itself against. Those are gone: who is looking now
// comes from the session (lib/session.js), which reads it off GET /api/auth/me.
// What's left here is the ranking itself, which is a fact about the roles rather
// than about whoever happens to be signed in.
//
// Ranks mirror src/middleware/requireRole.js on the backend, plus 'user' for
// someone who has an account but no member row yet.

// j-board sits just above officer: everything an officer has, not the
// treasurer's books.
export const RANK = {
	user: 0,
	member: 1,
	officer: 2,
	jboard: 3,
	treasurer: 4,
	admin: 5,
}

// hasRole('officer', role) -> true for officer, j-board, treasurer, admin.
export function hasRole(min, role) {
	return (RANK[role] ?? -1) >= (RANK[min] ?? Infinity)
}

// /analytics — the club's books — is every officer's except j-board's: j-board
// outranks an officer everywhere else, but the money isn't theirs to see. The
// server refuses them the same data (see server.js).
export function canSeeAnalytics(role) {
	return hasRole('officer', role) && role !== 'jboard'
}

// How a role is written on the page — its name, except j-board, which the
// database has to spell without the hyphen.
export function roleLabel(role) {
	return role === 'jboard' ? 'j-board' : role
}

// The one case that isn't a rank check: the treasurer's own version of
// analytics. Admin gets it too since admin outranks treasurer — swap to
// `role === 'treasurer'` if it should be treasurer and nobody else.
export function isTreasurer(role) {
	return hasRole('treasurer', role)
}
