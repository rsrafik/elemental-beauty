import { redirect } from 'next/navigation'

// The site is members-only for now, so the address opens on the sign-in page,
// which sends anyone already signed in on to /dashboard. The landing page is
// kept in components/landing/Landing.js for when it comes back.
//
// src/server.js redirects / to /login before this page is ever served; this
// covers `next dev`, and anything that reaches the exported page anyway.
export default function Home() {
	redirect('/login')
}
