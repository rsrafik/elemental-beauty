import DashboardShell from '@/components/dashboards/DashboardShell'

// Rendered when someone lands on a page their role doesn't cover — /students
// and /analytics for a non-officer, the treasurer view for a non-treasurer.
//
// This is UI only. The real gate is the API: the backend's requireRole
// middleware has to reject the underlying requests too, otherwise hiding the
// page just hides the button.

export default function NoAccess({ message = 'This page is officers only.' }) {
	return (
		<DashboardShell className="
			flex
			items-center
			justify-center
		">
			<div className="
				text-center
			">
				<h1 className="
					font-reasons
					text-[60px]
					text-black
					leading-none
				">
					nope
				</h1>
				<p className="
					font-handrawn
					text-[28px]
					text-black
					mt-4
				">
					{message}
				</p>
			</div>
		</DashboardShell>
	)
}
