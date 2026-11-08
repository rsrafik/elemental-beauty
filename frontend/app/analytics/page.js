'use client'

import { Gate } from '@/lib/session'
import { canSeeAnalytics, isTreasurer, onTreasuryTeam } from '@/lib/roles'
import NoAccess from '@/components/NoAccess'
import OfficerAnalytics from '@/components/analytics/OfficerAnalytics'
import TreasurerAnalytics from '@/components/analytics/TreasurerAnalytics'

// Officers and up, j-board included, except the advisor (see canSeeAnalytics).
// J-board gets the officer's page; j-board's treasury team gets the
// treasurer's page to read, with only the grants and sponsorships to keep. Within that, two different pages rather than one
// page with some buttons hidden — see the note at the top of each component.
export default function Analytics() {
	return (
		<Gate
			require="officer"
			fallback={<NoAccess />}
			render={(user) =>
				!canSeeAnalytics(user.role)
					? <NoAccess message="Analytics is for e-board, j-board and the treasurer." />
					: isTreasurer(user.role) || onTreasuryTeam(user.role, user.jboardTeams)
						? <TreasurerAnalytics />
						: <OfficerAnalytics />
			}
		/>
	)
}
