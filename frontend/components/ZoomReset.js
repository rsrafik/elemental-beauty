'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// Stops an iPhone zooming the page in when a field is tapped.
//
// Safari zooms in on any field whose text is under 16px (the site's are 13–14),
// and every browser on an iPhone is Safari underneath. It never zooms back out,
// and the zoom outlives the page: sign in with Enter and the dashboard arrives
// already zoomed in.
//
// The fix is `maximum-scale=1` on the viewport, on iOS only. There it stops the
// focus zoom and nothing else: iOS has ignored maximum-scale for pinching since
// iOS 10, so people can still zoom in by hand. Android is left alone because
// Chrome there does honour it, and would lose pinch-zoom.
//
// (The first version waited for the field to lose focus and then flicked the
// limit on and off to pull the zoom back out. On a real phone that didn't
// work — the page stayed zoomed — so now the zoom never happens.)
//
// Next writes the viewport tag itself and rewrites it when a page with its own
// viewport (/login) comes or goes, so the limit is put back after every page
// change and whenever the tag's content is changed out from under it.

const LIMIT = 'maximum-scale=1'

function isIOS() {
	const ua = navigator.userAgent
	// iPadOS reports itself as a Mac; the touch points give it away
	return /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

function limit() {
	const meta = document.querySelector('meta[name="viewport"]')
	const content = meta?.getAttribute('content')
	if (!meta || content.includes('maximum-scale')) return
	meta.setAttribute('content', `${content}, ${LIMIT}`)
}

export default function ZoomReset() {
	const pathname = usePathname()

	useEffect(() => {
		if (!isIOS()) return
		limit()
		// the tag rewritten or swapped by Next's head management
		const observer = new MutationObserver(limit)
		observer.observe(document.head, { subtree: true, childList: true, attributes: true, attributeFilter: ['content'] })
		return () => observer.disconnect()
	}, [])

	useEffect(() => {
		if (isIOS()) limit()
	}, [pathname])

	return null
}
