'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// Whether this tab has moved between the app's pages since it loaded — what
// the back arrow (LabViewParts' BackButton) asks before stepping back through
// the browser's history. Someone who arrived straight on a page, from an email
// link or a bookmark, has nowhere in the app to go back to: stepping back
// would leave the site, so the arrow takes them to its usual page instead.
//
// Held in the module rather than in state: it's per tab and per load, which
// is exactly a module's lifetime in the browser, and nothing needs to redraw
// when it changes.
let moves = 0
let last = null

// Mounted once, in the root layout.
export function NavTracker() {
	const pathname = usePathname()
	useEffect(() => {
		if (last !== null && last !== pathname) moves++
		last = pathname
	}, [pathname])
	return null
}

export function cameFromApp() {
	return moves > 0
}
