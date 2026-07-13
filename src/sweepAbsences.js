import prisma from './prismaClient.js'

// Once the day of a lab/event has ended, anyone still 'rsvped' never showed
// up — mark them absent. Waitlisted rows are left alone: those members never
// held a seat, so they aren't no-shows (and neither state earns points).
// Runs on server boot and hourly (see server.js).
export async function sweepAbsences() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)   // any date strictly before today has ended

    const labs = await prisma.memberLab.updateMany({
        where: { attendanceStatus: 'rsvped', lab: { date: { lt: today } } },
        data: { attendanceStatus: 'absent' }
    })
    const events = await prisma.memberEvent.updateMany({
        where: { attendanceStatus: 'rsvped', event: { date: { lt: today } } },
        data: { attendanceStatus: 'absent' }
    })

    if (labs.count > 0 || events.count > 0) {
        console.log(`Absence sweep: marked ${labs.count} lab and ${events.count} event no-shows absent`)
    }
}
