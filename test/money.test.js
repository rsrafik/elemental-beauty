// Dues at the door, non-member prices, event links, the dues card's clear,
// awarded grants in the ledger, payout details on receipts, and who can add a
// student — against a real Postgres. Same rules as events.test.js: the
// database's name has to contain "test", and every row made here is removed
// at the end.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'

process.env.GMAIL_USER = ''
process.env.GMAIL_APP_PASSWORD = ''
process.env.RESEND_API_KEY = ''
process.env.JWT_SECRET ||= 'test-jwt-secret'
process.env.QR_SECRET ||= 'test-qr-secret'

const url = process.env.DATABASE_URL ?? ''
const skip = !/test/i.test(url.split('/').pop() ?? '')
    ? 'DATABASE_URL must point at a database with "test" in its name'
    : false

// events are dated into a school year nothing else uses, so its targets are
// this file's to set and clear
const DAY = '2031-02-10'
const YEAR = '2030–31'
// one more, for taking a year off the picker
const EMPTY_YEAR = '2040–41'

let prisma, routes
const tag = `f${Date.now().toString(36)}`
const made = { users: [], events: [], labs: [], grants: [], transactions: [], reimbursements: [] }

before(async () => {
    if (skip) { return }
    prisma = (await import('../src/prismaClient.js')).default
    routes = {
        events: (await import('../src/routes/eventRoutes.js')).default,
        labs: (await import('../src/routes/labRoutes.js')).default,
        dues: (await import('../src/routes/duesRoutes.js')).default,
        grants: (await import('../src/routes/grantRoutes.js')).default,
        transactions: (await import('../src/routes/transactionRoutes.js')).default,
        yearTargets: (await import('../src/routes/yearTargetRoutes.js')).default,
        members: (await import('../src/routes/memberRoutes.js')).default,
        reimbursements: (await import('../src/routes/reimbursementRoutes.js')).default
    }
    await prisma.yearTarget.upsert({
        where: { schoolYear: YEAR },
        update: { duesAmount: 20, nonmemberPrice: 5 },
        create: { schoolYear: YEAR, incomeGoal: 0, expenseBudget: 0, duesAmount: 20, nonmemberPrice: 5 }
    })
})

after(async () => {
    if (skip) { return }
    const users = { in: made.users }
    // what check-ins and dues wrote, found by who it was for
    await prisma.duesPayment.deleteMany({ where: { memberId: users } })
    await prisma.transaction.deleteMany({ where: { OR: [{ transactionId: { in: made.transactions } }, { source: { contains: tag } }] } })
    await prisma.activityLog.deleteMany({ where: { OR: [{ targetId: users }, { actorId: users }] } })
    await prisma.reimbursement.deleteMany({ where: { reimbursementId: { in: made.reimbursements } } })
    await prisma.grant.deleteMany({ where: { grantId: { in: made.grants } } })
    await prisma.event.deleteMany({ where: { eventId: { in: made.events } } })
    await prisma.lab.deleteMany({ where: { labId: { in: made.labs } } })
    await prisma.user.deleteMany({ where: { OR: [{ userId: users }, { username: { startsWith: tag } }] } })
    await prisma.yearTarget.deleteMany({ where: { schoolYear: { in: [YEAR, EMPTY_YEAR] } } })
    await prisma.$disconnect()
})

let counter = 0
async function person(role) {
    const n = counter++
    const user = await prisma.user.create({
        data: {
            username: `${tag}_${n}`,
            email: `${tag}_${n}@example.com`,
            passwordHash: 'x',
            firstName: `${tag}`,
            lastName: `P${n}`,
            emailVerified: true,
            waiverSigned: true,
            member: { create: { role } }
        }
    })
    made.users.push(user.userId)
    return user.userId
}

async function event(track, fields = {}) {
    const row = await prisma.event.create({
        data: { title: `${tag} ${track}`, date: new Date(DAY), track, ...fields }
    })
    made.events.push(row.eventId)
    return row.eventId
}

// the real routes, behind a stand-in for the auth middleware
async function as(userId, role, mount, run) {
    const app = express()
    app.use(express.json())
    app.use((req, res, next) => { req.userId = userId; req.role = role; next() })
    app.use('/', routes[mount])
    const server = app.listen(0)
    try {
        return await run(`http://localhost:${server.address().port}`)
    } finally {
        server.close()
    }
}

const send = (url, method, body) => fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
})

test('a members-only event asks an unpaid member for dues at the door; one open to all does not', { skip }, async () => {
    const officer = await person('officer')
    const member = await person('member')
    const members = await event('members')
    const open = await event('open')
    for (const eventId of [members, open]) {
        await prisma.memberEvent.create({ data: { memberId: member, eventId } })
    }

    await as(officer, 'officer', 'events', async (base) => {
        const asked = await send(`${base}/${members}/roster`, 'POST', { action: 'checkin', memberId: member })
        assert.equal(asked.status, 202)
        const reply = await asked.json()
        assert.equal(reply.code, 'DUES_UNPAID')
        assert.equal(reply.amount, 20)
        assert.equal(reply.price, 5)

        assert.equal((await send(`${base}/${open}/roster`, 'POST', { action: 'checkin', memberId: member })).status, 200)
    })
})

