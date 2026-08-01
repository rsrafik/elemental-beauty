import DashboardShell from '@/components/dashboards/DashboardShell'

// /analytics — officer and up. Attendance, engagement, membership growth.
// The money side lives in TreasurerAnalytics instead.
// Its own layout — design freely.

export default function OfficerAnalytics() {
	return (
		<DashboardShell>
			<h1 className="
				font-reasons
				text-[50px]
				text-black
			">
				analytics
			</h1>
		</DashboardShell>
	)
}
