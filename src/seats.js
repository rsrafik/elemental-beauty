// Seats taken and people waiting on every lab (or event), for the lists, the
// lab's and event's own pages and the calendar feed: one grouped count off
// the sign-up rows, kept (src/memo.js) until one of those rows is written —
// any write to member_lab / member_event clears it (KEPT in
// src/prismaClient.js). So a page that's polled, or a feed fetched by every
// subscriber's calendar, counts once per change rather than once per ask.
//
// The same split the routes count by: a seat is rsvped, attended or an open
// offer (TAKEN); waitlisted is queued behind them (WAITING).
import prisma from './prismaClient.js'
import { memo, SHARED_MS } from './memo.js'

const TAKEN = ['rsvped', 'attended', 'offered']
const KINDS = {
    lab: { link: 'memberLab', key: 'labId' },
    event: { link: 'memberEvent', key: 'eventId' }
}
const NONE = { taken: 0, waiting: 0 }

// kindName is 'lab' or 'event'. Answers with a function: id -> { taken, waiting }
export function seatCounts(kindName) {
    const kind = KINDS[kindName]
    return memo(`${kindName}s:counts`, SHARED_MS, async () => {
        const groups = await prisma[kind.link].groupBy({ by: [kind.key, 'attendanceStatus'], _count: true })
        const seats = new Map()
        for (const group of groups) {
            const at = seats.get(group[kind.key]) ?? { taken: 0, waiting: 0 }
            if (TAKEN.includes(group.attendanceStatus)) { at.taken += group._count }
            if (group.attendanceStatus === 'waitlisted') { at.waiting += group._count }
            seats.set(group[kind.key], at)
        }
        return (id) => seats.get(id) ?? NONE
    })
}

// Where one person stands on each lab (or event) they've anything to do with:
// a Map of id -> their sign-up row's `fields`. One small read of their own
// rows, in place of a join onto every row of a list.
export async function standings(kindName, memberId, fields) {
    const kind = KINDS[kindName]
    const rows = await prisma[kind.link].findMany({
        where: { memberId },
        select: { [kind.key]: true, ...Object.fromEntries(fields.map((field) => [field, true])) }
    })
    return new Map(rows.map((row) => [row[kind.key], row]))
}
