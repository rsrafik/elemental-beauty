import DashboardShell from '@/components/dashboards/DashboardShell'

// /calendar for a user or member: month view of labs + events, read only.
// Its own layout — design freely.

export default function UserCalendar() {
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
