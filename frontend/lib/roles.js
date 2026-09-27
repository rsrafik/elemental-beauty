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

// Who the leaderboard ranks. Officers, treasurers and admins run the board
// rather than compete on it, so their points never put them on it — the
// dashboard's podium and the rail on /account both leave them off.
const OFF_THE_BOARD = ['officer', 'treasurer', 'admin']
export function onLeaderboard(role) {
	return !OFF_THE_BOARD.includes(role)
}

// /analytics — the club's books — is every officer's except j-board's: j-board
// outranks an officer everywhere else, but the money isn't theirs to see. The
// server refuses them the same data (see server.js).
export function canSeeAnalytics(role) {
	return hasRole('officer', role) && role !== 'jboard'
}

// Event tracks a role never sees — the page side of the rule the API enforces
// (HIDDEN_TRACKS in src/routes/eventRoutes.js). J-board doesn't see the
// officers' track; officers, treasurer and admin see all of them.
const HIDDEN_TRACKS = {
	user: ['officers', 'board', 'jboard'],
	member: ['officers', 'board', 'jboard'],
	jboard: ['officers'],
}
export function hiddenTracks(role) {
	return HIDDEN_TRACKS[role] ?? []
}

// Tracks a role can see but starts with switched off in the calendar's key:
// officers and the treasurer see j-board's days only once they click its pill.
const DEFAULT_OFF_TRACKS = {
	officer: ['jboard'],
	treasurer: ['jboard'],
}
export function defaultOffTracks(role) {
	return DEFAULT_OFF_TRACKS[role] ?? []
}

// Whether the key's switched-off tracks differ from where `role` started —
// what puts "clear filter" under it.
export function tracksChangedFrom(role, offTracks) {
	const start = defaultOffTracks(role)
	return start.length !== offTracks.length || start.some((track) => !offTracks.includes(track))
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
