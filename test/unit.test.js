// Pure functions — no database. Run with `npm test`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clubInstant, clubToday, clubFormat, dateColumn, startsAt } from '../src/clubTime.js'
import { csvCell } from '../src/csv.js'
import { hashPassword, needsRehash, passwordProblem, checkPassword } from '../src/passwords.js'
import { wantsEmail } from '../src/emailPrefs.js'
import { readMessage } from '../src/emailAll.js'
import { fromEmail } from '../src/accountEmail.js'
import { schoolYearOf } from '../src/dues.js'
import { wipeProblem } from '../scripts/localDatabase.js'

// ---- the club's clock ------------------------------------------------------

test('a wall-clock time in Indiana is the right instant, in and out of daylight saving', () => {
    // EDT is UTC-4
    assert.equal(clubInstant('2026-10-01', '17:30').toISOString(), '2026-10-01T21:30:00.000Z')
    // EST is UTC-5
    assert.equal(clubInstant('2026-12-01', '17:30').toISOString(), '2026-12-01T22:30:00.000Z')
    // midnight, the default
    assert.equal(clubInstant('2026-12-01').toISOString(), '2026-12-01T05:00:00.000Z')
})

test('the days daylight saving switches still land on the right hour', () => {
    // clocks go back at 2am on Nov 1 2026: 9am that day is already EST
    assert.equal(clubInstant('2026-11-01', '09:00').toISOString(), '2026-11-01T14:00:00.000Z')
    // and forward on Mar 8 2026: 9am is EDT
    assert.equal(clubInstant('2026-03-08', '09:00').toISOString(), '2026-03-08T13:00:00.000Z')
})

test('"today" rolls over at midnight in Indiana, not in UTC', () => {
    // 11pm in Indiana is already tomorrow in UTC
    assert.equal(clubToday(new Date('2026-10-02T03:00:00Z')), '2026-10-01')
    assert.equal(clubToday(new Date('2026-10-02T05:00:00Z')), '2026-10-02')
})

test('startsAt reads a @db.Date column and a start time', () => {
    const row = { date: dateColumn('2026-10-01'), startTime: '18:00' }
    assert.equal(startsAt(row).toISOString(), '2026-10-01T22:00:00.000Z')
    assert.equal(startsAt({ date: dateColumn('2026-10-01'), startTime: null }).toISOString(), '2026-10-01T04:00:00.000Z')
    assert.equal(startsAt({ date: null }), null)
})

test('times are printed on the club clock', () => {
    const text = clubFormat(new Date('2026-10-05T16:00:00Z'), { hour: 'numeric', minute: '2-digit' })
    assert.equal(text.replace(/\s/g, ' '), '12:00 PM')
})

// ---- CSV -------------------------------------------------------------------

test('csv cells quote what needs quoting and defuse formulas', () => {
    assert.equal(csvCell('plain'), 'plain')
    assert.equal(csvCell('a,b'), '"a,b"')
    assert.equal(csvCell('say "hi"'), '"say ""hi"""')
    assert.equal(csvCell('line\nbreak'), '"line\nbreak"')
    assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"')
    assert.equal(csvCell('@sum'), "'@sum")
    assert.equal(csvCell(null), '')
    assert.equal(csvCell(12.5), '12.5')
})

// ---- passwords -------------------------------------------------------------

test('password rules', async () => {
    assert.match(passwordProblem('short'), /at least 8/)
    assert.equal(passwordProblem('long enough'), null)
    assert.match(passwordProblem(''), /required/)
})

test('old cheap hashes are flagged for an upgrade, new ones are not', async () => {
    const bcrypt = (await import('bcryptjs')).default
    const old = await bcrypt.hash('password123', 8)
    const fresh = await hashPassword('password123')
    assert.equal(needsRehash(old), true)
    assert.equal(needsRehash(fresh), false)
    assert.equal(await checkPassword('password123', fresh), true)
    assert.equal(await checkPassword('nope', fresh), false)
})

// ---- email preferences and messages ----------------------------------------

test('members get club email by default, staff only if they opt in', () => {
    assert.equal(wantsEmail(null, 'member'), true)
    assert.equal(wantsEmail(null, 'officer'), false)
    assert.equal(wantsEmail(true, 'officer'), true)
    assert.equal(wantsEmail(false, 'member'), false)
})

test('an email-all needs a subject and a message', () => {
    assert.ok(readMessage({ subject: '', message: 'x' }).error)
    assert.ok(readMessage({ subject: 'x', message: ' ' }).error)
    assert.deepEqual(readMessage({ subject: ' Hi ', message: ' Body ' }), { subject: 'Hi', message: 'Body' })
})

test('the username is the part of the email before the @', () => {
    assert.deepEqual(fromEmail('  Lauren7712@Purdue.edu '), { email: 'lauren7712@purdue.edu', username: 'lauren7712' })
    assert.ok(fromEmail('not an email').error)
})

// ---- dues ------------------------------------------------------------------

test('a lab\'s school year turns over on August 1st', () => {
    assert.equal(schoolYearOf('2026-07-31'), '2025–26')
    assert.equal(schoolYearOf('2026-08-01'), '2026–27')
    assert.equal(schoolYearOf('2027-01-15'), '2026–27')
    assert.equal(schoolYearOf('2099-12-31'), '2099–00')
})

// ---- the wipe guard (db:seed, db:reset) ------------------------------------

test('the seed and reset only wipe a database on this machine', () => {
    const at = (DATABASE_URL, NODE_ENV) => wipeProblem({ DATABASE_URL, NODE_ENV })
    assert.equal(at('postgresql://postgres:pw@localhost:5433/elemental'), null)
    assert.equal(at('postgresql://postgres:pw@127.0.0.1/elemental'), null)
    assert.equal(at('postgresql://postgres:pw@[::1]:5432/elemental'), null)
    assert.equal(at('postgresql:///elemental'), null, 'a Unix socket')
    assert.match(at('postgresql://u:pw@db.abc.supabase.co:5432/postgres'), /db\.abc\.supabase\.co/)
    assert.match(at('postgresql://u:pw@localhost.evil.com/x'), /not this machine/)
    assert.match(at('postgresql://postgres:pw@localhost:5433/elemental', 'production'), /production/)
    assert.match(at(undefined), /not set/)
    assert.match(at('not a url'), /not a valid URL/)
})
