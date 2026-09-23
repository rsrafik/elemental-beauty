'use client'

import { Suspense } from 'react'
import { Gate } from '@/lib/session'
import { hasRole } from '@/lib/roles'
import NoAccess from '@/components/NoAccess'
import MemberLabView from '@/components/labs/MemberLabView'
import OfficerLabView from '@/components/labs/OfficerLabView'

// Which lab comes in as `?id=`, read with useSearchParams — which needs a
// Suspense boundary in a static export (see app/events/page.js).
export default function LabView() {
	return (
		<Suspense fallback={<main className="min-h-screen w-full bg-cream" />}>
			<Gate
				require="member"
				fallback={<NoAccess message="Labs are for members." />}
				render={(user) =>
					hasRole('officer', user.role) ? <OfficerLabView /> : <MemberLabView />
				}
			/>
		</Suspense>
	)
}
