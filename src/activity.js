import prisma from './prismaClient.js'

// The staff activity log (the activity_log table): who did what to whom.
//
// What gets written, and the `action` it's written under:
//
//   role_changed     an admin changed someone's role      details { from, to }
//   points_awarded   an officer gave points by hand       details { reason }
//   checked_in       a check-in earned points             details { kind, id, title, by: 'qr' | 'hand' }
//   checkin_undone   a check-in was taken back            details { kind, id, title }
//   member_added     an officer added a student           details { role }
//   member_removed   an officer removed a student         details { role, points }
//   account_deleted  someone deleted their own account    details { role, points }
//   dues_paid        the treasurer marked dues paid       details { schoolYear, amount }
//   dues_cleared     the treasurer took that back         details { schoolYear, amount }
//   dues_waived      an officer let someone into a lab    details { schoolYear, kind, id, title }
//                    without paying, at the door
//
// Names are copied in as they are at the time, so the log still reads right
// after someone is renamed or removed.

export const ACTIONS = [
    'role_changed', 'points_awarded', 'checked_in', 'checkin_undone',
    'member_added', 'member_removed', 'account_deleted', 'dues_paid', 'dues_cleared', 'dues_waived'
]

export const fullName = (user) =>
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') || (user?.username ? `@${user.username}` : 'someone')

// Look the names up once per write. `db` is the transaction when there is one,
// so the log row lands (or doesn't) with the change it describes.
async function nameOf(db, userId) {
    if (userId == null) { return null }
    const user = await db.user.findUnique({
        where: { userId },
        select: { firstName: true, lastName: true, username: true }
    })
    return user ? fullName(user) : null
}

// log({ actorId, action, targetId, points, details }, tx?)
//
// `targetName` / `actorName` can be passed when the row is about to be gone
// (a removal) and can't be looked up afterwards.
export async function log(entry, db = prisma) {
    const actorName = entry.actorName ?? (await nameOf(db, entry.actorId)) ?? 'system'
    const targetName = entry.targetName ?? (await nameOf(db, entry.targetId))
    return db.activityLog.create({
        data: {
            actorId: entry.actorId ?? null,
            actorName,
            action: entry.action,
            targetId: entry.targetId ?? null,
            targetName,
            points: entry.points ?? null,
            details: entry.details ?? undefined
        }
    })
}

// For the places where a log line failing mustn't undo what already
// happened (it's written after the change, outside its transaction).
export function logQuietly(entry) {
    return log(entry).catch((err) => console.error(`Activity log failed: ${err.message}`))
}
