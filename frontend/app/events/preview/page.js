'use client'

import { Suspense } from 'react'
import { Gate } from '@/lib/session'
import NoAccess from '@/components/NoAccess'
import MemberEventView from '@/components/events/MemberEventView'

// /events/preview?id=N — an event as a VIP sees it, without the rsvp, for
// staff. The advisor's "view content" in an event card's dots on /events.
export default function PreviewEvent() {
	return (
		<Suspense fallback={<main className="min-h-screen w-full bg-cream" />}>
			<Gate
				require="officer"
				fallback={<NoAccess message="Event previews are for e-board." />}
				render={() => <MemberEventView preview />}
			/>
		</Suspense>
	)
}
