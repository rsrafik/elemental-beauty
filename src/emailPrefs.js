// Whether someone gets an officer's "email all" — the dashboard's club-wide
// one (users.emailClub) or a lab or event's (users.emailEvents).
//
// Each is their choice from /account once they've made one. Until then it
// follows their role: members are in by default, staff (officers, j-board,
// the treasurer, admin) are out by default — they're the ones sending these —
// but can opt in, say for an event they've signed up for themselves.

export const STAFF = ['officer', 'jboard', 'treasurer', 'admin']

export function wantsEmail(choice, role) {
    return choice ?? !STAFF.includes(role)
}