test('paying the non-member price checks them in and books it as income under fees', { skip }, async () => {
    const officer = await person('officer')
    const member = await person('member')
    const eventId = await event('members')
    await prisma.memberEvent.create({ data: { memberId: member, eventId } })

    await as(officer, 'officer', 'events', async (base) => {
        const reply = await send(`${base}/${eventId}/roster`, 'POST', { action: 'checkin', memberId: member, dues: 'fee' })
        assert.equal(reply.status, 200)
    })
    const row = await prisma.memberEvent.findUnique({ where: { memberId_eventId: { memberId: member, eventId } } })
    assert.equal(row.attendanceStatus, 'attended')
    const fee = await prisma.transaction.findFirst({ where: { category: 'fees', source: { contains: `${tag} members` } } })
    assert.ok(fee, 'a fees row')
    assert.equal(fee.type, 'income')
    assert.equal(Number(fee.amount), 5)
    // a fee covers the one event, not the year
    assert.equal(await prisma.duesPayment.count({ where: { memberId: member } }), 0)
})

test('lists carry the non-member price for someone unpaid, and nothing once they have paid or for staff', { skip }, async () => {
    const member = await person('member')
    const officer = await person('officer')
    const members = await event('members')
    const open = await event('open')
    const lab = await prisma.lab.create({ data: { title: `${tag} lab`, date: new Date(DAY) } })
    made.labs.push(lab.labId)

    const pick = (rows, key, id) => rows.find((row) => row[key] === id)
    await as(member, 'member', 'events', async (base) => {
        const rows = await (await fetch(base)).json()
        assert.deepEqual(pick(rows, 'eventId', members).dues, { schoolYear: YEAR, amount: 20, price: 5 })
        assert.equal(pick(rows, 'eventId', open).dues, null)
        assert.equal((await (await fetch(`${base}/${members}`)).json()).dues.price, 5)
    })
    await as(member, 'member', 'labs', async (base) => {
        assert.equal(pick(await (await fetch(base)).json(), 'labId', lab.labId).dues.price, 5)
    })
    await as(officer, 'officer', 'events', async (base) => {
        assert.equal(pick(await (await fetch(base)).json(), 'eventId', members).dues, null)
    })

    await prisma.duesPayment.create({ data: { memberId: member, schoolYear: YEAR, amount: 0 } })
    await as(member, 'member', 'events', async (base) => {
        assert.equal(pick(await (await fetch(base)).json(), 'eventId', members).dues, null)
    })
})

test('event links are saved with a scheme, empty rows dropped, and junk refused', { skip }, async () => {
    const officer = await person('officer')
    await as(officer, 'officer', 'events', async (base) => {
        const created = await send(base, 'POST', {
            title: `${tag} talk`, type: 'official', date: DAY,
            links: [{ title: 'Speaker LinkedIn', url: 'linkedin.com/in/someone' }, { title: 'blank', url: ' ' }]
        })
        assert.equal(created.status, 201)
        const row = await created.json()
        made.events.push(row.eventId)
        assert.deepEqual(row.links, [{ title: 'Speaker LinkedIn', url: 'https://linkedin.com/in/someone' }])

        assert.equal((await send(`${base}/${row.eventId}`, 'PUT', { links: [{ title: 'x', url: 'javascript:alert(1)' }] })).status, 400)
        const cleared = await (await send(`${base}/${row.eventId}`, 'PUT', { links: [] })).json()
        assert.equal(cleared.links, null)
    })
})

test("the dues card's clear un-pays everyone for the year but leaves the money in the ledger", { skip }, async () => {
    const treasurer = await person('treasurer')
    const member = await person('member')
    await as(treasurer, 'treasurer', 'dues', async (base) => {
        const paid = await (await send(base, 'POST', { memberId: member, schoolYear: YEAR, amount: 20 })).json()
        assert.ok(paid.transactionId)
        made.transactions.push(paid.transactionId)

        const cleared = await send(`${base}?schoolYear=${encodeURIComponent(YEAR)}`, 'DELETE')
        assert.equal(cleared.status, 200)
        assert.equal(await prisma.duesPayment.count({ where: { memberId: member } }), 0)
        assert.ok(await prisma.transaction.findUnique({ where: { transactionId: paid.transactionId } }))
    })
})

