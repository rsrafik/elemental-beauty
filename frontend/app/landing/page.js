import Landing from '@/components/landing/Landing'

// The landing page's preview address. The home address still sends everyone
// to sign-in (app/page.js, and src/server.js before that); this is where the
// page lives until it is approved to take over `/`.
export const metadata = {
	title: 'Elemental Beauty',
}

export default function LandingPreview() {
	return <Landing />
}
