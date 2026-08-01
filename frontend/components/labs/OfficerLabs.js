import DashboardShell from '@/components/dashboards/DashboardShell'

// /labs for officer / treasurer / admin: create labs, edit them, watch the
// RSVP counts, open check-in. Its own layout — design freely.

export default function OfficerLabs() {
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
