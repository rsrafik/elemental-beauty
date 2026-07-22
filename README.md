# Elemental Beauty

**Cosmetic Science & Formulation Club — Purdue University**

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
| Catherine Chang | President |
| Azu Nakao | Vice President |
| Rachel Rafik | Software Developer + Designer |
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

The club's core internal frontend is the **Treasurer Dashboard**, a purpose-built tool for managing club finances end-to-end. It handles full **CRUD operations** for financial records, a **reimbursement approval and rejection workflow** for member requests, and **CSV export** for record-keeping and reporting.

Additional frontend surfaces, like a public club site, member portal, or event sign-ups, can be documented here as they're built out.

## Backend

The backend is built on **Express** with **Prisma 7** as the ORM layer, sitting on top of a normalized **PostgreSQL** database. The schema uses **junction tables** to handle many-to-many relationships, and **role-based access control** governs permissions across member and officer levels. A **reimbursement approval trigger** automatically inserts approved reimbursements into a `Transactions` ledger, while a **deferred constraint trigger** enforces valid quiz answer options.

## Database Schema Highlights

The database is **fully normalized**, with junction tables handling many-to-many relationships rather than redundant data. **Ledger integrity** is enforced automatically through database triggers instead of application-layer workarounds, and **role-based permissioning** is built directly into the schema rather than left to the API layer alone.

## Roadmap

Next up for the club: a **public-facing website**, a **member self-service portal** for event RSVPs and dues tracking, a **formulation recipe and inventory tracker**, and **automated email notifications** for reimbursement status.

## Contact

Reach us by email at **elementalbeauty26@gmail.com**, or find us on Instagram [**@elementist_**](https://instagram.com/elementist_).
