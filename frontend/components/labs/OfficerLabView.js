'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import CheckInView from '@/components/checkin/CheckInView'
import MemberLabView from '@/components/labs/MemberLabView'
import { labs as labsApi } from '@/lib/api'
import { useRole } from '@/lib/session'

// /labs/view for officer / treasurer / admin: the lab's check-in page — the
// QR camera and the not checked in / checked in / waitlist columns. Editing
// the lab and its quiz are on the card's dots menu on /labs.
//
// Except for a j-board member signed up for this lab: they're one of its
// attendees, so its attendance isn't theirs to run (the API refuses them —
// see requireNotAttendee in src/routes/roster.js). They get the member's page
// instead: their sign-up, their QR at the door, then the quiz.
export default function OfficerLabView() {
	const id = useSearchParams().get('id')
	const role = useRole()
	// j-board only: whether they have a row on this lab — null while asking
	const [attending, setAttending] = useState(role === 'jboard' ? null : false)

	useEffect(() => {
		if (role !== 'jboard' || !id) return
		let live = true
		labsApi
			.get(id)
			.then((lab) => live && setAttending(Boolean(lab.mine)))
			// can't tell: the check-in page, whose own reads say what's wrong
			.catch(() => live && setAttending(false))
		return () => { live = false }
	}, [role, id])

	if (attending === null) return null
	return attending ? <MemberLabView /> : <CheckInView kind="lab" id={id} />
}
