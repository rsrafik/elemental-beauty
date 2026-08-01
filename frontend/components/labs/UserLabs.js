import DashboardShell from '@/components/dashboards/DashboardShell'

// /labs for a user or member: browse upcoming labs, RSVP, look back at the
// ones they've attended. Its own layout — design freely.

export default function UserLabs() {
	return (
		<DashboardShell>
			<h1 className="
				font-reasons
				text-[50px]
				text-black
			">
				labs
			</h1>
		</DashboardShell>
	)
}
