import DashboardShell from '@/components/dashboards/DashboardShell'

// /analytics for the treasurer: the finance view — budget, dues, spend per
// lab, reimbursement queue. Officers who aren't treasurer get
// OfficerAnalytics instead. Its own layout — design freely.

export default function TreasurerAnalytics() {
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
