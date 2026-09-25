'use client'

import { Gate } from '@/lib/session'
import { canSeeAnalytics, isTreasurer } from '@/lib/roles'
import NoAccess from '@/components/NoAccess'
import OfficerAnalytics from '@/components/analytics/OfficerAnalytics'
import TreasurerAnalytics from '@/components/analytics/TreasurerAnalytics'

// Officers and up, except j-board (see canSeeAnalytics). Within that, two
// different pages rather than one page with some buttons hidden — see the note
// at the top of each component.
export default function Analytics() {
	return (
		<Gate
			require="officer"
			fallback={<NoAccess />}
			render={(user) =>
				!canSeeAnalytics(user.role)
					? <NoAccess message="Analytics is for officers and the treasurer." />
					: isTreasurer(user.role) ? <TreasurerAnalytics /> : <OfficerAnalytics />
			}
		/>
	)
}
