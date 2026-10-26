// Members paying on their own — the ways to pay, a payment sent in from a
// lab's page, the treasurer approving or sending it back, and taking an
// approval back (the check-in page's grey $, the dues card's undo) — against
// a real Postgres. Same rules as money.test.js: the database's name has to
// contain "test", and every row made here is removed at the end.
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

// labs dated into a school year nothing else uses, so its dues are this
// file's to set
const DAY = '2033-02-10'
const YEAR = '2032–33'
const QR = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

let prisma, routes
const tag = `p${Date.now().toString(36)}`
const made = { users: [], labs: [], methods: [] }

before(async () => {
    if (skip) { return }
    prisma = (await import('../src/prismaClient.js')).default
    routes = {
        payments: (await import('../src/routes/paymentRoutes.js')).default,
        methods: (await import('../src/routes/paymentMethodRoutes.js')).default,
        labs: (await import('../src/routes/labRoutes.js')).default,
        dues: (await import('../src/routes/duesRoutes.js')).default,
        members: (await import('../src/routes/memberRoutes.js')).default,
        reimbursements: (await import('../src/routes/reimbursementRoutes.js')).default
    }
    await prisma.yearTarget.upsert({
        where: { schoolYear: YEAR },
        update: { duesAmount: 25 },
        create: { schoolYear: YEAR, incomeGoal: 0, expenseBudget: 0, duesAmount: 25 }
    })
})

after(async () => {
    if (skip) { return }
    const users = { in: made.users }
    await prisma.memberPayment.deleteMany({ where: { memberId: users } })
    await prisma.transaction.deleteMany({ where: { reimbursement: { memberId: users } } })
    await prisma.reimbursement.deleteMany({ where: { memberId: users } })
    await prisma.duesPayment.deleteMany({ where: { memberId: users } })
    await prisma.transaction.deleteMany({ where: { source: { contains: tag } } })
    await prisma.activityLog.deleteMany({ where: { OR: [{ targetId: users }, { actorId: users }] } })
    await prisma.lab.deleteMany({ where: { labId: { in: made.labs } } })
    await prisma.paymentMethod.deleteMany({ where: { methodId: { in: made.methods } } })
    await prisma.user.deleteMany({ where: { userId: users } })
    await prisma.yearTarget.deleteMany({ where: { schoolYear: YEAR } })
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
            firstName: tag,
            lastName: `P${n}`,
            emailVerified: true,
            waiverSigned: true,
            member: { create: { role } }
        }
    })
    made.users.push(user.userId)
    return user.userId
}

async function lab(signedUp = [], date = DAY) {
    const row = await prisma.lab.create({ data: { title: `${tag} lab ${made.labs.length}`, date: new Date(date), nonmemberPrice: 20 } })
    made.labs.push(row.labId)
    for (const memberId of signedUp) {
        await prisma.memberLab.create({ data: { memberId, labId: row.labId } })
    }
    return row.labId
}

