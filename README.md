# Elemental Beauty

**Cosmetic Science & Formulation Club @ Purdue University**

[**Club BoilerLink**](https://boilerlink.purdue.edu/organization/httpsboilerlink_purdue_eduorganization_https)

## Overview

**Elemental Beauty** is a student-run **cosmetic science and formulation club** at Purdue University. We give students hands-on experience with the chemistry, business, and creative sides of the beauty industry — from **formulating skincare and cosmetic products** in lab-style workshops, to running the operational and technical infrastructure that keeps the organization running.

Our events pair formulation fundamentals with hands-on execution: **soap-making labs**, **UV body paint nights**, **seasonal contour palette labs**, and ongoing **formulation workshops** covering active ingredients, emulsions, and product stability. The club is also built and maintained end-to-end by its own members, including a custom internal software stack for **treasury management** and **member operations**.

## Table of Contents

- [Officers](#officers)
- [Tech Stack](#tech-stack)
- [Frontend](#frontend)
- [Backend](#backend)
- [Database Schema Highlights](#database-schema-highlights)
- [Roadmap](#roadmap)
- [Contact](#contact)

## Officers

| Name | Role |
|---|---|
| Catherine Chang | President, Co-Founder|
| Azu Nakao | Vice President, Co-Founder|
| Rachel Rafik | Software Developer, Designer, Co-Founder|
| Michelle Cheng | Treasurer |
| Aiden Tang | Formula Lead |
| Vaanathy Periyar | Formula Lead |

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML / TailwindCSS / NextJS |
| Backend | Express.js |
| ORM | Prisma 7 |
| Database | PostgreSQL |

## Frontend

The frontend is a **Next.js** application (built on **React 19** and **Tailwind CSS 4**) that serves as the club's full member and officer platform, not just a finance tool. It's organized into several pages:
 
**Public and account pages** cover the essentials: an **about-us** page, **login**, **account** management, and **password reset/verification** flows for members.
 
**Members** provides a directory and management view for club membership, while **dashboard** acts as the landing page after login, giving members and officers a home base for the platform.
 
**Events** and **labs** each have both a listing page and a dedicated **view** page for individual entries, letting members browse upcoming events or formulation labs and drill into details for a specific one.
 
**Finances** houses the **Treasurer Dashboard** — the tool officers use to manage club money day-to-day, with full **CRUD operations** on financial records, a **reimbursement approval and rejection workflow**, and **CSV export** for record-keeping and reporting.

## Backend

The backend is built on **Express** with **Prisma 7** as the ORM layer, sitting on top of a normalized **PostgreSQL** database. The schema uses **junction tables** to handle many-to-many relationships, and **role-based access control** governs permissions across member and officer levels. A **reimbursement approval trigger** automatically inserts approved reimbursements into a `Transactions` ledger, while a **deferred constraint trigger** enforces valid quiz answer options.

## Database Schema Highlights

The database is **fully normalized**, with junction tables handling many-to-many relationships rather than redundant data. **Ledger integrity** is enforced automatically through database triggers instead of application-layer workarounds, and **role-based permissioning** is built directly into the schema rather than left to the API layer alone.

## Roadmap

Next up for the club: a **public-facing website**, a **member self-service portal** for event RSVPs and dues tracking, a **formulation recipe and inventory tracker**, and **automated email notifications** for reimbursement status.

## Contact

Reach us by email at **elementalbeauty26@gmail.com**, or find us on Instagram [**@elementist_**](https://instagram.com/elementist_).
