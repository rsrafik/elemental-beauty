'use client'

import { useEffect, useState } from 'react'

const DAY_LABELS = ['MON', 'TUES', 'WED', 'THURS', 'FRI']

// YYYY-MM-DD in the viewer's own timezone. toISOString() would convert to UTC
// first, which lands on the wrong day for anyone west of Greenwich after 5pm.
const isoDate = (d) => d.toLocaleDateString('en-CA')

// Monday of the week `today` falls in, then the four weekdays after it.
// getDay() is 0=Sun..6=Sat, so (day + 6) % 7 gives days-since-Monday.
function weekdaysOf(today) {
    const monday = new Date(today)
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))

    return DAY_LABELS.map((_, i) => {
        const date = new Date(monday)
        date.setDate(monday.getDate() + i)
        return date
    })
}

// TODO: replace with the week's events from the backend, keyed by ISO date —
// fetch(`/api/events?week=${isoDate(days[0].date)}`). Keyed by weekday index
// for now so the design stays populated whatever week it's viewed in.
const sampleEvents = {
    1: { title: 'Bubbles & Beakers Pt. I', action: 'CHECK IN' },
    3: { title: 'Bubbles & Beakers Pt. II', action: 'RSVP' },
}

export default function WeekStrip() {
    // Resolved after mount, not during render: this app builds to a static
    // export, so a date computed on the server is frozen at build time and
    // would show whatever week the site was last deployed.
    const [days, setDays] = useState(null)

    useEffect(() => {
        const now = new Date()
        const todayIso = isoDate(now)

        setDays(weekdaysOf(now).map((date) => ({
            iso: isoDate(date),
            dayOfMonth: date.getDate(),
            isToday: isoDate(date) === todayIso,
        })))
    }, [])

    return (
        <section className="
            flex
            border-3
            border-green-dark
            rounded-sm
            overflow-hidden
        ">
            {DAY_LABELS.map((label, i) => {
                const day = days?.[i]
                const event = sampleEvents[i]

                return (
                    <div
                        key={label}
                        aria-current={day?.isToday ? 'date' : undefined}
                        className="
                            flex-1
                            flex
                            flex-col
                            border-r
                            border-green-dark
                            last:border-r-0
                        "
                    >
                        <div className={`
                            ${day?.isToday ? 'bg-green' : 'bg-sage-dark'}
                            border-b
                            border-green-dark
                            flex
                            items-baseline
                            justify-center
                            gap-1.5
                            px-2
                            py-1.5
                        `}>
                            <span className="font-serif font-bold text-green-dark text-[20px]">
                                {label}
                            </span>
                            <span className="font-cause text-green-dark text-xs">
                                {day?.dayOfMonth}
                            </span>
                        </div>

                        <div className={`
                            ${day?.isToday ? 'bg-sage-dark' : 'bg-sage'}
                            flex-1
                            flex
                            flex-col
                            items-center
                            gap-3
                            min-h-36
                            px-3
                            py-3
                        `}>
                            {event && (
                                <p className="
                                    font-serif
                                    text-green-dark
                                    text-[25px]
                                    leading-tight
                                ">
                                    {event.title}
                                </p>
                            )}
                            {event?.action && (
                                <button type="button" className="
                                    mt-auto
                                    bg-sage-dark
                                    border
                                    border-green-dark
                                    text-green-dark
                                    font-cause
                                    text-xs
                                    tracking-wide
                                    px-4
                                    py-1.5
                                    rounded-full
                                ">
                                    {event.action}
                                </button>
                            )}
                        </div>
                    </div>
                )
            })}
        </section>
    )
}
