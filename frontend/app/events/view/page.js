'use client'

import { Suspense } from 'react'
import { Gate } from '@/lib/session'
import { hasRole } from '@/lib/roles'
import NoAccess from '@/components/NoAccess'
import MemberEventView from '@/components/events/MemberEventView'
import OfficerEventView from '@/components/events/OfficerEventView'

// Which event comes in as `?id=`, read with useSearchParams — which needs a
// Suspense boundary in a static export (see app/events/page.js).
export default function EventView() {
	return (
		<Suspense fallback={<main className="min-h-screen w-full bg-cream" />}>
			<Gate
				require="member"
				fallback={<NoAccess message="Events are for members." />}
				render={(user) =>
					hasRole('officer', user.role) ? <OfficerEventView /> : <MemberEventView />
				}
			/>
		</Suspense>
	)
}
