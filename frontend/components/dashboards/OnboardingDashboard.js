import Sidebar from '@/components/dashboards/Sidebar'

// Shown to a user (role = 'user'). Its own layout — design freely.
export default function OnboardingDashboard() {
	return (
		<main className="
			bg-cream
			w-full
			min-h-screen
			p-4
			flex
			gap-4
		">
			<Sidebar
				items={['dashboard']}
				active="dashboard"
			/>
		</main>
	)
}
