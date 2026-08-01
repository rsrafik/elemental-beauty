import DashboardShell from '@/components/dashboards/DashboardShell'

// /events/view for a user or member: one event's details and RSVP.
// Its own layout — design freely.

export default function UserEventView() {
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
