import DashboardShell from '@/components/dashboards/DashboardShell'

// /labs/view for officer / treasurer / admin: one lab's details plus the
// roster, the QR check-in and edit/delete. Its own layout — design freely.

export default function OfficerLabView() {
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
