// Development seed. Wipes what's there and lays down one account per role so
// every version of every page can be looked at without inventing data by hand:
//
//   user / user             an account with no membership — the onboarding
//                           dashboard, and no labs/events/calendar in the menu
//   member / member         the member dashboard, /labs, /events, /calendar
//   officer / officer       adds /students and /analytics (the read-only books)
//   jboard / jboard         everything an officer has — a rank only an admin
//                           can give
//   treasurer / treasurer   the same pages, with /analytics as the full ledger
//   admin / admin           outranks everyone; the only role that can change
//                           other people's roles or remove staff
//
// The password is the username in every case. This is a trial fixture and
// nothing here should ever be run against real data — it starts by deleting
// every row in the database. It refuses to run unless DATABASE_URL is on
// this machine (see scripts/localDatabase.js).
//
//   node --env-file=.env --experimental-strip-types prisma/seed.js
//
// The calendar tags are inserted by the migration rather than here, so they
// survive a reseed — officers edit that list from the page and it isn't
// fixture data.

import prisma from '../src/prismaClient.js'
import { readFile } from 'fs/promises'
import { LAB_DESCRIPTIONS } from './labDescriptions.js'
import { SOAP_BAR_CONTENT, SOAP_BAR_LESSON_FILE } from './soapBarContent.js'
import { hashPassword } from '../src/passwords.js'
import { refuseUnlessLocal } from '../scripts/localDatabase.js'

// before anything is deleted: only ever a database on this machine
refuseUnlessLocal('seed')

