'use client'

import { Gate } from '@/lib/session'
import { hasRole } from '@/lib/roles'
import NoAccess from '@/components/NoAccess'
import UserEvents from '@/components/events/MemberEvents'
import OfficerEvents from '@/components/events/OfficerEvents'

// The dashboard's "New Event" opens this page's form on arrival — one form, in
// the one place it belongs, still one click away. It asks through
// lib/openNew.js rather than a `?new` on the address; that file says why.
export default function Events() {
	return (
		<Gate
			require="member"
			fallback={<NoAccess message="Events are for members." />}
			render={(user) =>
				hasRole('officer', user.role)
					? <OfficerEvents />
					: <UserEvents />
			}
		/>
	)
}
