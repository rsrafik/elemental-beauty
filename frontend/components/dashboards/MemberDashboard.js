import Sidebar from '@/components/dashboards/Sidebar'

// Shown to a member (role = 'member'). Its own layout — design freely.
export default function MemberDashboard() {
    return (
        <main className="bg-cream w-full min-h-screen p-4 flex gap-4">
            <Sidebar
                items={['dashboard', 'labs', 'events', 'calendar']}
                active="dashboard"
            />
        </main>
    )
}