// One account per role. `role: null` is the one with no member row at all.
const ACCOUNTS = [
    { username: 'user', firstName: 'Uma', lastName: 'Newman', role: null, points: 0 },
    { username: 'member', firstName: 'Mina', lastName: 'Reyes', role: 'member', points: 155 },
    { username: 'officer', firstName: 'Ola', lastName: 'Harris', role: 'officer', points: 240 },
    { username: 'jboard', firstName: 'Jada', lastName: 'Brooks', role: 'jboard', points: 180 },
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
    await prisma.activityLog.deleteMany()
    await prisma.duesPayment.deleteMany()
    await prisma.transaction.deleteMany()
    await prisma.reimbursement.deleteMany()
    await prisma.grant.deleteMany()
    await prisma.yearTarget.deleteMany()
    await prisma.announcement.deleteMany()
    // questions, not their options first: options cascade with the question,
    // and deleting the options on their own leaves a question with no right
    // answer, which the deferred trigger refuses at commit
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
    const passwordHash = await hashPassword(username)

    const user = await prisma.user.create({
        data: {
            username,
            // example.com is reserved for exactly this and never delivers —
            // the dev server sends real mail when Gmail is set up in .env, and
            // the day-before reminders go out on their own, so a fixture
            // account must never be somebody's actual inbox
            email: `${username}@example.com`,
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

// [question, options, index of the right one]
const BRONZER_QUIZ = [
    ['What gives a pressed bronzer its warm brown colour?', ['Titanium dioxide', 'Iron oxides', 'Zinc stearate', 'Mica alone'], 1],
    ['Why is a binder added to the powder before pressing?', ['To add shimmer', 'To preserve it', 'To hold the pan together', 'To thin the colour'], 2],
    ['Which of these is a common slip agent in pressed powders?', ['Silica', 'Beeswax', 'Glycerin', 'Citric acid'], 0],
    ['What does mica mostly contribute to a bronzer?', ['Oil control', 'Shine and luminosity', 'Adhesion to skin', 'Fragrance'], 1],
    ['Why is zinc stearate used in powders?', ['It helps them adhere to skin', 'It is the main pigment', 'It is a preservative', 'It adds scent'], 0],
    ['What goes wrong if a powder is pressed too hard?', ['It crumbles', 'It gets hardpan and picks up poorly', 'It changes colour', 'It melts'], 1],
    ['What does sifting the blended powder help with?', ['Adding weight', 'Evening out colour and texture', 'Making it waterproof', 'Speeding up drying'], 1],
    ['Which tool presses the powder into the pan?', ['A spatula', 'A pipette', 'A pressing die or coin', 'A whisk'], 2],
    ['Why wear a mask while blending loose powders?', ['To avoid breathing in fine particles', 'To keep the powder warm', 'It is a cleanroom rule only', 'To stop static'], 0],
    ['How do you make a bronzer more matte?', ['Add more mica', 'Add less mica and more sericite or silica', 'Add glycerin', 'Press it harder'], 1]
]

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
            // passed, so it's the one that shows the full lab — materials,
            // lesson PDF and instructions all filled in
            {
                title: 'Soap Bar', date: day(-17), startTime: '17:00', location: 'WTHR 200', capacity: 20,
                ...SOAP_BAR_CONTENT,
                lessonPdf: await readFile(new URL(`./fixtures/${SOAP_BAR_LESSON_FILE}`, import.meta.url)),
                lessonPdfName: 'Lab 1 - Fragrance Soap Making.pdf'
            },
            { title: 'Bath Bomb', date: day(-10), startTime: '17:00', location: 'WTHR 200', capacity: 20 },
            { title: 'Bronzer', date: day(-1), startTime: '17:00', location: 'WTHR 200', capacity: 20 },
            // today — check-in is open on this one. Midnight rather than an
            // evening start, so the QR stage shows whenever the seed is run.
            { title: 'Lipstick', date: day(0), startTime: '00:00', location: 'WTHR 104', capacity: 20 },
            { title: 'Lip Gloss', date: day(6), startTime: '17:00', location: 'WTHR 200', capacity: 20 },
            // full: seven extras hold the seats and three more are queued ahead
            // of the member, whose sign-up on it is a waitlist place
            { title: 'Blush', date: day(13), startTime: '18:00', location: 'BRWN 1151', capacity: 7 },
            { title: 'Body Butter', date: day(20), startTime: '17:00', location: 'WTHR 200', capacity: 15 },
            { title: 'Lip Scrub', date: day(27), startTime: '17:30', location: 'WTHR 200', capacity: 20 }
        ].map((lab) => ({ ...lab, description: LAB_DESCRIPTIONS[lab.title] }))
    })

    // Enough attendance on the member account that /account's counter isn't all
    // zeroes, and one lab in every stage of /labs/view:
    //
    //   Soap Bar, Bath Bomb  attended and passed — the unlocked lab
    //   Bronzer              attended, quiz not passed — the lab quiz
    //   Lipstick (today)     rsvp'd, started — the QR check-in
    //   Lip Gloss            rsvp'd — "you're registered!"
    //   Blush                full, member waitlisted — "you're waitlisted!"
    //   Body Butter          nothing — "sign up"
    //
    // plus one event done and two rsvp'd.
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

    const labNamed = (title) => [...doneLabs, ...comingLabs].find((lab) => lab.title === title).labId
    const extraIds = EXTRAS.map(({ username }) => byName[username].userId)

    await prisma.memberLab.createMany({
        data: [
            ...doneLabs.slice(0, 2).map((lab) => ({
                memberId, labId: lab.labId, attendanceStatus: 'attended', quizPassed: true
            })),
            { memberId, labId: labNamed('Bronzer'), attendanceStatus: 'attended' },
            { memberId, labId: labNamed('Lipstick'), attendanceStatus: 'rsvped' },
            { memberId, labId: labNamed('Lip Gloss'), attendanceStatus: 'rsvped' },
            ...extraIds.slice(0, 7).map((id) => ({
                memberId: id, labId: labNamed('Blush'), attendanceStatus: 'rsvped'
            })),
            // queued a minute apart, oldest first, so the member is 4 spots away
            ...extraIds.slice(7).map((id, i) => ({
                memberId: id, labId: labNamed('Blush'), attendanceStatus: 'waitlisted',
                waitlistedAt: new Date(Date.now() - (10 - i) * 60_000)
            })),
            { memberId, labId: labNamed('Blush'), attendanceStatus: 'waitlisted', waitlistedAt: new Date() }
        ]
    })

    // The Bronzer quiz — ten questions, one right answer each (the member view
    // takes one pick per question). Created per question in a transaction
    // because the deferred trigger wants a correct option in place by COMMIT.
    console.log('Quiz…')
    const bronzerId = labNamed('Bronzer')
    for (const [question, options, right] of BRONZER_QUIZ) {
        await prisma.$transaction(async (tx) => {
            const q = await tx.labQuizQuestion.create({ data: { labId: bronzerId, question } })
            await tx.quizAnswerOption.createMany({
                data: options.map((answerText, i) => ({
                    questionId: q.questionId, answerText, isCorrect: i === right
                }))
            })
        })
    }
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
