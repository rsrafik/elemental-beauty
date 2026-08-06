import { hasRole } from '@/lib/roles'

// The sidebar menu, per role. Order here is the order in the sidebar, and the
// numbers (01, 02, ...) come from that order — so adding an entry renumbers
// everything below it automatically.

// Everyone with an account gets the dashboard — for somebody who isn't a member
// yet that's the onboarding one, and it's the whole menu: labs, events and the
// calendar are the club's, and you join before you get to see them.
const BASE = [
	{ label: 'dashboard', href: '/dashboard' },
]

const MEMBER_ONLY = [
	{ label: 'labs', href: '/labs' },
	{ label: 'events', href: '/events' },
	{ label: 'calendar', href: '/calendar' },
]

const OFFICER_ONLY = [
	{ label: 'students', href: '/students' },
	{ label: 'analytics', href: '/analytics' },
]

export function navFor(role) {
	if (!hasRole('member', role)) return BASE
	if (!hasRole('officer', role)) return [...BASE, ...MEMBER_ONLY]
	return [...BASE, ...MEMBER_ONLY, ...OFFICER_ONLY]
}

// The instagram banner belongs to the member-facing sidebar and follows them
// from page to page — it's part of their menu, not a dashboard decoration.
// Officers don't get it: two extra menu items already fill that space.
export function showInstagramFor(role) {
	return !hasRole('officer', role)
}
