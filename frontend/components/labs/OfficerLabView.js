'use client'

import { useSearchParams } from 'next/navigation'
import CheckInView from '@/components/checkin/CheckInView'

// /labs/view for officer / treasurer / admin: the lab's check-in page — the
// QR camera and the not checked in / checked in / waitlist columns. Editing
// the lab and its quiz are on the card's dots menu on /labs.
export default function OfficerLabView() {
	const id = useSearchParams().get('id')
	return <CheckInView kind="lab" id={id} />
}
