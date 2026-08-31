'use client'

import { Gate } from '@/lib/session'
import { hasRole } from '@/lib/roles'
import NoAccess from '@/components/NoAccess'
import MemberEventView from '@/components/events/MemberEventView'
import OfficerEventView from '@/components/events/OfficerEventView'

export default function EventView() {
	return (
		<Gate
			require="member"
			fallback={<NoAccess message="Events are for members." />}
			render={(user) =>
				hasRole('officer', user.role) ? <OfficerEventView /> : <MemberEventView />
			}
		/>
	)
}