test('awarding a grant puts it in the income ledger, and un-awarding takes it back out', { skip }, async () => {
    const treasurer = await person('treasurer')
    await as(treasurer, 'treasurer', 'grants', async (base) => {
        const grant = await (await send(base, 'POST', {
            name: `${tag} grant`, org: 'Org', amountRequested: 800, deadline: '2031-01-01'
        })).json()
        made.grants.push(grant.grantId)
        const income = () => prisma.transaction.findFirst({ where: { grantId: grant.grantId, type: 'income' } })
        assert.equal(await income(), null)

        await send(`${base}/${grant.grantId}`, 'PUT', { status: 'awarded', amountAwarded: 650 })
        const row = await income()
        assert.equal(Number(row.amount), 650)
        assert.equal(row.category, 'grants')

        await send(`${base}/${grant.grantId}`, 'PUT', { status: 'denied' })
        assert.equal(await income(), null)
    })
})

test("an awarded grant's income row only changes through the grant", { skip }, async () => {
    const treasurer = await person('treasurer')
    const grant = await prisma.grant.create({
        data: { name: `${tag} linked`, org: 'Org', amountRequested: 300, deadline: new Date('2031-01-01'), status: 'awarded' }
    })
    made.grants.push(grant.grantId)
    const row = await prisma.transaction.findFirst({ where: { grantId: grant.grantId, type: 'income' } })

    await as(treasurer, 'treasurer', 'transactions', async (base) => {
        assert.equal((await send(`${base}/${row.transactionId}`, 'PUT', { amount: 1 })).status, 409)
        assert.equal((await send(`${base}/${row.transactionId}`, 'DELETE')).status, 409)
        const second = await send(base, 'POST', {
            type: 'income', source: `${tag} second`, amount: 300, category: 'grants', grantId: grant.grantId
        })
        assert.equal(second.status, 400)
    })
    assert.equal(Number((await prisma.transaction.findUnique({ where: { transactionId: row.transactionId } })).amount), 300)
})

test('a receipt says where to send the money, and a handle is needed for anything but cash', { skip }, async () => {
    const officer = await person('officer')
    await as(officer, 'officer', 'reimbursements', async (base) => {
        const body = { title: `${tag} jars`, amountRequested: 12, category: 'lab' }
        assert.equal((await send(base, 'POST', { ...body, payoutMethod: 'venmo' })).status, 400)
        assert.equal((await send(base, 'POST', { ...body, payoutMethod: 'bitcoin', payoutHandle: 'x' })).status, 400)

        const saved = await (await send(base, 'POST', { ...body, payoutMethod: 'zelle', payoutHandle: '765-555-0100' })).json()
        made.reimbursements.push(saved.reimbursementId)
        assert.equal(saved.payoutMethod, 'zelle')
        assert.equal(saved.payoutHandle, '765-555-0100')

        const cash = await (await send(base, 'POST', { ...body, payoutMethod: 'cash', payoutHandle: 'ignored' })).json()
        made.reimbursements.push(cash.reimbursementId)
        assert.equal(cash.payoutHandle, null)
    })
})

test('only an admin can add a student', { skip }, async () => {
    const body = (n) => ({ firstName: 'New', lastName: 'Student', email: `${tag}_new${n}@example.com`, password: 'a-long-enough-password-1' })
    for (const role of ['officer', 'jboard', 'treasurer']) {
        const who = await person(role)
        await as(who, role, 'members', async (base) => {
            assert.equal((await send(base, 'POST', body(role))).status, 403, role)
        })
    }
    const admin = await person('admin')
    await as(admin, 'admin', 'members', async (base) => {
        const created = await send(base, 'POST', body('admin'))
        assert.equal(created.status, 201)
        made.users.push((await created.json()).userId)
    })
})

test('a year can only be deleted once there is nothing in it', { skip }, async () => {
    const treasurer = await person('treasurer')
    await prisma.yearTarget.create({ data: { schoolYear: EMPTY_YEAR, incomeGoal: 0, expenseBudget: 0 } })
    const spent = await prisma.transaction.create({
        data: { type: 'expense', source: `${tag} supplies`, amount: 10, category: 'lab', date: new Date('2040-09-01') }
    })
    made.transactions.push(spent.transactionId)

    await as(treasurer, 'treasurer', 'yearTargets', async (base) => {
        const year = (name) => `${base}/${encodeURIComponent(name)}`
        const listed = (await (await fetch(base)).json()).find((row) => row.schoolYear === EMPTY_YEAR)
        assert.deepEqual(listed.contents, ['1 ledger entry'])

        const refused = await send(year(EMPTY_YEAR), 'DELETE')
        assert.equal(refused.status, 409)
        // figures set count as something in it too
        assert.equal((await send(year(YEAR), 'DELETE')).status, 409)

        await prisma.transaction.delete({ where: { transactionId: spent.transactionId } })
        assert.equal((await send(year(EMPTY_YEAR), 'DELETE')).status, 200)
    })
})
