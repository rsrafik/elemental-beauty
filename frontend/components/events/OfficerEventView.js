import DashboardShell from '@/components/dashboards/DashboardShell'

// /events/view for officer / treasurer / admin: one event's details plus the
// roster, check-in and edit/delete. Its own layout — design freely.

export default function OfficerEventView() {
	return (
		<DashboardShell>
			<h1 className="
				font-reasons
				text-[50px]
				text-black
			">
				event
			</h1>
		</DashboardShell>
	)
}
