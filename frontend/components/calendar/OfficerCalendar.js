import DashboardShell from '@/components/dashboards/DashboardShell'

// /calendar for officer / treasurer / admin: same month view, but they can
// schedule and move things from it. Its own layout — design freely.

export default function OfficerCalendar() {
	return (
		<DashboardShell>
			<h1 className="
				font-reasons
				text-[50px]
				text-black
			">
				calendar
			</h1>
		</DashboardShell>
	)
}
