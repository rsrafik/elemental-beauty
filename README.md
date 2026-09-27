<div align="center">

# Elemental Beauty

### Cosmetic Science & Formulation Club at Purdue University

**[elementalbeauty.org](https://elementalbeauty.org)**

[![CI](https://github.com/rsrafik/elemental-beauty/actions/workflows/ci.yml/badge.svg)](https://github.com/rsrafik/elemental-beauty/actions/workflows/ci.yml)
![Next.js](https://img.shields.io/badge/Next.js_16-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React_19-20232A?logo=react&logoColor=61DAFB)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_4-0F172A?logo=tailwindcss&logoColor=38BDF8)
![Express](https://img.shields.io/badge/Express_5-000000?logo=express&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma_7-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)

[Website](https://elementalbeauty.org) · [BoilerLink](https://boilerlink.purdue.edu/organization/httpsboilerlink_purdue_eduorganization_https) · [Instagram](https://instagram.com/elementist_) · [Discord](https://discord.gg/G4Nmc9fsh3)

</div>

---

## About the club

**Elemental Beauty** is a student-run cosmetic science and formulation club at Purdue. Members get hands-on experience with the chemistry, business and creative sides of the beauty industry, from formulating skincare and cosmetics in lab-style workshops to running the club itself.

What we do:

- **Formulation labs** on active ingredients, emulsions and product stability, each with a lesson, a materials list, step-by-step instructions and a short quiz
- **Hands-on workshops** like soap-making labs, UV body paint nights and seasonal contour palette labs
- **Socials and board events** that bring members and officers together outside the lab

The club's software is built and run by its own members. **[elementalbeauty.org](https://elementalbeauty.org)** is where members sign up for labs, check in at the door with a QR code, track their points, and where officers run events, the roster and the treasury.

## Officers

| Name | Role |
|---|---|
| Catherine Chang | President, Co-Founder |
| Azu Nakao | Vice President, Co-Founder |
| Rachel Rafik | Software Developer, Designer, Co-Founder |
| Michelle Cheng | Treasurer |
| Aiden Tang | Formula Lead |
| Vaanathy Periyar | Formula Lead |

---

## Table of contents

- [The platform](#the-platform)
  - [For members](#for-members)
  - [For officers](#for-officers)
  - [For the treasurer](#for-the-treasurer)
  - [Automatic emails and jobs](#automatic-emails-and-jobs)
- [Points](#points)
- [Roles and access](#roles-and-access)
- [Architecture](#architecture)
- [Database design](#database-design)
- [Security](#security)
- [Development](#development)
- [Deployment](#deployment)
- [Roadmap](#roadmap)
- [Contact](#contact)

---

## The platform

### For members

- **Elementist Pass.** A digital membership card on the dashboard that flips over to show the member's personal check-in QR code.
- **Onboarding.** Sign up, verify your email, then read and sign the club waiver. The signature fields stay locked until you've scrolled to the end of the document.
- **Labs.** Browse upcoming labs, RSVP or join the waitlist, confirm your spot, download the prelab PDF, then work through the lesson, materials, instructions and quiz.
- **Events and calendar.** A calendar of socials, official events and online meetups, color-coded by who each one is for.
- **Waitlist offers.** When a seat opens up, the next person on the waitlist gets an email with an "Accept" button, and the seat is held for them while they decide.
- **Account and history.** On `/account`, every number is clickable: which labs and events you attended, and where each of your points came from.
- **Email preferences.** Members choose which club emails they get.

### For officers

- **Lab editor.** Write a lab's lesson, materials, instructions and quiz, attach a lesson PDF, set capacity, time and location, and save drafts before publishing.
- **Door check-in.** Scan members' QR codes with a phone camera. Officers can take dues at the door, move people off the waitlist, and send confirmation requests with a deadline.
- **Attendance export.** Every lab and event's check-in page exports its attendance as a CSV.
- **Student roster.** Add and remove members, change roles, award points by hand for Instagram and Discord, and email the whole club.
- **Activity log.** A record of who changed what, and when.
- **Finances at a glance.** A read-only view of the club's balance, income, spending and grants, plus a place to submit receipts and track your own reimbursements.

### For the treasurer

The **Treasurer Dashboard** is where the club's money is managed day to day:

- A full **ledger** of income and expenses, with create, edit and delete, and **CSV export** for records and reporting
- A **reimbursement workflow**: officers submit receipts, and each one moves from *pending* to *approved* to *reimbursed* (or *denied*), with an email at every step
- **Dues tracking** per school year, including waived years
- **Grant tracking** from drafting through review to what was actually awarded
- **Yearly targets**, plus income and expense breakdowns by category

### Automatic emails and jobs

Mail goes out through Resend or Gmail. The server also runs a few scheduled jobs:

| Job | What it does |
|---|---|
| Day-before reminders | Emails everyone signed up for tomorrow's labs and events |
| Absence sweep | Once a day has ended, marks anyone still RSVP'd as absent |
| Offer expiry | An offer that goes 48 hours without an answer passes to the next person on the waitlist |
| Reimbursement updates | Tells the treasurer when a receipt comes in, and the officer when it's approved, denied or paid |

## Points

Members earn points for taking part. Attendance points are awarded automatically at check-in, so they can never be given twice by hand.

| Action | Points | How it's awarded |
|---|:-:|---|
| Attend a lab | **8** | Automatically at check-in |
| Attend an official event | **5** | Automatically at check-in |
| Attend a social event | **3** | Automatically at check-in |
| Follow on Instagram | **2** | By an officer |
| Join the Discord | **2** | By an officer |
| Repost on Instagram | **1** | By an officer |

## Roles and access

Permissions are ranked, and each role has everything the one before it has.

| Role | Access |
|---|---|
| **Member** | Labs, events, calendar, their own account and points |
| **Officer** | Lab and event management, check-in, roster, activity log, reimbursement requests |
| **J-Board** | Everything an officer has, plus j-board-only events |
| **Treasurer** | The Treasurer Dashboard: ledger, dues, grants, reimbursement approvals |
| **Admin** | Everything, including handing out staff roles |

Events are tagged with who they're for (members, officers, open, online, board, j-board). The API decides which ones each person can see, so hidden events are never sent to the browser in the first place.

---

## Architecture

```mermaid
flowchart LR
    subgraph Browser
        A[Next.js 16 static app<br/>React 19 · Tailwind 4]
    end
    subgraph Server["Single Docker image"]
        B[Express 5 API]
        C[Scheduled jobs<br/>reminders · sweeps · offers]
    end
    D[(PostgreSQL<br/>triggers + constraints)]
    E[Resend / Gmail]

    A -- JWT --> B
    B -- Prisma 7 --> D
    C --> D
    B --> E
    C --> E
```

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (static export), React 19, Tailwind CSS 4, GSAP, pdf.js, jsQR |
| Backend | Node 22, Express 5, JSON Web Tokens, bcrypt, express-rate-limit |
| Database | PostgreSQL 16 with Prisma 7 |
| Email | Resend or Gmail (Nodemailer) |
| Infrastructure | Docker, GitHub Actions CI |

The frontend is built as static files and served by the same Express server as the API, so the whole site ships as one Docker image.

```
elemental-beauty/
├── frontend/          Next.js app (pages in app/, UI in components/)
├── src/               Express API, email, points, dues, scheduled jobs
│   ├── routes/        One router per resource
│   └── middleware/    Auth and role checks
├── prisma/            Schema, migrations, seed data
├── scripts/           Local database setup, make-admin
└── test/              Unit and integration tests
```

## Database design

- **Normalized schema.** Junction tables (`MemberLab`, `MemberEvent`) handle many-to-many relationships and hold each person's attendance status for each lab and event.
- **Ledger integrity in the database.** When a reimbursement is marked *reimbursed*, a Postgres trigger writes the matching row to the `Transactions` ledger, so the books can't drift from the reimbursement records.
- **Quiz validity.** A deferred constraint trigger requires every quiz question to have a correct answer, checked at commit time so a question and its options can be saved together.
- **Tracked migrations.** Every schema change is a versioned Prisma migration.

## Security

- The server **won't start** without its secrets. In production each secret must be at least 32 characters, and the two secrets must differ from each other.
- Passwords are hashed with **bcrypt**, and the auth endpoints are **rate-limited** per IP.
- Check-in QR codes are **signed** with their own secret, so they can't be forged.
- **Role checks run on the API**, not only in the UI.
- Seed accounts use `@example.com` addresses, so a dev server can't email a real inbox.

---

## Development

**Requirements:** Node 22+ and Docker.

```bash
npm install && npm install --prefix frontend
npm run dev:all          # Postgres in Docker, the API on :5003, Next on :3000
npm run db:reset         # wipe and reseed (accounts: member/member, officer/officer, … — see prisma/seed.js)
```

Emails are printed to the console unless Gmail or Resend is configured in `.env`.

### Tests

Tests use Node's built-in test runner. The integration tests need their own database, and its name must contain `test`:

```bash
docker exec elemental-db psql -U postgres -c "create database elemental_test"
cp .env.test.example .env.test
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/elemental_test npx prisma migrate deploy
npm test
```

On every push, [CI](.github/workflows/ci.yml) runs the tests against a fresh Postgres, then lints and builds the frontend.

## Deployment

The `Dockerfile` builds one image that serves both the API and the static frontend at **[elementalbeauty.org](https://elementalbeauty.org)**. Copy [`.env.production.example`](.env.production.example) to `.env.production` and fill it in (it explains each variable).

**The first admin.** On a fresh production database nobody can hand out roles yet, so create the first admin from the command line:

```bash
npm run make-admin -- jane7@purdue.edu Jane Doe
```

This creates a verified admin account with the username `jane7` and prints a one-time password. If the email already has an account, that account is made admin instead. Inside Docker, run `docker exec -it <container> npm run make-admin -- ...`.

## Roadmap

- A **formulation recipe and inventory tracker** for lab supplies and tested formulas

## Contact

- **Website:** [elementalbeauty.org](https://elementalbeauty.org)
- **Email:** elementalbeauty26@gmail.com
- **Instagram:** [@elementist_](https://instagram.com/elementist_)
- **Discord:** [Join the server](https://discord.gg/G4Nmc9fsh3)
- **BoilerLink:** [Elemental Beauty](https://boilerlink.purdue.edu/organization/httpsboilerlink_purdue_eduorganization_https)

<div align="center">
<sub>Built by and for the members of Elemental Beauty at Purdue University.</sub>
</div>
