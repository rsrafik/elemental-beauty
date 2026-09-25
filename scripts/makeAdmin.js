// Makes someone an admin — the way in on a fresh production database, where
// nobody is an admin yet and only an admin can hand out roles (PUT
// /members/:id/role). The seed's accounts are dev-only.
//
//   npm run make-admin -- jane7@purdue.edu Jane Doe
//
// No account for that email yet: one is made, already verified and past the
// waiver (vouched for, like a student an officer adds), with the username
// the site would give it — what's before the @ — and a random password,
// printed here once. They sign in with it and can change it with "forgot
// password" on the login page.
//
// An account already there: it's made an admin, and its password is left
// alone.
//
// Against production, run it where the server's environment is — e.g.
// `docker exec -it <container> npm run make-admin -- ...` — or with that
// DATABASE_URL in .env.
import { randomBytes } from 'node:crypto'
import prisma from '../src/prismaClient.js'
import { fromEmail, takenMessage } from '../src/accountEmail.js'
import { hashPassword } from '../src/passwords.js'
import { log } from '../src/activity.js'

const [address, firstName = '', ...last] = process.argv.slice(2)
const lastName = last.join(' ')

async function main() {
    if (!address) {
        console.error('Usage: npm run make-admin -- <email> [first name] [last name]')
        return 1
    }
    const { email, username, error } = fromEmail(address)
    if (error) {
        console.error(error)
        return 1
    }

    const existing = await prisma.user.findUnique({
        where: { email },
        select: { userId: true, username: true, member: { select: { role: true } } }
    })

    if (existing) {
        const before = existing.member?.role ?? null
        if (before === 'admin') {
            console.log(`${email} (@${existing.username}) is already an admin — nothing to do.`)
            return 0
        }
        await prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { userId: existing.userId },
                data: {
                    emailVerified: true,
                    ...(before ? {} : { waiverSigned: true }),
                    member: { upsert: { create: { role: 'admin' }, update: { role: 'admin' } } }
                }
            })
            await log({ action: 'role_changed', targetId: existing.userId, details: { from: before ?? 'user', to: 'admin' } }, tx)
        })
        console.log(`${email} (@${existing.username}) is now an admin. Their password hasn't changed.`)
        return 0
    }

    // 16 characters, letters, digits, - and _ — for the first sign-in only
    const password = randomBytes(12).toString('base64url')
    try {
        await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    username,
                    email,
                    passwordHash: await hashPassword(password),
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                    emailVerified: true,
                    waiverSigned: true,
                    member: { create: { role: 'admin' } }
                }
            })
            await log({ action: 'member_added', targetId: user.userId, details: { role: 'admin' } }, tx)
        })
    } catch (err) {
        if (err.code === 'P2002') {
            console.error(takenMessage(err, username))
            return 1
        }
        throw err
    }

    console.log(`
Admin account made.

  email      ${email}
  username   ${username}
  password   ${password}

This is the only time the password is shown. Sign in with the username (or
the email) and this password, then change it with "forgot password" on the
login page.
`)
    return 0
}

main()
    .then((code) => { process.exitCode = code })
    .catch((err) => {
        console.error(err.message)
        process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
