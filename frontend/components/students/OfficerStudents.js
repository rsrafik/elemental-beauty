import DashboardShell from '@/components/dashboards/DashboardShell'

// /students — officer and up only. The member roster: search, points, waiver
// and verification status, role changes. Its own layout — design freely.

export default function OfficerStudents() {
	return (
		<DashboardShell>
			<h1 className="
				font-reasons
				text-[50px]
				text-black
			">
				students
			</h1>
		</DashboardShell>
	)
}
