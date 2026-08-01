import { currentRole, hasRole, isTreasurer } from '@/lib/roles'
import NoAccess from '@/components/NoAccess'
import OfficerAnalytics from '@/components/analytics/OfficerAnalytics'
import TreasurerAnalytics from '@/components/analytics/TreasurerAnalytics'

export default function Analytics() {
	if (!hasRole('officer', currentRole)) return <NoAccess />
	if (isTreasurer(currentRole)) return <TreasurerAnalytics />
	return <OfficerAnalytics />
}
