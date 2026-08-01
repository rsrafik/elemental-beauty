import DashboardShell from '@/components/dashboards/DashboardShell'

// /labs/view for a user or member: one lab's details, RSVP button, their own
// attendance status. Its own layout — design freely.

export default function MemberLabView() {
	return (
		<DashboardShell>
			<h1 className="
				font-reasons
				text-[50px]
				text-black
			">
				lab
			</h1>
		</DashboardShell>
	)
}
