// Development seed. Wipes what's there and lays down one account per role so
// every version of every page can be looked at without inventing data by hand:
//
//   user / user             an account with no membership — the onboarding
//                           dashboard, and no labs/events/calendar in the menu
//   member / member         the member dashboard, /labs, /events, /calendar
//   officer / officer       adds /students and /analytics (the read-only books)
//   treasurer / treasurer   the same pages, with /analytics as the full ledger
//   admin / admin           outranks everyone; the only role that can change
//                           other people's roles or remove staff
//
// The password is the username in every case. This is a trial fixture and
// nothing here should ever be run against real data — it starts by deleting
// every row in the database.
//
//   node --env-file=.env --experimental-strip-types prisma/seed.js
//
// The calendar tags are inserted by the migration rather than here, so they
// survive a reseed — officers edit that list from the page and it isn't
// fixture data.

import bcrypt from 'bcryptjs'
import prisma from '../src/prismaClient.js'

// One account per role. `role: null` is the one with no member row at all.
const ACCOUNTS = [
    { username: 'user', firstName: 'Uma', lastName: 'Newman', role: null, points: 0 },
    { username: 'member', firstName: 'Mina', lastName: 'Reyes', role: 'member', points: 155 },
    { username: 'officer', firstName: 'Ola', lastName: 'Harris', role: 'officer', points: 240 },
    { username: 'treasurer', firstName: 'Tess', lastName: 'Nelson', role: 'treasurer', points: 130 },
    { username: 'admin', firstName: 'Ada', lastName: 'White', role: 'admin', points: 310 }
]

// Enough other members that the leaderboard, the rank rail on /account and the
// roster's pager all have something to work with.
const EXTRAS = [
    { username: 'lauren7712', firstName: 'Lauren', lastName: 'Martin', role: 'officer', points: 205 },
    { username: 'priya9021', firstName: 'Priya', lastName: 'Anand', role: 'member', points: 115 },
    { username: 'vera8888', firstName: 'Vera', lastName: 'Cooper', role: 'member', points: 90 },
    { username: 'sofia6602', firstName: 'Sofia', lastName: 'Reyes', role: 'member', points: 75 },
    { username: 'milton2244', firstName: 'Milton', lastName: 'Smith', role: 'member', points: 65 },
    { username: 'hana4429', firstName: 'Hana', lastName: 'Yamada', role: 'member', points: 50 },
    { username: 'daisy22', firstName: 'Daisy', lastName: 'Scott', role: 'member', points: 40 },
    { username: 'dan87675', firstName: 'Dan', lastName: 'Thomas', role: 'member', points: 25 },
    { username: 'grace3310', firstName: 'Grace', lastName: 'Kim', role: 'member', points: 15 },
    { username: 'brian5564', firstName: 'Brian', lastName: 'Miller', role: 'member', points: 0 }
]

// Order matters: children before parents, so nothing trips a foreign key.
// `users` is last and takes members / member_lab / member_event with it.
async function wipe() {
    await prisma.transaction.deleteMany()
    await prisma.reimbursement.deleteMany()
    await prisma.grant.deleteMany()
    await prisma.yearTarget.deleteMany()
    await prisma.announcement.deleteMany()
    await prisma.quizAnswerOption.deleteMany()
    await prisma.labQuizQuestion.deleteMany()
    await prisma.labLesson.deleteMany()
    await prisma.memberLab.deleteMany()
    await prisma.memberEvent.deleteMany()
    await prisma.lab.deleteMany()
    await prisma.event.deleteMany()
    await prisma.member.deleteMany()
    await prisma.user.deleteMany()
}

async function createAccount({ username, firstName, lastName, role, points }) {
    const passwordHash = await bcrypt.hash(username, 8)

    const user = await prisma.user.create({
        data: {
            username,
            email: `${username}@purdue.edu`,
            passwordHash,
            firstName,
            lastName,
            // Verification is switched off for now, so this is set at creation
            // rather than left for a flow that never runs — see authRoutes.
            emailVerified: true,
            // Only somebody who's joined has signed anything. The account with
            // no membership hasn't, which is exactly what leaves it at 'user'.
            waiverSigned: role !== null
        }
    })

    if (role) {
        await prisma.member.create({ data: { userId: user.userId, role, points } })
    }
    return user
}

// Dates are relative to the day the seed runs, never absolute. A fixture with
// hardcoded dates is only correct on the day it's written: come back a week
// later and the lab that was "today" is in the past, the icon that demonstrated
// check-in is a padlock, and nothing shows the state you seeded it to show.
//
// `day(0)` is today, `day(-7)` a week ago, `day(7)` a week out.
function day(offset) {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + offset)
    // the column is DATE, so send midnight UTC of that calendar day rather than
    // midnight local — otherwise a timezone west of UTC stores the day before
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
}

