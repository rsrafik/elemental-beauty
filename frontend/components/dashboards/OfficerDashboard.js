import Sidebar from '@/components/dashboards/Sidebar'

// Shown to officer / treasurer / admin. Its own layout — design freely.
export default function OfficerDashboard() {
    return (
        <main className="bg-cream w-full min-h-screen p-4 flex gap-4">
            <Sidebar
                items={['dashboard', 'labs', 'events', 'calendar', 'students', 'analytics']}
                active="dashboard"
                showInstagram={false}
            />
        </main>
    )
}
