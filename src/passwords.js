import bcrypt from 'bcryptjs'

// One rule for every place a password is set — signing up, a reset, an
// officer adding a student — so they can't drift apart.
export const MIN_PASSWORD = 8

// bcrypt's work factor. 10 is the usual floor; bcryptjs is plain JavaScript,
// so much higher starts to make every login and sign-up visibly slow.
// Accounts hashed at the old cost of 8 are upgraded the next time they sign in
// (see needsRehash).
export const HASH_ROUNDS = 10

// null when it's fine, otherwise the message to send back
export function passwordProblem(password) {
    if (!password) { return 'password is required' }
    if (String(password).length < MIN_PASSWORD) { return `password must be at least ${MIN_PASSWORD} characters` }
    return null
}

export function hashPassword(password) {
    return bcrypt.hash(String(password), HASH_ROUNDS)
}

export function checkPassword(password, hash) {
    return bcrypt.compare(String(password ?? ''), hash)
}

// true for a hash made at a lower cost than today's
export function needsRehash(hash) {
    try {
        return bcrypt.getRounds(hash) < HASH_ROUNDS
    } catch {
        return false
    }
}
