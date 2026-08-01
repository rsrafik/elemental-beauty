import DashboardShell from '@/components/dashboards/DashboardShell'

// /events for officer / treasurer / admin: create and edit events, track
// attendance. Its own layout — design freely.

export default function OfficerEvents() {
	return (
		<DashboardShell>
			<h1 className="
				font-reasons
				text-[50px]
				text-black
			">
				events
			</h1>
		</DashboardShell>
	)
}
