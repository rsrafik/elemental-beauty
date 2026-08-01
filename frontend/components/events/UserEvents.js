import DashboardShell from '@/components/dashboards/DashboardShell'

// /events for a user or member: browse upcoming events and RSVP.
// Its own layout — design freely.

export default function UserEvents() {
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
