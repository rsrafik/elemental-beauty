import OnboardingDashboard from '@/components/dashboards/OnboardingDashboard'
import MemberDashboard from '@/components/dashboards/MemberDashboard'
import OfficerDashboard from '@/components/dashboards/OfficerDashboard'

// ⚠️ TEMPORARY preview switch. Flip this string to design each dashboard
// in the live preview. Real role detection (fetched from the backend) will
// replace this whole block later.
const previewRole = 'user'   // 'user' | 'member' | 'officer'

export default function Dashboard() {
    if (previewRole === 'user') return <OnboardingDashboard />
    if (previewRole === 'officer') return <OfficerDashboard />
    return <MemberDashboard />
}
