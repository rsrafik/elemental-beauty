// An account is made from an email address, and its username is whatever comes
// before the @ — 'lauren7712@purdue.edu' signs in as 'lauren7712'. Any domain
// will do; it isn't tied to purdue.edu.
//
// Both are kept lower-case: addresses aren't case-sensitive in practice, and a
// username that could differ only by case would be two accounts nobody can
// tell apart.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// '  Lauren7712@Purdue.edu ' -> { email: 'lauren7712@purdue.edu', username: 'lauren7712' }
// or { error } when it isn't an address.
export function fromEmail(value) {
    const email = String(value ?? '').trim().toLowerCase()
    if (!EMAIL.test(email)) { return { error: 'Enter a valid email address' } }
    return { email, username: email.slice(0, email.indexOf('@')) }
}

// The message for a unique-constraint clash on the users table. The two
// columns fail separately: the same address is the same person, but two
// different addresses can share what's before the @.
export function takenMessage(err, username) {
    const target = String(err.meta?.target ?? err.meta?.driverAdapterError?.cause?.constraint?.fields ?? '')
    if (target.includes('email')) { return 'An account with that email already exists' }
    if (target.includes('username')) { return `The username "${username}" is already taken` }
    return 'An account with that email or username already exists'
}
