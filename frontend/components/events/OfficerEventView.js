'use client'

import { useSearchParams } from 'next/navigation'
import CheckInView from '@/components/checkin/CheckInView'

// /events/view for officer / treasurer / admin: the event's check-in page —
// the same page a lab gets (see CheckInView).
export default function OfficerEventView() {
	const id = useSearchParams().get('id')
	return <CheckInView kind="event" id={id} />
}