// the real routes, behind a stand-in for the auth middleware
async function as(userId, role, mount, run) {
    const app = express()
    app.use(express.json({ limit: '15mb' }))
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
const json = async (url) => (await fetch(url)).json()

async function aMethod() {
    const treasurer = await person('treasurer')
    return as(treasurer, 'treasurer', 'methods', async (base) => {
        const method = await (await send(base, 'POST', { title: `${tag} Venmo`, image: QR, description: '@club' })).json()
        made.methods.push(method.methodId)
        return method
    })
}

test('only the treasurer or an admin keeps the ways to pay; everyone reads them', { skip }, async () => {
    const officer = await person('officer')
    const member = await person('member')
    const treasury = await person('jboard')
    await as(officer, 'officer', 'methods', async (base) => {
        assert.equal((await send(base, 'POST', { title: 'Venmo' })).status, 403)
    })
    await as(treasury, 'jboard', 'methods', async (base) => {
        assert.equal((await send(base, 'POST', { title: 'Venmo' })).status, 403)
    })
    const admin = await person('admin')
    await as(admin, 'admin', 'methods', async (base) => {
        assert.equal((await send(base, 'POST', {})).status, 400)
        assert.equal((await send(base, 'POST', { title: 'x', image: 'not a picture' })).status, 400)
    })
    const method = await aMethod()
    assert.equal(method.description, '@club')
    await as(member, 'member', 'methods', async (base) => {
        assert.ok((await json(base)).some((row) => row.methodId === method.methodId))
    })
})

test('a lab fee sent in, approved, then taken back from the grey $', { skip }, async () => {
    const method = await aMethod()
    const treasurer = await person('treasurer')
    const officer = await person('officer')
    const member = await person('member')
    const labId = await lab([member])

    // what they can pay for: the fee, or the year's dues
    let payment
    await as(member, 'member', 'payments', async (base) => {
        const options = await json(`${base}/options?labId=${labId}`)
        assert.deepEqual(options.choices.map((choice) => [choice.kind, choice.amount]), [['fee', 20], ['dues', 25]])
        assert.equal(options.schoolYear, YEAR)

        assert.equal((await send(base, 'POST', { kind: 'fee', labId, methodId: method.methodId })).status, 400)
        assert.equal((await send(base, 'POST', { kind: 'fee', labId, reference: 'X1' })).status, 400)
        const sent = await send(base, 'POST', { kind: 'fee', labId, methodId: method.methodId, reference: '#X1', screenshot: QR })
        assert.equal(sent.status, 201)
        payment = await sent.json()
        assert.equal(payment.status, 'pending')
        assert.equal(payment.reference, 'X1')
        assert.equal(payment.amount, 20)
        // one waiting at a time
        assert.equal((await send(base, 'POST', { kind: 'fee', labId, methodId: method.methodId, reference: 'X2' })).status, 409)
    })

    // the roster says it's waiting
    await as(officer, 'officer', 'labs', async (base) => {
        const row = (await json(`${base}/${labId}/roster`)).find((entry) => entry.memberId === member)
        assert.equal(row.paymentPending, true)
        assert.equal(row.owesDues, true)
    })

    // a member can't approve it; officers and up can
    await as(member, 'member', 'payments', async (base) => {
        assert.equal((await send(`${base}/${payment.paymentId}/approve`, 'POST')).status, 403)
    })
    await as(treasurer, 'treasurer', 'payments', async (base) => {
        const listed = await json(`${base}?labId=${labId}&status=pending`)
        assert.deepEqual(listed.map((row) => row.paymentId), [payment.paymentId])
        assert.equal((await send(`${base}/${payment.paymentId}/approve`, 'POST')).status, 200)
        assert.equal((await send(`${base}/${payment.paymentId}/approve`, 'POST')).status, 409)
    })

    const link = await prisma.memberLab.findUnique({ where: { memberId_labId: { memberId: member, labId } } })
    assert.equal(link.doorPayment, 'fee')
    const income = await prisma.transaction.findUnique({ where: { transactionId: link.doorTransactionId } })
    assert.equal(income.category, 'fees')
    assert.equal(Number(income.amount), 20)
    assert.equal(income.source, `${tag} P${counter - 1} — ${tag} lab ${made.labs.length - 1} — #X1 — ${tag} Venmo`)

    await as(officer, 'officer', 'labs', async (base) => {
        const row = (await json(`${base}/${labId}/roster`)).find((entry) => entry.memberId === member)
        assert.equal(row.doorPayment, 'fee')
        assert.equal(row.owesDues, false)
        // only the treasurer or an admin takes it back
        assert.equal((await send(`${base}/${labId}/roster`, 'POST', { action: 'undo-dues', memberId: member })).status, 403)
    })
    await as(treasurer, 'treasurer', 'labs', async (base) => {
        assert.equal((await send(`${base}/${labId}/roster`, 'POST', { action: 'undo-dues', memberId: member })).status, 200)
        const row = (await json(`${base}/${labId}/roster`)).find((entry) => entry.memberId === member)
        assert.equal(row.doorPayment, null)
        assert.equal(row.owesDues, true)
    })
    assert.equal(await prisma.transaction.count({ where: { transactionId: income.transactionId } }), 0)
    assert.equal((await prisma.memberPayment.findUnique({ where: { paymentId: payment.paymentId } })).status, 'reversed')

    // and they can send another
    await as(member, 'member', 'payments', async (base) => {
        assert.equal((await send(base, 'POST', { kind: 'fee', labId, methodId: method.methodId, reference: 'X3' })).status, 201)
    })
})

test('a manual $ takes the platform and transaction id into the ledger', { skip }, async () => {
    const officer = await person('officer')
    const member = await person('member')
    const labId = await lab([member])
    await as(officer, 'officer', 'labs', async (base) => {
        const done = await send(`${base}/${labId}/roster`, 'POST', { action: 'dues', memberId: member, dues: 'fee', method: 'Zelle', reference: 'Z9' })
        assert.equal(done.status, 200)
    })
    const link = await prisma.memberLab.findUnique({ where: { memberId_labId: { memberId: member, labId } } })
    const income = await prisma.transaction.findUnique({ where: { transactionId: link.doorTransactionId } })
    assert.match(income.source, /— #Z9 — Zelle$/)
})

test('VIP dues sent in make them VIP; the dues card’s undo puts it back to pending', { skip }, async () => {
    const method = await aMethod()
    const treasurer = await person('treasurer')
    const member = await person('member')
    const labId = await lab([member])

    let payment
    await as(member, 'member', 'payments', async (base) => {
        payment = await (await send(base, 'POST', { kind: 'dues', labId, methodId: method.methodId, reference: 'D1' })).json()
        assert.equal(payment.amount, 25)
    })

    // the dues card's "pending" filter has it
    await as(treasurer, 'treasurer', 'dues', async (base) => {
        const sheet = await json(`${base}?schoolYear=${encodeURIComponent(YEAR)}`)
        assert.equal(sheet.members.find((row) => row.userId === member).pending.paymentId, payment.paymentId)
    })

    await as(treasurer, 'treasurer', 'payments', async (base) => {
        assert.equal((await send(`${base}/${payment.paymentId}/approve`, 'POST')).status, 200)
    })
    // the year's dues, and the lab's fee with them, are settled
    const duesRow = await prisma.duesPayment.findUnique({ where: { memberId_schoolYear: { memberId: member, schoolYear: YEAR } } })
    assert.ok(duesRow)
    await as(member, 'member', 'payments', async (base) => {
        const options = await json(`${base}/options?labId=${labId}`)
        assert.equal(options.duesPaid, true)
        assert.deepEqual(options.choices, [])
        assert.equal(options.payments[0].status, 'approved')
    })

    await as(treasurer, 'treasurer', 'dues', async (base) => {
        assert.equal((await send(`${base}/${duesRow.duesId}`, 'DELETE')).status, 200)
    })
    assert.equal((await prisma.memberPayment.findUnique({ where: { paymentId: payment.paymentId } })).status, 'pending')
    assert.equal(await prisma.duesPayment.count({ where: { memberId: member, schoolYear: YEAR } }), 0)
})

test('sent back with a reason, then sent again — the spot held for 48 hours', { skip }, async () => {
    const method = await aMethod()
    const treasurer = await person('treasurer')
    const member = await person('member')
    const labId = await lab([member])
    let payment
    await as(member, 'member', 'payments', async (base) => {
        payment = await (await send(base, 'POST', { kind: 'fee', labId, methodId: method.methodId, reference: 'R1' })).json()
    })
    await as(treasurer, 'treasurer', 'payments', async (base) => {
        assert.equal((await send(`${base}/${payment.paymentId}/send-back`, 'POST', {})).status, 400)
        const rejected = await (await send(`${base}/${payment.paymentId}/send-back`, 'POST', { reason: 'No Venmo payment with that id' })).json()
        assert.equal(rejected.status, 'rejected')
    })
    await as(member, 'member', 'payments', async (base) => {
        const options = await json(`${base}/options?labId=${labId}`)
        assert.equal(options.payments[0].rejectionReason, 'No Venmo payment with that id')
        assert.equal((await send(base, 'POST', { kind: 'fee', labId, methodId: method.methodId, reference: 'R2' })).status, 201)
    })
})

test('"email unpaid" reminds only who owes and hasn’t sent anything in', { skip }, async () => {
    const method = await aMethod()
    const officer = await person('officer')
    const owes = await person('member')
    const sent = await person('member')
    const staff = await person('officer')
    const labId = await lab([owes, sent, staff])
    await as(sent, 'member', 'payments', async (base) => {
        await send(base, 'POST', { kind: 'fee', labId, methodId: method.methodId, reference: 'E1' })
    })
    await as(officer, 'officer', 'labs', async (base) => {
        const reply = await (await send(`${base}/${labId}/remind-unpaid`, 'POST')).json()
        assert.equal(reply.sent, 1)
    })
})

test('a pending payment can be fixed by whoever sent it, until it’s looked at', { skip }, async () => {
    const method = await aMethod()
    const treasurer = await person('treasurer')
    const member = await person('member')
    const other = await person('member')
    const labId = await lab([member])
    let payment
    await as(member, 'member', 'payments', async (base) => {
        payment = await (await send(base, 'POST', { kind: 'fee', labId, methodId: method.methodId, reference: 'TYPO', screenshot: QR })).json()
        // the transaction id fixed, and it was the dues after all — the screenshot stays
        const fixed = await send(`${base}/${payment.paymentId}`, 'PUT', { kind: 'dues', methodId: method.methodId, reference: 'RIGHT' })
        assert.equal(fixed.status, 200)
        const body = await fixed.json()
        assert.equal(body.reference, 'RIGHT')
        assert.equal(body.kind, 'dues')
        assert.equal(body.amount, 25)
        assert.equal(body.screenshot, QR)
        assert.equal((await send(`${base}/${payment.paymentId}`, 'PUT', { kind: 'dues', methodId: method.methodId, reference: 'R', screenshot: null })).status, 200)
        assert.equal((await prisma.memberPayment.findUnique({ where: { paymentId: payment.paymentId } })).screenshot, null)
    })
    // not someone else's
    await as(other, 'member', 'payments', async (base) => {
        assert.equal((await send(`${base}/${payment.paymentId}`, 'PUT', { kind: 'dues', methodId: method.methodId, reference: 'X' })).status, 404)
    })
    // and not once it's been looked at
    await as(treasurer, 'treasurer', 'payments', async (base) => {
        await send(`${base}/${payment.paymentId}/send-back`, 'POST', { reason: 'no' })
    })
    await as(member, 'member', 'payments', async (base) => {
        assert.equal((await send(`${base}/${payment.paymentId}`, 'PUT', { kind: 'dues', methodId: method.methodId, reference: 'X' })).status, 409)
    })
})

test('a way to pay can be edited — a QR code left out stays', { skip }, async () => {
    const method = await aMethod()
    const treasurer = await person('treasurer')
    const officer = await person('officer')
    await as(officer, 'officer', 'methods', async (base) => {
        assert.equal((await send(`${base}/${method.methodId}`, 'PUT', { title: 'x' })).status, 403)
    })
    await as(treasurer, 'treasurer', 'methods', async (base) => {
        const edited = await (await send(`${base}/${method.methodId}`, 'PUT', { title: `${tag} Venmo 2`, description: '@new' })).json()
        assert.equal(edited.title, `${tag} Venmo 2`)
        assert.equal(edited.description, '@new')
        assert.equal(edited.image, QR)
        const cleared = await (await send(`${base}/${method.methodId}`, 'PUT', { title: `${tag} Venmo 2`, image: null })).json()
        assert.equal(cleared.image, null)
    })
})

test('leaving after paying just leaves: nothing is refunded', { skip }, async () => {
    const method = await aMethod()
    const officer = await person('officer')
    const member = await person('member')
    const labId = await lab([member])
    let sent
    await as(member, 'member', 'payments', async (base) => {
        sent = await (await send(base, 'POST', { kind: 'fee', labId, methodId: method.methodId, reference: 'L1' })).json()
    })
    await as(officer, 'officer', 'payments', async (base) => {
        await send(`${base}/${sent.paymentId}/approve`, 'POST')
    })
    await as(member, 'member', 'labs', async (base) => {
        assert.equal((await send(`${base}/${labId}/rsvp`, 'DELETE')).status, 200)
    })
    const payment = await prisma.memberPayment.findUnique({ where: { paymentId: sent.paymentId } })
    assert.equal(payment.status, 'approved')
    assert.equal(await prisma.transaction.count({ where: { transactionId: payment.transactionId } }), 1)
})

test('"reject" moves them to the waitlist; "send back" holds the spot for 48 hours, then does', { skip }, async () => {
    const method = await aMethod()
    const officer = await person('officer')
    const rejected = await person('member')
    const sentBack = await person('member')
    const labId = await lab([rejected, sentBack])
    const pay = async (who, ref) => {
        let payment
        await as(who, 'member', 'payments', async (base) => {
            payment = await (await send(base, 'POST', { kind: 'fee', labId, methodId: method.methodId, reference: ref })).json()
        })
        return payment
    }
    const status = async (memberId) => (await prisma.memberLab.findUnique({ where: { memberId_labId: { memberId, labId } } })).attendanceStatus
    const one = await pay(rejected, 'J1')
    const two = await pay(sentBack, 'J2')

    await as(officer, 'officer', 'payments', async (base) => {
        const reply = await (await send(`${base}/${one.paymentId}/reject`, 'POST', { reason: 'Not ours' })).json()
        assert.equal(reply.status, 'declined')
        assert.equal(await status(rejected), 'waitlisted')

        await send(`${base}/${two.paymentId}/send-back`, 'POST', { reason: 'Wrong id' })
        assert.equal(await status(sentBack), 'rsvped')
    })
    // the page has the new due date: 48 hours from being sent back
    await as(sentBack, 'member', 'labs', async (base) => {
        const { pay } = await json(`${base}/${labId}`)
        assert.equal(pay.sent, false)
        const reviewed = (await prisma.memberPayment.findUnique({ where: { paymentId: two.paymentId } })).reviewedAt
        assert.equal(new Date(pay.fixBy).getTime(), reviewed.getTime() + 48 * 3_600_000)
    })

    const { enforcePaymentRules } = await import('../src/payments.js')
    // inside the 48 hours: still theirs
    await enforcePaymentRules(new Date(Date.now() + 47 * 3_600_000))
    assert.equal(await status(sentBack), 'rsvped')
    // past it, unfixed: moved, and the payment declined
    await enforcePaymentRules(new Date(Date.now() + 49 * 3_600_000))
    assert.equal(await status(sentBack), 'waitlisted')
    assert.equal((await prisma.memberPayment.findUnique({ where: { paymentId: two.paymentId } })).status, 'declined')
})

test('the due date moves whoever owes and sent nothing; a payment waiting keeps the spot', { skip }, async () => {
    const method = await aMethod()
    const officer = await person('officer')
    const unpaid = await person('member')
    const waiting = await person('member')
    const atDoor = await person('member')
    const date = '2034-03-10'
    const labId = await lab([unpaid, waiting, atDoor], date)
    await as(waiting, 'member', 'payments', async (base) => {
        await send(base, 'POST', { kind: 'fee', labId, methodId: method.methodId, reference: 'W1' })
    })
    await as(officer, 'officer', 'labs', async (base) => {
        await send(`${base}/${labId}/roster`, 'POST', { action: 'dues', memberId: atDoor, dues: 'fee' })
    })
    const { enforcePaymentRules } = await import('../src/payments.js')
    const { paymentDueAt } = await import('../src/payable.js')
    const due = paymentDueAt({ date: new Date(date) })
    const status = async (memberId) => (await prisma.memberLab.findUnique({ where: { memberId_labId: { memberId, labId } } })).attendanceStatus

    await enforcePaymentRules(new Date(due.getTime() - 60_000))
    assert.equal(await status(unpaid), 'rsvped')
    await enforcePaymentRules(new Date(due.getTime() + 60_000))
    assert.equal(await status(unpaid), 'waitlisted')
    assert.equal(await status(waiting), 'rsvped')
    assert.equal(await status(atDoor), 'rsvped')
    assert.ok((await prisma.lab.findUnique({ where: { labId } })).paymentsDueSweptAt)
})

test('paying confirms the spot; there’s no confirming without it, and it says so once done', { skip }, async () => {
    const method = await aMethod()
    const officer = await person('officer')
    const member = await person('member')
    const labId = await lab([member])
    await as(member, 'member', 'labs', async (base) => {
        const lab = await json(`${base}/${labId}`)
        assert.equal(lab.pay.sent, false)
        assert.equal(lab.pay.dueBy, 'week')
        assert.ok(lab.paymentDueAt)
        const refused = await send(`${base}/${labId}/confirm`, 'POST')
        assert.equal(refused.status, 409)
        assert.equal((await refused.json()).code, 'PAY_FIRST')
    })
    let sent
    await as(member, 'member', 'payments', async (base) => {
        sent = await (await send(base, 'POST', { kind: 'fee', labId, methodId: method.methodId, reference: 'C1' })).json()
    })
    // sent, not yet approved: held, but only the approval confirms it
    await as(member, 'member', 'labs', async (base) => {
        assert.equal((await json(`${base}/${labId}`)).pay.sent, true)
        const held = await send(`${base}/${labId}/confirm`, 'POST')
        assert.equal(held.status, 409)
        assert.equal((await held.json()).code, 'PAYMENT_PENDING')
    })
    assert.equal((await prisma.memberLab.findUnique({ where: { memberId_labId: { memberId: member, labId } } })).confirmedAt, null)
    await as(officer, 'officer', 'payments', async (base) => {
        await send(`${base}/${sent.paymentId}/approve`, 'POST')
    })
    const link = await prisma.memberLab.findUnique({ where: { memberId_labId: { memberId: member, labId } } })
    assert.ok(link.confirmedAt)
    await as(member, 'member', 'labs', async (base) => {
        const again = await (await send(`${base}/${labId}/confirm`, 'POST')).json()
        assert.equal(again.status, 'already')
        assert.equal(again.message, 'You’re already confirmed')
    })
})

test('a payment is due the day a week before, at 11:59 PM on the club’s clock', { skip: false }, async () => {
    const { paymentDue, paymentDueAt } = await import('../src/payable.js')
    // a Friday lab (October 30, 2026) is due the Friday before, 23:59 EDT
    assert.equal(paymentDueAt({ date: new Date('2026-10-30') }).toISOString(), '2026-10-24T03:59:00.000Z')
    assert.equal(paymentDueAt({ date: null }), null)
    // a confirmation deadline sooner than that is the due date instead; a
    // later one isn't
    const row = { date: new Date('2026-10-30') }
    assert.deepEqual(paymentDue(row, { confirmBy: new Date('2026-10-20T21:00:00Z') }), { at: new Date('2026-10-20T21:00:00Z'), by: 'confirm' })
    assert.equal(paymentDue(row, { confirmBy: new Date('2026-10-27T21:00:00Z') }).by, 'week')
    // owing late, their own 48 hours win
    assert.equal(paymentDue(row, { payBy: new Date('2026-10-28T12:00:00Z') }).by, 'late')
})

test('signing up after the due date gives 48 hours to pay, with a reminder a day', { skip }, async () => {
    const member = await person('member')
    // three days off: its due date (a week before) has passed
    const soon = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10)
    const labId = await lab([], soon)
    await as(member, 'member', 'labs', async (base) => {
        assert.equal((await send(`${base}/${labId}/rsvp`, 'POST')).status, 201)
    })
    const where = { memberId_labId: { memberId: member, labId } }
    // the clock starts as they sign up (after the reply, so give it a moment)
    let link
    for (let i = 0; i < 20 && !link?.payBy; i++) {
        await new Promise((resolve) => setTimeout(resolve, 50))
        link = await prisma.memberLab.findUnique({ where })
    }
    assert.ok(link.payBy)
    assert.ok(Math.abs(link.payBy.getTime() - (Date.now() + 48 * 3_600_000)) < 60_000)
    await as(member, 'member', 'labs', async (base) => {
        assert.equal((await json(`${base}/${labId}`)).pay.dueBy, 'late')
    })

    const { enforcePaymentRules } = await import('../src/payments.js')
    // the week-before sweep leaves them be, and a day on they're reminded
    await enforcePaymentRules(new Date(Date.now() + 25 * 3_600_000))
    link = await prisma.memberLab.findUnique({ where })
    assert.equal(link.attendanceStatus, 'rsvped')
    assert.ok(link.payRemindedAt.getTime() > Date.now() + 24 * 3_600_000)
    // past the 48 hours with nothing sent: moved
    await enforcePaymentRules(new Date(Date.now() + 49 * 3_600_000))
    link = await prisma.memberLab.findUnique({ where })
    assert.equal(link.attendanceStatus, 'waitlisted')
    assert.equal(link.payBy, null)
})

test('someone offered a spot who owes is reminded a day after the offer', { skip }, async () => {
    const member = await person('member')
    const labId = await lab([member])
    const where = { memberId_labId: { memberId: member, labId } }
    await prisma.memberLab.update({ where, data: { attendanceStatus: 'offered', offerSentAt: new Date(Date.now() - 25 * 3_600_000) } })
    const { enforcePaymentRules } = await import('../src/payments.js')
    await enforcePaymentRules()
    const reminded = (await prisma.memberLab.findUnique({ where })).payRemindedAt
    assert.ok(reminded)
    // not again the same day
    await enforcePaymentRules(new Date(Date.now() + 3_600_000))
    assert.equal((await prisma.memberLab.findUnique({ where })).payRemindedAt.getTime(), reminded.getTime())
})

test('/vip’s dues are due by the soonest thing they’re signed up for and owe', { skip }, async () => {
    const member = await person('member')
    const first = await lab([member], '2033-02-10')
    const second = await lab([member], '2033-03-01')
    const nextDue = async () => as(member, 'member', 'payments', async (base) => (await json(`${base}/options`)).nextDue)

    const due = await nextDue()
    assert.equal(due.id, first)
    assert.equal(due.by, 'week')
    // the calendar has both, soonest first, with what each would take
    const deadlines = await as(member, 'member', 'payments', async (base) => json(`${base}/deadlines`))
    assert.deepEqual(deadlines.map((d) => [d.id, d.amount]), [[first, 20], [second, 20]])
    // moved off the first, it's the second's
    await prisma.memberLab.update({ where: { memberId_labId: { memberId: member, labId: first } }, data: { attendanceStatus: 'waitlisted' } })
    assert.equal((await nextDue()).id, second)
    // nothing signed up for: no due date at all
    await prisma.memberLab.update({ where: { memberId_labId: { memberId: member, labId: second } }, data: { attendanceStatus: 'waitlisted' } })
    assert.equal(await nextDue(), null)
})

test('an offer is accepted by paying for it, and confirmed once that’s approved', { skip }, async () => {
    const method = await aMethod()
    const officer = await person('officer')
    const member = await person('member')
    const labId = await lab([member])
    const where = { memberId_labId: { memberId: member, labId } }
    await prisma.memberLab.update({ where, data: { attendanceStatus: 'offered', offerSentAt: new Date() } })

    await as(member, 'member', 'labs', async (base) => {
        const lab = await json(`${base}/${labId}`)
        assert.equal(lab.pay.sent, false)
        assert.ok(lab.offerBy)
        // no accepting with a button while it's owed
        const refused = await send(`${base}/${labId}/rsvp`, 'POST')
        assert.equal((await refused.json()).code, 'PAY_FIRST')
    })
    assert.equal((await prisma.memberLab.findUnique({ where })).attendanceStatus, 'offered')

    let sent
    await as(member, 'member', 'payments', async (base) => {
        sent = await (await send(base, 'POST', { kind: 'fee', labId, methodId: method.methodId, reference: 'O1' })).json()
    })
    assert.equal(sent.accepted, true)
    let link = await prisma.memberLab.findUnique({ where })
    assert.equal(link.attendanceStatus, 'rsvped')
    assert.equal(link.confirmedAt, null)

    await as(officer, 'officer', 'payments', async (base) => {
        await send(`${base}/${sent.paymentId}/approve`, 'POST')
    })
    link = await prisma.memberLab.findUnique({ where })
    assert.ok(link.confirmedAt)
})

test('a confirmation deadline sooner than the week before is the payment due date', { skip }, async () => {
    const method = await aMethod()
    const unpaid = await person('member')
    const paying = await person('member')
    const labId = await lab([unpaid, paying])
    // asked to confirm a month ahead of the lab — well before the week-before
    const confirmBy = new Date(new Date(DAY).getTime() - 30 * 86_400_000)
    await prisma.memberLab.updateMany({ where: { labId }, data: { confirmSentAt: new Date(), confirmBy } })

    await as(unpaid, 'member', 'labs', async (base) => {
        const lab = await json(`${base}/${labId}`)
        assert.equal(lab.pay.dueBy, 'confirm')
        assert.equal(new Date(lab.pay.dueAt).getTime(), confirmBy.getTime())
    })
    await as(paying, 'member', 'payments', async (base) => {
        await send(base, 'POST', { kind: 'fee', labId, methodId: method.methodId, reference: 'D1' })
    })

    const { enforcePaymentRules } = await import('../src/payments.js')
    const status = async (memberId) => (await prisma.memberLab.findUnique({ where: { memberId_labId: { memberId, labId } } })).attendanceStatus
    await enforcePaymentRules(new Date(confirmBy.getTime() - 60_000))
    assert.equal(await status(unpaid), 'rsvped')
    await enforcePaymentRules(new Date(confirmBy.getTime() + 60_000))
    assert.equal(await status(unpaid), 'waitlisted')
    // sending the payment met the deadline
    assert.equal(await status(paying), 'rsvped')
    // and the week-before sweep is still to come
    assert.equal((await prisma.lab.findUnique({ where: { labId } })).paymentsDueSweptAt, null)
})

test('payment history lists what they paid, however it was paid', { skip }, async () => {
    const method = await aMethod()
    const officer = await person('officer')
    const member = await person('member')
    const other = await person('member')
    const paidOnline = await lab([member])
    const paidAtDoor = await lab([member])
    const waitingOn = await lab([member])

    await as(member, 'member', 'payments', async (base) => {
        const sent = await (await send(base, 'POST', { kind: 'fee', labId: paidOnline, methodId: method.methodId, reference: 'H1' })).json()
        await as(officer, 'officer', 'payments', async (staff) => {
            await send(`${staff}/${sent.paymentId}/approve`, 'POST')
        })
        await send(base, 'POST', { kind: 'fee', labId: waitingOn, methodId: method.methodId, reference: 'H2' })
    })
    await as(officer, 'officer', 'labs', async (base) => {
        await send(`${base}/${paidAtDoor}/roster`, 'POST', { action: 'dues', memberId: member, dues: 'fee' })
    })

    await as(member, 'member', 'payments', async (base) => {
        const history = await json(`${base}/history`)
        assert.equal(history.length, 3)
        // the one still waiting first, with no approval date
        assert.equal(history[0].status, 'pending')
        assert.equal(history[0].approvedOn, null)
        assert.equal(history[0].reference, 'H2')
        const online = history.find((row) => row.reference === 'H1')
        assert.equal(online.status, 'paid')
        assert.equal(online.amount, 20)
        assert.equal(online.method, `${tag} Venmo`)
        assert.match(online.approvedOn, /^\d{4}-\d{2}-\d{2}$/)
        // taken at the door: no transaction id to show
        const door = history.find((row) => row.status === 'paid' && row.reference === null)
        assert.equal(door.kind, 'fee')
    })
    // and only theirs
    await as(other, 'member', 'payments', async (base) => {
        assert.deepEqual(await json(`${base}/history`), [])
    })
})

test('socials are optional on /account, and j-board and up see them on a profile card', { skip }, async () => {
    const member = await person('member')
    const officer = await person('officer')
    const jboard = await person('jboard')
    await as(member, 'member', 'members', async (base) => {
        const saved = await (await send(`${base}/me`, 'PUT', { instagram: '  @isabelmakes ', discord: 'isabel.h' })).json()
        assert.equal(saved.instagram, '@isabelmakes')
        assert.equal(saved.discord, 'isabel.h')
        // blank clears one
        const cleared = await (await send(`${base}/me`, 'PUT', { instagram: '', discord: 'isabel.h' })).json()
        assert.equal(cleared.instagram, null)
    })
    await as(officer, 'officer', 'members', async (base) => {
        assert.equal((await send(`${base}/${member}/card`)).status, 403)
    })
    await as(jboard, 'jboard', 'members', async (base) => {
        const card = await json(`${base}/${member}/card`)
        assert.equal(card.discord, 'isabel.h')
        assert.equal(card.instagram, null)
        assert.equal(card.role, 'member')
        assert.match(card.email, /@example\.com$/)
        assert.deepEqual(Object.keys(card.stats).sort(), ['pastEvents', 'pastLabs', 'rsvpEvents', 'rsvpLabs'])
        assert.equal((await send(`${base}/999999999/card`)).status, 404)
    })
})

test('undo takes a receipt back one step — paid to approved, approved to pending', { skip }, async () => {
    const officer = await person('officer')
    const treasurer = await person('treasurer')
    let request
    await as(officer, 'officer', 'reimbursements', async (base) => {
        request = await (await send(base, 'POST', { title: `${tag} jars`, amountRequested: 12, category: 'lab', payoutMethod: 'cash' })).json()
    })
    await as(treasurer, 'treasurer', 'reimbursements', async (base) => {
        const move = (status) => send(`${base}/${request.reimbursementId}/status`, 'PUT', { status })
        const undo = () => send(`${base}/${request.reimbursementId}/undo`, 'PUT')
        // nothing to undo yet
        assert.equal((await undo()).status, 409)
        assert.equal((await move('approved')).status, 200)
        assert.equal((await move('reimbursed')).status, 200)
        assert.equal(await prisma.transaction.count({ where: { reimbursementId: request.reimbursementId } }), 1)

        const back = await (await undo()).json()
        assert.equal(back.status, 'approved')
        assert.equal(await prisma.transaction.count({ where: { reimbursementId: request.reimbursementId } }), 0)

        assert.equal((await (await undo()).json()).status, 'pending')
        assert.equal((await undo()).status, 409)
    })
})
