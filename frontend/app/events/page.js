'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Gate } from '@/lib/session'
import { hasRole } from '@/lib/roles'
import NoAccess from '@/components/NoAccess'
import UserEvents from '@/components/events/MemberEvents'
import OfficerEvents from '@/components/events/OfficerEvents'

// `?new` is the dashboard's "New Event" button asking this page to open its
// form on arrival — one form, in the one place it belongs, still one click away.
//
// Read through useSearchParams rather than off window.location: a soft
// navigation renders the destination before window.location catches up, so
// reading the raw URL works on a full page load and silently does nothing when
// you arrive from the dashboard. The router's own state is right in both cases.
// That hook needs a Suspense boundary, which is what the default export is for.
function EventsRoute() {
	const openNew = useSearchParams().has('new')

	return (
		<Gate
			require="member"
			fallback={<NoAccess message="Events are for members." />}
			render={(user) =>
				hasRole('officer', user.role)
					? <OfficerEvents openNew={openNew} />
					: <UserEvents />
			}
		/>
	)
}

export default function Events() {
	return (
		<Suspense fallback={<main className="min-h-screen w-full bg-cream" />}>
			<EventsRoute />
		</Suspense>
	)
}
