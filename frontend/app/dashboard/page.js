'use client'

import { Gate } from '@/lib/session'
import { hasRole } from '@/lib/roles'
import OnboardingDashboard from '@/components/dashboards/OnboardingDashboard'
import MemberDashboard from '@/components/dashboards/MemberDashboard'
import OfficerDashboard from '@/components/dashboards/OfficerDashboard'

// Every role has a dashboard — an account with no membership gets the
// onboarding one — so this gate only checks that somebody is signed in.
export default function Dashboard() {
	return (
		<Gate
			render={(user) => {
				if (hasRole('officer', user.role)) return <OfficerDashboard />
				if (hasRole('member', user.role)) return <MemberDashboard />
				return <OnboardingDashboard />
			}}
		/>
	)
}
