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
        reimbursements: (await import('../src/routes/reimbursementRoutes.js')).default,
        financeCategories: (await import('../src/routes/financeCategoryRoutes.js')).default
    }
    await prisma.yearTarget.upsert({
        where: { schoolYear: YEAR },
        update: { duesAmount: 20 },
        create: { schoolYear: YEAR, incomeGoal: 0, expenseBudget: 0, duesAmount: 20 }
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
    await prisma.financeCategory.deleteMany({ where: { key: { startsWith: tag } } })
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

// every one charges $5 to someone unpaid unless told otherwise — the price
// is the event's own, not the year's
async function event(track, fields = {}) {
    const row = await prisma.event.create({
        data: { title: `${tag} ${track}`, date: new Date(DAY), track, nonmemberPrice: 5, ...fields }
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
    const lab = await prisma.lab.create({ data: { title: `${tag} lab`, date: new Date(DAY), nonmemberPrice: 7.5 } })
    made.labs.push(lab.labId)

    const pick = (rows, key, id) => rows.find((row) => row[key] === id)
    await as(member, 'member', 'events', async (base) => {
        const rows = await (await fetch(base)).json()
        assert.deepEqual(pick(rows, 'eventId', members).dues, { schoolYear: YEAR, amount: 20, price: 5 })
        assert.equal(pick(rows, 'eventId', open).dues, null)
        assert.equal((await (await fetch(`${base}/${members}`)).json()).dues.price, 5)
    })
    await as(member, 'member', 'labs', async (base) => {
        assert.equal(pick(await (await fetch(base)).json(), 'labId', lab.labId).dues.price, 7.5)
        assert.equal((await (await fetch(`${base}/${lab.labId}`)).json()).dues.price, 7.5)
    })
    await as(officer, 'officer', 'events', async (base) => {
        assert.equal(pick(await (await fetch(base)).json(), 'eventId', members).dues, null)
    })

    await prisma.duesPayment.create({ data: { memberId: member, schoolYear: YEAR, amount: 0 } })
    await as(member, 'member', 'events', async (base) => {
        assert.equal(pick(await (await fetch(base)).json(), 'eventId', members).dues, null)
    })
})

test('each lab and event charges its own price at the door, and none set means no fee to take', { skip }, async () => {
    const officer = await person('officer')
    const member = await person('member')
    const pricey = await event('members', { nonmemberPrice: 12 })
    const free = await event('members', { nonmemberPrice: 0 })
    for (const eventId of [pricey, free]) {
        await prisma.memberEvent.create({ data: { memberId: member, eventId } })
    }

    await as(officer, 'officer', 'events', async (base) => {
        const asked = await (await send(`${base}/${pricey}/roster`, 'POST', { action: 'checkin', memberId: member })).json()
        assert.equal(asked.price, 12)
        // the dues are still the year's
        assert.equal(asked.amount, 20)
        assert.equal((await send(`${base}/${free}/roster`, 'POST', { action: 'checkin', memberId: member, dues: 'fee' })).status, 400)
        assert.equal((await send(`${base}/${pricey}/roster`, 'POST', { action: 'checkin', memberId: member, dues: 'fee' })).status, 200)
    })
    const fee = await prisma.transaction.findFirst({ where: { category: 'fees', source: { contains: tag }, amount: 12 } })
    assert.ok(fee, 'a $12 fees row')
})

test('the price is set when a lab or event is made and edited, and junk is refused', { skip }, async () => {
    const officer = await person('officer')
    await as(officer, 'officer', 'labs', async (base) => {
        const created = await send(base, 'POST', { title: `${tag} priced lab`, date: DAY, nonmemberPrice: '6.50' })
        assert.equal(created.status, 201)
        const lab = await created.json()
        made.labs.push(lab.labId)
        assert.equal(Number(lab.nonmemberPrice), 6.5)

        assert.equal(Number((await (await send(`${base}/${lab.labId}`, 'PUT', { nonmemberPrice: 8 })).json()).nonmemberPrice), 8)
        // blank is no price at all
        assert.equal(Number((await (await send(`${base}/${lab.labId}`, 'PUT', { nonmemberPrice: '' })).json()).nonmemberPrice), 0)
        for (const junk of [-1, 'five', 1.234]) {
            assert.equal((await send(`${base}/${lab.labId}`, 'PUT', { nonmemberPrice: junk })).status, 400, String(junk))
        }
        // a draft on a live lab parks the price with the rest
        await send(`${base}/${lab.labId}`, 'PUT', { nonmemberPrice: 9, published: false })
        const row = await prisma.lab.findUnique({ where: { labId: lab.labId }, select: { nonmemberPrice: true, draft: true } })
        assert.equal(Number(row.nonmemberPrice), 0)
        assert.equal(row.draft.nonmemberPrice, 9)
    })

    await as(officer, 'officer', 'events', async (base) => {
        const created = await (await send(base, 'POST', { title: `${tag} priced event`, type: 'social', track: 'members', date: DAY, nonmemberPrice: 4 })).json()
        made.events.push(created.eventId)
        assert.equal(Number(created.nonmemberPrice), 4)
        assert.equal(Number((await (await send(`${base}/${created.eventId}`, 'PUT', { nonmemberPrice: 3 })).json()).nonmemberPrice), 3)
        assert.equal((await send(`${base}/${created.eventId}`, 'PUT', { nonmemberPrice: -2 })).status, 400)
        // open to all charges nobody, so it keeps no price
        assert.equal(Number((await (await send(`${base}/${created.eventId}`, 'PUT', { track: 'open' })).json()).nonmemberPrice), 0)

        const open = await (await send(base, 'POST', { title: `${tag} open priced`, type: 'social', track: 'open', date: DAY, nonmemberPrice: 4 })).json()
        made.events.push(open.eventId)
        assert.equal(Number(open.nonmemberPrice), 0)
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

// ---- VIP -------------------------------------------------------------------
//
// VIP follows this school year's dues, so these run against the real current
// year. Its dues amount is set for the tests and put back as it was after.

async function thisYear(duesAmount) {
    const { schoolYearOf } = await import('../src/dues.js')
    const { clubToday } = await import('../src/clubTime.js')
    const schoolYear = schoolYearOf(clubToday())
    const before = await prisma.yearTarget.findUnique({ where: { schoolYear } })
    await prisma.yearTarget.upsert({
        where: { schoolYear },
        update: { duesAmount },
        create: { schoolYear, incomeGoal: 0, expenseBudget: 0, duesAmount }
    })
    const restore = () => before
        ? prisma.yearTarget.update({ where: { schoolYear }, data: { duesAmount: before.duesAmount } })
        : prisma.yearTarget.delete({ where: { schoolYear } })
    return { schoolYear, restore }
}

const roleOf = async (userId) => (await prisma.member.findUnique({ where: { userId }, select: { role: true } })).role

test('paying this year makes a member VIP, and taking it back makes them a member again; j-board stays j-board', { skip }, async () => {
    const { schoolYear, restore } = await thisYear(20)
    try {
        const treasurer = await person('treasurer')
        const member = await person('member')
        const jboard = await person('jboard')
        await as(treasurer, 'treasurer', 'dues', async (base) => {
            const paid = await (await send(base, 'POST', { memberId: member, schoolYear, amount: 20 })).json()
            assert.equal(await roleOf(member), 'vip')
            await send(base, 'POST', { memberId: jboard, schoolYear, amount: 20 })
            assert.equal(await roleOf(jboard), 'jboard')

            await send(`${base}/${paid.duesId}`, 'DELETE')
            assert.equal(await roleOf(member), 'member')

            // last year's payment doesn't make anyone VIP this year
            await send(base, 'POST', { memberId: member, schoolYear: YEAR, amount: 20 })
            assert.equal(await roleOf(member), 'member')
        })
    } finally {
        await restore()
    }
})

test('picking VIP on /students marks their dues paid; taking VIP back off is refused while they have paid', { skip }, async () => {
    const { schoolYear, restore } = await thisYear(0)
    try {
        const admin = await person('admin')
        const member = await person('member')
        await as(admin, 'admin', 'members', async (base) => {
            // no dues amount set for the year: nothing to mark them paid with
            assert.equal((await send(`${base}/${member}/role`, 'PUT', { role: 'vip' })).status, 400)
            assert.equal(await roleOf(member), 'member')

            await prisma.yearTarget.update({ where: { schoolYear }, data: { duesAmount: 25 } })
            const made = await send(`${base}/${member}/role`, 'PUT', { role: 'vip' })
            assert.equal(made.status, 200)
            assert.equal((await made.json()).role, 'vip')
            const payment = await prisma.duesPayment.findUnique({
                where: { memberId_schoolYear: { memberId: member, schoolYear } },
                include: { transaction: true }
            })
            assert.equal(Number(payment.amount), 25)
            assert.equal(payment.transaction.category, 'dues')

            assert.equal((await send(`${base}/${member}/role`, 'PUT', { role: 'member' })).status, 409)
            assert.equal(await roleOf(member), 'vip')
        })
    } finally {
        await restore()
    }
})

test('a new school year turns last year’s VIPs back into members', { skip }, async () => {
    const { syncVipRoles } = await import('../src/dues.js')
    const { schoolYear, restore } = await thisYear(20)
    try {
        const member = await person('member')
        await prisma.duesPayment.create({ data: { memberId: member, schoolYear, amount: 0 } })
        await syncVipRoles(prisma)
        assert.equal(await roleOf(member), 'vip')
        // a day in the next school year, with nothing paid for it
        const next = Number(schoolYear.slice(0, 4)) + 1
        await syncVipRoles(prisma, `${next}-09-01`)
        assert.equal(await roleOf(member), 'member')
    } finally {
        await restore()
    }
})

test('a VIP sees exactly the events a member does', { skip }, async () => {
    const vip = await person('vip')
    const tracks = ['members', 'open', 'officers', 'board', 'jboard']
    const ids = await Promise.all(tracks.map((track) => event(track)))
    await as(vip, 'vip', 'events', async (base) => {
        const seen = (await (await fetch(base)).json()).filter((row) => ids.includes(row.eventId)).map((row) => row.track).sort()
        assert.deepEqual(seen, ['members', 'open'])
    })
})

test('the treasurer adds and removes finance categories, but not the ones the app files money under', { skip }, async () => {
    const treasurer = await person('treasurer')
    const officer = await person('officer')
    const label = `${tag} Merch`

    await as(officer, 'officer', 'financeCategories', async (base) => {
        assert.equal((await send(base, 'POST', { label, type: 'expense', color: '#FF7D45' })).status, 403)
        assert.equal((await send(`${base}/lab`, 'DELETE')).status, 403)
    })

    let key
    await as(treasurer, 'treasurer', 'financeCategories', async (base) => {
        const added = await send(base, 'POST', { label, type: 'expense', color: '#ff7d45' })
        assert.equal(added.status, 201)
        const category = await added.json()
        key = category.key
        assert.equal(key, `${tag}_merch`)
        assert.equal(category.color, '#FF7D45')

        // the same name again, in any case, is refused
        assert.equal((await send(base, 'POST', { label: label.toUpperCase(), type: 'income', color: '#FF7D45' })).status, 409)
        assert.equal((await send(base, 'POST', { label: 'x', type: 'both', color: '#FF7D45' })).status, 400)
        assert.equal((await send(base, 'POST', { label: 'x', type: 'income', color: 'red' })).status, 400)

        for (const locked of ['grants', 'dues', 'fees', 'sponsors']) {
            const refused = await send(`${base}/${locked}`, 'DELETE')
            assert.equal(refused.status, 409, locked)
            assert.match((await refused.json()).message, /can't be removed/)
        }

        const listed = (await (await fetch(base)).json()).find((row) => row.key === key)
        assert.equal(listed.locked, null)
        assert.equal(listed.inUse, 0)
        assert.ok((await (await fetch(base)).json()).find((row) => row.key === 'dues').locked)
    })

    // a receipt can be filed under the new one, but not under an income one
    let receipt
    await as(officer, 'officer', 'reimbursements', async (base) => {
        assert.equal((await send(base, 'POST', { title: `${tag} tote bags`, amountRequested: 30, category: 'dues' })).status, 400)
        const filed = await send(base, 'POST', { title: `${tag} tote bags`, amountRequested: 30, category: key })
        assert.equal(filed.status, 201)
        receipt = (await filed.json()).reimbursementId
        made.reimbursements.push(receipt)
    })

    // and a ledger row only under one of its own half
    await as(treasurer, 'treasurer', 'transactions', async (base) => {
        assert.equal((await send(base, 'POST', { type: 'income', source: `${tag} totes`, amount: 5, category: key })).status, 400)
        assert.equal((await send(base, 'POST', { type: 'expense', source: `${tag} totes`, amount: 5, category: 'nope' })).status, 400)
    })

    await as(treasurer, 'treasurer', 'financeCategories', async (base) => {
        // still filed under, so it stays
        const inUse = await send(`${base}/${key}`, 'DELETE')
        assert.equal(inUse.status, 409)
        assert.match((await inUse.json()).message, /1 receipt is still filed/)

        await prisma.reimbursement.delete({ where: { reimbursementId: receipt } })
        assert.equal((await send(`${base}/${key}`, 'DELETE')).status, 200)
        assert.equal(await prisma.financeCategory.count({ where: { key } }), 0)
    })
})

test('the $ settles the entry ahead of time, and checking them in then doesn’t ask', { skip }, async () => {
    const officer = await person('officer')
    const member = await person('member')
    const waived = await person('member')
    const eventId = await event('members')
    for (const memberId of [member, waived]) {
        await prisma.memberEvent.create({ data: { memberId, eventId } })
    }

    await as(officer, 'officer', 'events', async (base) => {
        const roster = async () => (await (await fetch(`${base}/${eventId}/roster`)).json())
        const row = async (memberId) => (await roster()).find((entry) => entry.memberId === memberId)

        const before = await row(member)
        assert.equal(before.duesPaid, false)
        assert.equal(before.owesDues, true)
        assert.equal(before.doorPayment, null)
        assert.equal((await row(officer)), undefined)

        assert.equal((await send(`${base}/${eventId}/roster`, 'POST', { action: 'dues', memberId: member, dues: 'bogus' })).status, 400)
        assert.equal((await send(`${base}/${eventId}/roster`, 'POST', { action: 'dues', memberId: member, dues: 'fee' })).status, 200)
        assert.equal((await send(`${base}/${eventId}/roster`, 'POST', { action: 'dues', memberId: waived, dues: 'waive' })).status, 200)
        // once is enough
        assert.equal((await send(`${base}/${eventId}/roster`, 'POST', { action: 'dues', memberId: member, dues: 'fee' })).status, 409)

        const after = await row(member)
        assert.equal(after.doorPayment, 'fee')
        assert.equal(after.owesDues, false)
        assert.equal((await row(waived)).doorPayment, 'waive')

        // the tick checks them straight in
        assert.equal((await send(`${base}/${eventId}/roster`, 'POST', { action: 'checkin', memberId: member })).status, 200)
        assert.equal((await send(`${base}/${eventId}/roster`, 'POST', { action: 'checkin', memberId: waived })).status, 200)
    })

    // the entry's in the ledger once — paid ahead, not again at the tick —
    // and the waived one isn't
    const name = async (userId) => (await prisma.user.findUnique({ where: { userId } })).lastName
    const feesFor = async (userId) => prisma.transaction.count({
        where: { category: 'fees', source: { startsWith: `${tag} ${await name(userId)} — ${tag} members` } }
    })
    assert.equal(await feesFor(member), 1)
    assert.equal(await feesFor(waived), 0)
})

test('paying dues ahead of time from the $ makes them VIP — a crown, not a $', { skip }, async () => {
    const officer = await person('officer')
    const member = await person('member')
    const labRow = await prisma.lab.create({ data: { title: `${tag} crown lab`, date: new Date(DAY), nonmemberPrice: 5 } })
    made.labs.push(labRow.labId)
    await prisma.memberLab.create({ data: { memberId: member, labId: labRow.labId } })

    await as(officer, 'officer', 'labs', async (base) => {
        assert.equal((await send(`${base}/${labRow.labId}/roster`, 'POST', { action: 'dues', memberId: member, dues: 'paid' })).status, 200)
        const row = (await (await fetch(`${base}/${labRow.labId}/roster`)).json()).find((entry) => entry.memberId === member)
        assert.equal(row.duesPaid, true)
        assert.equal(row.owesDues, false)
        assert.equal(row.doorPayment, null)
    })
})
