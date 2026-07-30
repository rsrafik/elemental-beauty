import OnboardingDashboard from '@/components/dashboards/OnboardingDashboard'
import MemberDashboard from '@/components/dashboards/MemberDashboard'
import OfficerDashboard from '@/components/dashboards/OfficerDashboard'


const previewRole = 'member'   // 'user' | 'member' | 'officer'

export default function Dashboard() {
    if (previewRole === 'user') return <OnboardingDashboard />
    if (previewRole === 'officer') return <OfficerDashboard />
    return <MemberDashboard />
}
