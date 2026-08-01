import { currentRole, hasRole } from '@/lib/roles'
import OnboardingDashboard from '@/components/dashboards/OnboardingDashboard'
import MemberDashboard from '@/components/dashboards/MemberDashboard'
import OfficerDashboard from '@/components/dashboards/OfficerDashboard'

export default function Dashboard() {
	if (hasRole('officer', currentRole)) return <OfficerDashboard />
	if (hasRole('member', currentRole)) return <MemberDashboard />
	return <OnboardingDashboard />
}
