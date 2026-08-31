'use client'

import { Gate } from '@/lib/session'
import { hasRole } from '@/lib/roles'
import NoAccess from '@/components/NoAccess'
import UserLabs from '@/components/labs/MemberLabs'
import OfficerLabs from '@/components/labs/OfficerLabs'

export default function Labs() {
	return (
		<Gate
			require="member"
			fallback={<NoAccess message="Labs are for members." />}
			render={(user) => (hasRole('officer', user.role) ? <OfficerLabs /> : <UserLabs />)}
		/>
	)
}
