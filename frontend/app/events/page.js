'use client'

import { Gate } from '@/lib/session'
import { hasRole } from '@/lib/roles'
import NoAccess from '@/components/NoAccess'
import UserEvents from '@/components/events/MemberEvents'
import OfficerEvents from '@/components/events/OfficerEvents'

export default function Events() {
	return (
		<Gate
			require="member"
			fallback={<NoAccess message="Events are for members." />}
			render={(user) => (hasRole('officer', user.role) ? <OfficerEvents /> : <UserEvents />)}
		/>
	)
}
