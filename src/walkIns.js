import { startsAt } from './clubTime.js'

// A walk-in: someone whose QR code is scanned at the door of a lab or event
// they have no row on (never signed up, nor on the waitlist). They go straight
// in only when all three hold:
//
//   - check-in is open: from the start time, or earlier once an officer has
//     pressed "start check-in" (checkinOpen)
//   - there's a real seat free: under the capacity once everyone signed up,
//     checked in and holding an offer is counted (no capacity is unlimited)
//   - nobody's on the waitlist: the people already waiting are ahead of them
//
// Otherwise they're put at the back of the waitlist, the same place an online
// sign-up to a full one goes.

const KINDS = {
    lab: { link: 'memberLab', key: 'labId' },
    event: { link: 'memberEvent', key: 'eventId' }
}

// seats spoken for — an open offer holds one
const TAKEN = ['rsvped', 'attended', 'offered']

export function checkinIsOpen(parent, now = new Date()) {
    if (parent.checkinOpen) return true
    const start = startsAt(parent)
    return Boolean(start) && start.getTime() <= now.getTime()
}

// Whether a walk-in can go straight in to `parent` (its row, with capacity,
// checkinOpen, date and startTime). `db` is prisma or the caller's
// transaction — inside one, after lockParent, the answer holds until it ends.
export async function walkInRoom(db, kindName, parentId, parent) {
    if (!checkinIsOpen(parent)) return false
    const { link, key } = KINDS[kindName]
    const waiting = await db[link].count({ where: { [key]: parentId, attendanceStatus: 'waitlisted' } })
    if (waiting > 0) return false
    if (parent.capacity == null) return true
    const taken = await db[link].count({ where: { [key]: parentId, attendanceStatus: { in: TAKEN } } })
    return taken < parent.capacity
}

// The walk-in at the back of the waitlist, oldest-first like everyone else.
export function waitlistWalkIn(db, kindName, parentId, memberId) {
    const { link, key } = KINDS[kindName]
    return db[link].create({
        data: { memberId, [key]: parentId, attendanceStatus: 'waitlisted', waitlistedAt: new Date() }
    })
}

// the reply a waitlisted walk-in's scan gets
export function walkInWaitlisted(res, parent, attendance) {
    const why = !checkinIsOpen(parent)
        ? 'check-in isn’t open yet'
        : 'there’s no free spot ahead of the waitlist'
    return res.status(202).json({
        code: 'WAITLISTED',
        message: `No RSVP found and ${why}, so they were added to the end of the waitlist`,
        attendance
    })
}
