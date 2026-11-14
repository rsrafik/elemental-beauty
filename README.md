<div align="center">

<a href="https://elementalbeauty.org"><img src="frontend/public/logo.png" alt="Elemental Beauty flower logo" width="150"></a>

# elemental beauty

**Purdue's cosmetic science club. We make the things on your bathroom shelf, and learn *why* they work.**

<sub><i>Ingredients: Aqua (curiosity), Glycerin, Cetearyl Alcohol, Friends, Tocopherol, Good Lighting, Parfum.</i></sub>

<br>

[![CI](https://github.com/rsrafik/elemental-beauty/actions/workflows/ci.yml/badge.svg)](https://github.com/rsrafik/elemental-beauty/actions/workflows/ci.yml)
![Next.js 16](https://img.shields.io/badge/Next.js-16-FF8A78?logo=nextdotjs&logoColor=white&labelColor=B3402E)
![React 19](https://img.shields.io/badge/React-19-FFC2B8?logo=react&logoColor=white&labelColor=B3402E)
![Tailwind 4](https://img.shields.io/badge/Tailwind-4-FFEA75?logo=tailwindcss&logoColor=white&labelColor=AB9726)
![Express 5](https://img.shields.io/badge/Express-5-A7CC70?logo=express&logoColor=white&labelColor=48631D)
![Prisma 7](https://img.shields.io/badge/Prisma-7-B5CFFF?logo=prisma&logoColor=white&labelColor=4066FF)
![PostgreSQL 16](https://img.shields.io/badge/PostgreSQL-16-B5CFFF?logo=postgresql&logoColor=white&labelColor=4066FF)
![WebGL](https://img.shields.io/badge/WebGL-hand--written_shader-FFD9C9?logo=webgl&logoColor=white&labelColor=A83F13)

**[elementalbeauty.org](https://elementalbeauty.org)**  ·  [Instagram](https://instagram.com/elementist_)  ·  [Discord](https://discord.gg/G4Nmc9fsh3)  ·  [BoilerLink](https://boilerlink.purdue.edu/organization/httpsboilerlink_purdue_eduorganization_https)

</div>

<br>

> Elemental Beauty is a student-run cosmetic science and formulation club at Purdue University. Members learn the chemistry and the business of beauty products by making them: emulsions, actives, soaps, body paint, contour palettes. Club members designed and built this whole site, from the public landing page to the treasurer's ledger, and the club runs on it every day.

<br>

<table>
<tr><td colspan="2"><h3>&nbsp;Formula facts</h3><sub>&nbsp;per repository · batch no. <code>main</code></sub></td></tr>
<tr><td>Lines of code</td><td align="right">~64,000</td></tr>
<tr><td>Pages in the app</td><td align="right">24</td></tr>
<tr><td>API routers</td><td align="right">22</td></tr>
<tr><td>Database models</td><td align="right">27</td></tr>
<tr><td>Versioned migrations</td><td align="right">54</td></tr>
<tr><td>Postgres triggers that write to the ledger or check data</td><td align="right">5</td></tr>
<tr><td>Roles, ranked</td><td align="right">7</td></tr>
<tr><td>Background jobs that run every hour</td><td align="right">5</td></tr>
<tr><td>Tests, run on every push</td><td align="right">150+</td></tr>
<tr><td>3D or graphics libraries behind the hero's bubbles</td><td align="right">0</td></tr>
<tr><td colspan="2"><sub>Made in West Lafayette, Indiana. One Docker image. Shake well before use.</sub></td></tr>
</table>

<br>

## Contents

| | | |
|:--|:--|:--|
| Phase A · [The club](#phase-a--the-club) | Phase D · [The officer's bench](#phase-d--the-officers-bench) | [Stability testing](#stability-testing) |
| Phase B · [The landing page](#phase-b--the-landing-page) | Phase E · [The books](#phase-e--the-books) | [Directions for use](#directions-for-use) |
| Phase C · [The member's experience](#phase-c--the-members-experience) | [Under the microscope](#under-the-microscope) | [Fill and finish](#fill-and-finish) |

## Phase A · The club

The club runs formulation labs on active ingredients, emulsions and product stability. Each lab has a lesson, a materials list, step-by-step instructions and a short quiz. There are also one-off workshops (soap making, UV body paint, a contour palette lab each season) and socials that get members and officers together outside the lab.

| Officer | Role |
|---|---|
| Catherine Chang | President, Co-Founder |
| Azu Nakao | Vice President, Co-Founder |
| Rachel Rafik | Software Designer & Engineer, Social Media Manager, Co-Founder |
| Michelle Cheng | Treasurer |
| Aiden Tang | Formula Lead |
| Vaanathy Periyar | Formula Lead |

## Phase B · The landing page

The public site at [elementalbeauty.org](https://elementalbeauty.org) is designed around the emulsion: getting oil and water to hold together, which most of cosmetic chemistry depends on. The page is laid out like a formula sheet. Its sections are phases, and the small print reads like the back of a bottle.

<table>
<tr>
<td width="50%" valign="top">

#### Soap bubbles, by hand
The bubbles behind the hero are one WebGL fragment shader, written from scratch without three.js or any meshes. Each bubble is a metaball that adds r²/d² to a field, so when two meet they neck together like real liquid. The colour comes from a model of thin-film interference. The shader tracks how thick the film is at every point, and that thickness becomes the pink, blue and green bands you see on a real soap bubble, packed tighter towards the rim. Each bubble also bends the wordmark behind it like a lens. The shader is a few kilobytes.

</td>
<td width="50%" valign="top">

#### Swatches, a deck and a rail
- "What we do" is four swatches. Each row's name is set very large, and a smear of pigment is swiped across it when the row reaches the middle of the window.
- The album is a fanned deck of cards, one per event. When you pull a card, it lifts out of the fan and grows into a close-up over the deck.
- The team sits on two looping rails that drift in opposite directions and get pushed along as you scroll. Hover over someone's title and it changes to their name, fitted into the same width.
- Sponsors scroll past in two bands going opposite ways. A small glass-bead cursor tells you what a click will do.

</td>
</tr>
<tr>
<td valign="top">

#### It works without the scripts
Every section's content is in the HTML before any script runs. The animation (GSAP) and the shader load separately, and the page still reads fine if either one fails. With `prefers-reduced-motion` turned on, the animation is off.

</td>
<td valign="top">

#### Admins keep it up to date
Admins edit the people, the album and the sponsor pills on `/landing-editor`. They can drag cards into order, and the image cropper saves each picture already cut to the shape of its frame. Companies can send a "sponsor a batch" request from the page. The form is rate-limited, and requests land in the admin's sponsor list, where each one moves from pending to contacting to active, or to the archive. Only active sponsors get a pill on the page.

</td>
</tr>
</table>

## Phase C · The member's experience

- The Elementist Pass is a membership card on the dashboard. Click it and it flips over to show the member's check-in QR code, which the server signs and never stores.
- To join, you sign up, verify your email, then read and sign the club waiver. The signature fields unlock once you've scrolled to the end.
- For a lab, you browse the list, RSVP or join the waitlist, confirm your spot, download the prelab PDF, and then work through the lesson, materials, instructions and quiz.
- When a seat opens up, the next person on the waitlist gets an email with an Accept button, and the seat is held for them. If they don't answer within 48 hours, the offer goes to the next person.
- Members can pay ahead by Venmo or Zelle and upload a screenshot for the treasurer to approve. Paying the year's dues makes you a VIP.
- The club calendar can be added to Google, Apple or Outlook as a live feed, and you pick which tracks it shows. The iCalendar file (RFC 5545) is written by hand, and an edited event moves in your calendar rather than appearing twice.
- After a lab or event, or earlier if an officer releases it, there's a feedback form. Everyone gets one entry, and the first time you send it you earn a point.
- On `/account` you can click any number to see which labs you went to and where each point came from.
- Members choose which club emails they get.

<details>
<summary><b>Points table</b></summary>
<br>

Attendance points are given automatically at check-in. Officers can't award attendance by hand, so it can't be counted twice.

| Action | Points | How |
|---|:-:|---|
| Attend a lab | 8 | Automatically at check-in |
| Attend an official event | 5 | Automatically at check-in |
| Become VIP by paying the year's dues | 4 | Automatically, once per year, and taken back if the payment is |
| Attend a social event | 3 | Automatically at check-in |
| Follow on Instagram | 2 | By an officer, once ever |
| Join the Discord | 2 | By an officer, once ever |
| Repost on Instagram | 1 | By an officer |
| Send a feedback form | 1 | Automatically, once per lab or event |

</details>

## Phase D · The officer's bench

- Officers write a lab's lesson, materials, instructions and quiz, attach a lesson PDF, and set its capacity, time and location. Labs and events can be saved as drafts, which show up in purple on the staff calendar.
- At the door, officers scan QR codes with their phone camera. They can take dues or the non-member price on the spot, rent out goggles, move people off the waitlist, and ask people to confirm their spot by a deadline. The roster updates on every officer's phone as people check in (how it does that cheaply is under [Under the microscope](#under-the-microscope)).
- Buttons send "email all", "email unpaid" and confirmation emails, and each one shows when it last went out so nobody sends it twice.
- The student roster is where officers add and remove members, change roles, award points and email the whole club.
- The activity log records who changed someone's role, points, membership or dues, and when.
- Every check-in page exports its attendance as a CSV.
- If you try to leave a page with unsaved edits, whether by a link, the back button or logging out, the site asks before throwing them away.

<details>
<summary><b>Roles and access</b></summary>
<br>

Roles are ranked, and each one can do everything the role below it can. The API checks the role on every request, so hiding a button in the UI is never the only protection. Events someone isn't allowed to see are never sent to their browser.

| Role | Access |
|---|---|
| Member / VIP | Labs, events, the calendar, their own account and points. A member becomes VIP when this year's dues are paid and goes back to member when they lapse. |
| Officer | Lab and event management, check-in, the roster, the activity log, reimbursement requests |
| J-Board | Everything an officer has, plus j-board-only events. The j-board treasury team can also read the books and edit grants and sponsorships. |
| Treasurer | The Treasurer Dashboard: the ledger, dues, grants, and approving reimbursements and payments |
| Admin | Everything, including giving out staff roles, the landing editor and sponsors |
| Advisor | Can see everything an admin sees and can't change anything. The auth middleware refuses their writes before any route runs, so new routes are read-only for them without extra work. |

</details>

## Phase E · The books

The treasurer works from the Treasurer Dashboard. It has:

- a ledger of income and expenses, with categories the treasurer can edit and a CSV export
- reimbursements: officers submit receipts, and each one goes from pending to approved to reimbursed (or denied), with an email at each step
- member payments with a due date of 11:59 PM club time, one week before the lab. Anyone overdue is moved to the waitlist, but only when the lab is full and someone is waiting for the seat.
- dues for each school year, including waived years
- grants, from the draft through review to the amount actually awarded
- yearly targets, and income and spending broken down by category

Officers see the same numbers on a read-only analytics page, along with their own receipts and where each one stands.

## Under the microscope

```mermaid
flowchart LR
    subgraph Browser
        A["Next.js 16 static export<br/>React 19 · Tailwind 4 · GSAP<br/>WebGL shader · pdf.js · jsQR"]
    end
    subgraph Server["One Docker image"]
        B["Express 5 API<br/>JWT · role ranks · rate limits"]
        C["Hourly jobs<br/>reminders · sweeps · offers · payments · VIP"]
        M["In-memory caches<br/>cleared on write"]
    end
    D[("PostgreSQL 16<br/>triggers + constraints")]
    E["Resend / Gmail"]
    G["Google · Apple · Outlook"]

    A -- JSON --> B
    B --- M
    B -- Prisma 7 --> D
    C --> D
    B --> E
    C --> E
    G -- iCal feed --> B
```

### The database keeps the books

When a reimbursement is marked reimbursed, a Postgres trigger writes the matching row to the ledger, so the ledger always agrees with the receipts. Grants work the same way: awarding one books it as income, editing the grant updates that row, and un-awarding it removes the row.

A deferred constraint trigger makes sure every quiz question has a correct answer. It runs when the transaction commits, so a question and its answer options can be saved together.

All schema changes are versioned Prisma migrations, 54 so far, with backfills where existing data needed them.

### Keeping the database bill small

The club's Postgres host charges for the data the database sends back, so the server tries not to ask for the same thing twice.

- Check-in pages poll a version number instead of the roster. Every write to a lab's or event's sign-ups bumps an in-memory counter (the Prisma client does this itself, so no route can forget), and a phone reloads the roster only when the number has changed.
- Data that almost every page needs, like who's signed in, dues amounts, calendar tags and seat counts, is kept in memory. The same Prisma hook clears it on any write, so it never goes stale, and two requests that arrive together share one database read.
- Pictures are stored in the database but served from their own URL, `/api/img/:kind/:id/:key`, where the key is a short hash of the image. A list of fifty labs comes back in a few kilobytes, and the browser caches each cover after the first time it loads.

### Other details

- Labs are entered in West Lafayette time, but the server runs on UTC. All times go through one timezone module that handles daylight saving, and setting `CLUB_TZ` moves it to another timezone.
- Five jobs run when the server starts and then every hour: day-before reminders, marking no-shows absent, passing on expired waitlist offers, enforcing payment due dates, and updating VIP status when a new school year starts.
- The server refuses to start without its secrets. In production each secret has to be at least 32 characters, and the two can't match. Passwords are hashed with bcrypt. The auth routes and the public sponsor form are rate-limited per IP. Check-in QR codes are signed with a separate secret, and seed accounts use `@example.com` addresses so a dev server can't email a real person.

```
elemental-beauty/
├── frontend/          Next.js app: pages in app/, UI in components/ (landing/ is the public site)
├── src/               Express API, email, points, dues, payments, offers, calendar feed, jobs
│   ├── routes/        One router per resource
│   └── middleware/    Auth, role ranks, the advisor's read-only rule, the treasury team
├── prisma/            Schema, migrations, seed data
├── scripts/           Local database setup, make-admin, Gmail token
└── test/              Unit and integration tests
```

## Stability testing

There are 150+ tests, written for Node's built-in test runner. They cover offers, payments, money, events, calendar feeds, feedback, the landing page and sponsors, and the integration tests run against a real Postgres database. On every push, [CI](.github/workflows/ci.yml) starts a fresh database, applies every migration, runs the tests, and then lints and builds the frontend.

```bash
docker exec elemental-db psql -U postgres -c "create database elemental_test"
cp .env.test.example .env.test
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/elemental_test npx prisma migrate deploy
npm test
```

The integration tests won't run unless the database name contains `test`.

## Directions for use

You need Node 22 or newer and Docker.

```bash
npm install && npm install --prefix frontend
npm run dev:all          # Postgres in Docker, the API on :5003, Next on :3000
npm run db:reset         # wipe and reseed (accounts: member/member, officer/officer, … see prisma/seed.js)
```

Emails print to the console unless Gmail or Resend is set up in `.env`.

## Fill and finish

The `Dockerfile` builds one image that serves both the API and the static frontend. Copy [`.env.production.example`](.env.production.example) to `.env.production` and fill it in. The example file explains each variable.

On a fresh production database there's no admin yet to hand out roles, so create the first one from the command line:

```bash
npm run make-admin -- jane7@purdue.edu Jane Doe
```

This creates a verified admin with the username `jane7` and prints a one-time password. If that email already has an account, the account is made admin instead. Inside Docker, run `docker exec -it <container> npm run make-admin -- ...`.

## Coming soon

A recipe and inventory tracker for lab supplies and tested formulas.

## Contact the lab

| | |
|---|---|
| Website | [elementalbeauty.org](https://elementalbeauty.org) |
| General questions | elementalbeauty26@gmail.com |
| Sponsors and guest speakers | ebpurdue@purdue.edu |
| Instagram | [@elementist_](https://instagram.com/elementist_) |
| Discord | [Join the server](https://discord.gg/G4Nmc9fsh3) |
| BoilerLink | [Elemental Beauty](https://boilerlink.purdue.edu/organization/httpsboilerlink_purdue_eduorganization_https) |

<br>

<div align="center">
<img src="frontend/public/logo.png" alt="" width="48">
<br>
<sub>Built by and for the members of Elemental Beauty at Purdue University.</sub>
<br>
<sub><i>For external use only. Keep away from merge conflicts. If irritation occurs, open an issue.</i></sub>
</div>
