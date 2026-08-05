import Sidebar from '@/components/dashboards/Sidebar'
import { currentRole } from '@/lib/roles'
import { navFor, showInstagramFor } from '@/lib/nav'

// Shown to a user (role = 'user'). Its own layout — design freely.
export default function OnboardingDashboard() {
	return (
		<main className="
			bg-cream
			w-full
			min-h-screen
			overflow-x-clip
			p-4
			flex
			flex-col
			lg:flex-row
			gap-4
		">
			<Sidebar
				items={navFor(currentRole)}
				showInstagram={showInstagramFor(currentRole)}
			/>
		</main>
	)
}
