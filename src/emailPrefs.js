// Whether someone gets the officer dashboard's club-wide "Email All"
// (users.emailClub).
//
// Their choice from /account once they've made one. Until then it follows
// their role: members are in by default, staff (officers, j-board, the
// treasurer, admin) are out by default — they're the ones sending these — but
// can opt in.
//
// Mail about a lab or event someone has signed up for — an officer's "email
// all" from its check-in page, the day-before reminder, confirmations and
// offers — isn't optional: it's how they learn their spot is theirs and where
// to be. It goes to everyone signed up, staff included.

export const STAFF = ['officer', 'jboard', 'treasurer', 'admin']

export function wantsEmail(choice, role) {
    return choice ?? !STAFF.includes(role)
}
