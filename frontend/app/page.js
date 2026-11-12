import Landing from '@/components/landing/Landing'

// The home address is the public landing page. Members sign in from its nav
// (/login, which sends anyone already signed in on to /dashboard).
export const metadata = {
	title: 'Elemental Beauty',
}

export default function Home() {
	return <Landing />
}
