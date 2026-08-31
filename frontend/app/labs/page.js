'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Gate } from '@/lib/session'
import { hasRole } from '@/lib/roles'
import NoAccess from '@/components/NoAccess'
import UserLabs from '@/components/labs/MemberLabs'
import OfficerLabs from '@/components/labs/OfficerLabs'

// `?new` is the dashboard's "New Lab" button asking this page to open its form
// on arrival — see the note in app/events/page.js for why it's read through
// useSearchParams rather than off window.location.
function LabsRoute() {
	const openNew = useSearchParams().has('new')

	return (
		<Gate
			require="member"
			fallback={<NoAccess message="Labs are for members." />}
			render={(user) =>
				hasRole('officer', user.role)
					? <OfficerLabs openNew={openNew} />
					: <UserLabs />
			}
		/>
	)
}

export default function Labs() {
	return (
		<Suspense fallback={<main className="min-h-screen w-full bg-cream" />}>
			<LabsRoute />
		</Suspense>
	)
}