async function main() {
    console.log('Wiping…')
    await wipe()

    console.log('Accounts…')
    const byName = {}
    for (const account of [...ACCOUNTS, ...EXTRAS]) {
        byName[account.username] = await createAccount(account)
    }

    // ---- the calendar and the two listing pages --------------------------

    const categories = await prisma.eventCategory.findMany()
    const tag = (name) => categories.find((c) => c.name === name)?.categoryId ?? null

    console.log('Events…')
    await prisma.event.createMany({
        data: [
            // one that has already run, so "events done" has something behind it
            { title: 'Summer Send-Off', type: 'social', track: 'open', categoryId: tag('Social'), date: day(-13), startTime: '17:00', capacity: 40 },
            { title: 'Kickoff Mixer', type: 'social', track: 'open', categoryId: tag('Social'), date: day(-1), startTime: '18:00', capacity: 40 },
            // today
            { title: 'First Meeting', type: 'official', track: 'members', categoryId: tag('GBM'), date: day(0), startTime: '17:00', capacity: null },
            { title: 'Vendor Booth', type: 'social', track: 'open', categoryId: tag('Pop-Up'), date: day(5), startTime: '11:00', capacity: 20 },
            { title: 'Skincare 101', type: 'official', track: 'online', categoryId: tag('Workshop'), date: day(9), startTime: '19:00', capacity: null },
            { title: 'Fall Formal', type: 'social', track: 'members', categoryId: tag('Social'), date: day(12), startTime: '20:00', capacity: 20 },
            { title: 'Volunteer Day', type: 'official', track: 'open', categoryId: tag('Volunteering'), date: day(19), startTime: '09:00', capacity: 20 },
            { title: 'Bake Sale', type: 'social', track: 'open', categoryId: tag('Fundraiser'), date: day(26), startTime: '12:00', capacity: 15 },
            // officers-only: this is the row that proves the track filter works
            // — it must not come back on a member's GET /api/events
            { title: 'Officer Sync', type: 'official', track: 'officers', categoryId: tag('GBM'), date: day(16), startTime: '16:00', capacity: null },
            { title: 'Dues Due', type: 'official', track: 'online', categoryId: tag('Deadline'), date: day(30), startTime: null, capacity: null }
        ]
    })

    console.log('Labs…')
    await prisma.lab.createMany({
        data: [
            // Between them these cover every state a "current" card can be in:
            // two past ones the member attended (green unlock), one past one they
            // didn't (red lock), and one running today (the check-in calendar).
            { title: 'Soap Bar', date: day(-17), capacity: 20, description: 'Cold process basics.' },
            { title: 'Bath Bomb', date: day(-10), capacity: 20, description: 'Citric acid and bicarb ratios.' },
            { title: 'Bronzer', date: day(-1), capacity: 20, description: 'Pressed powder bronzer from scratch.' },
            // today — check-in is open on this one
            { title: 'Lipstick', date: day(0), capacity: 20, description: 'Wax, oil and pigment ratios.' },
            { title: 'Lip Gloss', date: day(6), capacity: 20, description: 'Base, pigment and finish.' },
            { title: 'Blush', date: day(13), capacity: 20, description: 'Cream vs powder.' },
            { title: 'Body Butter', date: day(20), capacity: 15, description: 'Emulsions and whipping.' },
            { title: 'Lip Scrub', date: day(27), capacity: 20, description: 'Sugar, oil and flavour.' }
        ]
    })

    // Enough attendance on the member account that /account's counter isn't all
    // zeroes: two labs done, one rsvp'd; one event done, two rsvp'd.
    //
    // Attendance goes ONLY on rows that have already happened, and RSVPs only on
    // ones that haven't. A future lab marked 'attended' is not just untidy — the
    // API refuses to un-RSVP something you're checked in to, so the card would
    // offer a toggle that can never work.
    const past = { lt: new Date() }
    const ahead = { gte: new Date() }

    const [doneLabs, comingLabs] = await Promise.all([
        prisma.lab.findMany({ where: { date: past }, orderBy: { date: 'asc' } }),
        prisma.lab.findMany({ where: { date: ahead }, orderBy: { date: 'asc' } })
    ])
    const [doneEvents, comingEvents] = await Promise.all([
        prisma.event.findMany({ where: { date: past }, orderBy: { date: 'asc' } }),
        prisma.event.findMany({ where: { date: ahead, track: { not: 'officers' } }, orderBy: { date: 'asc' } })
    ])
    const memberId = byName.member.userId

    await prisma.memberLab.createMany({
        data: [
            ...doneLabs.slice(0, 2).map((lab) => ({
                memberId, labId: lab.labId, attendanceStatus: 'attended', quizPassed: true
            })),
            ...comingLabs.slice(0, 1).map((lab) => ({
                memberId, labId: lab.labId, attendanceStatus: 'rsvped'
            }))
        ]
    })
    await prisma.memberEvent.createMany({
        data: [
            ...doneEvents.slice(0, 1).map((event) => ({
                memberId, eventId: event.eventId, attendanceStatus: 'attended'
            })),
            ...comingEvents.slice(0, 2).map((event) => ({
                memberId, eventId: event.eventId, attendanceStatus: 'rsvped'
            }))
        ]
    })

    // ---- announcements ----------------------------------------------------

    console.log('Announcements…')
    await prisma.announcement.create({
        data: { body: 'Welcome to Elemental Beauty!', authorId: byName.officer.userId }
    })

    // ---- the books --------------------------------------------------------

    console.log('Finances…')
    await prisma.yearTarget.createMany({
        data: [
            { schoolYear: '2025–26', incomeGoal: 10000, expenseBudget: 9500 },
            { schoolYear: '2024–25', incomeGoal: 6000, expenseBudget: 6000 }
        ]
    })

    await prisma.grant.createMany({
        data: [
            { name: 'Student Org Fund', org: 'Student Government', amountRequested: 1500, status: 'awarded', deadline: new Date('2025-09-01'), dateGranted: new Date('2025-09-22') },
            { name: 'STEM Outreach Mini-Grant', org: 'College of Sciences', amountRequested: 1200, status: 'awarded', deadline: new Date('2026-01-15'), dateGranted: new Date('2026-01-28') },
            { name: 'Wellness Programming', org: 'Health Center', amountRequested: 900, status: 'denied', deadline: new Date('2026-04-20') },
            { name: 'Beauty Industry Fund', org: 'Glow Foundation', amountRequested: 2000, status: 'under_review', deadline: new Date('2026-09-12') },
            { name: 'Sustainability Micro-Grant', org: 'Green Campus', amountRequested: 650, status: 'drafting', deadline: new Date('2026-10-05') }
        ]
    })

    await prisma.transaction.createMany({
        data: [
            { type: 'income', source: 'Fall dues — first wave', amount: 690, category: 'dues', date: new Date('2025-08-25') },
            { type: 'income', source: 'Student Org Fund award', amount: 1500, category: 'grants', date: new Date('2025-09-22') },
            { type: 'income', source: 'Glow Bar sponsorship', amount: 600, category: 'sponsors', date: new Date('2025-10-08') },
            { type: 'income', source: 'Bake sale', amount: 385.5, category: 'fundraisers', date: new Date('2025-10-27') },
            { type: 'income', source: 'Spring dues — first wave', amount: 810, category: 'dues', date: new Date('2026-01-20') },
            { type: 'income', source: 'STEM Outreach Mini-Grant', amount: 1200, category: 'grants', date: new Date('2026-01-28') },
            { type: 'expense', source: 'Welcome social — food', amount: 318, category: 'events', date: new Date('2025-08-28') },
            { type: 'expense', source: 'Flyer printing', amount: 128.4, category: 'marketing', date: new Date('2025-09-04') },
            { type: 'expense', source: 'Bath bomb lab supplies', amount: 412.6, category: 'lab', date: new Date('2025-09-18') },
            { type: 'expense', source: 'Guest esthetician honorarium', amount: 350, category: 'guests', date: new Date('2025-11-06') },
            { type: 'expense', source: 'Bronzer lab mica set', amount: 489.9, category: 'lab', date: new Date('2026-01-27') },
            { type: 'expense', source: 'Tabling banner', amount: 210, category: 'marketing', date: new Date('2026-02-24') }
        ]
    })

    // One receipt in each state the queue can show, all on the officer account
    // so logging in as `officer` lands on a page with something to do.
    //
    // Nothing is created as 'reimbursed' here on purpose: that status is what
    // writes the ledger row, and it's a trigger on UPDATE — inserting straight
    // into it would leave a settled request with no expense behind it. The last
    // one is created approved and then moved, which is the real path.
    const officerId = byName.officer.userId

    await prisma.reimbursement.createMany({
        data: [
            { memberId: officerId, title: 'Lip gloss base + pigments', explanation: 'restock for the august lab', amountRequested: 86.4, category: 'lab', status: 'pending', date: new Date('2026-07-28') },
            { memberId: officerId, title: 'Lab goggles + gloves', explanation: 'safety kit for the bronzer lab', amountRequested: 52.3, category: 'lab', status: 'approved', date: new Date('2026-06-04') },
            { memberId: officerId, title: 'Mixing bowls', explanation: 'replacements after the scrub lab', amountRequested: 39.99, category: 'lab', status: 'denied', denialExplanation: 'There are six bowls in the supply closet — check there before buying more. If they were all cracked, say so and send it back.', date: new Date('2026-05-20') },
            { memberId: officerId, title: 'Body butter jars', explanation: 'jars for the body butter lab', amountRequested: 92.15, category: 'lab', status: 'approved', date: new Date('2026-05-08') }
        ]
    })

    const toSettle = await prisma.reimbursement.findFirst({ where: { title: 'Body butter jars' } })
    await prisma.reimbursement.update({
        where: { reimbursementId: toSettle.reimbursementId },
        data: { status: 'reimbursed' }
    })

    // ---- what you can log in as ------------------------------------------

    const payouts = await prisma.transaction.count({ where: { reimbursementId: { not: null } } })
    console.log(`\nDone. The reimburse trigger wrote ${payouts} payout row(s).\n`)
    console.log('Log in with (password = username):\n')
    for (const { username, role } of ACCOUNTS) {
        console.log(`  ${username.padEnd(10)} ${role ?? 'user (no membership)'}`)
    }
    console.log('')
}

main()
    .catch((err) => {
        console.error(err)
        process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
