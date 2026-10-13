'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import CheckInView from '@/components/checkin/CheckInView'
import MemberEventView from '@/components/events/MemberEventView'
import { events as eventsApi } from '@/lib/api'
import { useRole } from '@/lib/session'

// /events/view for officer / treasurer / admin: the event's check-in page —
// the same page a lab gets (see CheckInView).
//
// Except for a j-board member signed up for this event — the same rule as a
// lab's (OfficerLabView): they're one of its attendees, so its attendance
// isn't theirs to run (the API refuses them — see requireNotAttendee in
// src/routes/roster.js). They get the member's page instead: their sign-up,
// and their QR at the door.
export default function OfficerEventView() {
	const id = useSearchParams().get('id')
	const role = useRole()
	// j-board only: whether they have a row on this event — null while asking
	const [attending, setAttending] = useState(role === 'jboard' ? null : false)

	useEffect(() => {
		if (role !== 'jboard' || !id) return
		let live = true
		eventsApi
			.get(id)
			.then((event) => live && setAttending(Boolean(event.mine)))
			// can't tell: the check-in page, whose own reads say what's wrong
			.catch(() => live && setAttending(false))
		return () => { live = false }
	}, [role, id])

	if (attending === null) return null
	return attending ? <MemberEventView /> : <CheckInView kind="event" id={id} />
}
