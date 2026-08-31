'use client'

import { Gate } from '@/lib/session'
import { hasRole } from '@/lib/roles'
import NoAccess from '@/components/NoAccess'
import MemberLabView from '@/components/labs/MemberLabView'
import OfficerLabView from '@/components/labs/OfficerLabView'

export default function LabView() {
	return (
		<Gate
			require="member"
			fallback={<NoAccess message="Labs are for members." />}
			render={(user) =>
				hasRole('officer', user.role) ? <OfficerLabView /> : <MemberLabView />
			}
		/>
	)
}
