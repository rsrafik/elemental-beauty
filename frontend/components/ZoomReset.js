'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// Undoes the zoom an iPhone puts on the page when a field is tapped.
//
// Safari zooms in on any field whose text is under 16px, and every browser on
// an iPhone is Safari underneath. It never zooms back out on its own, and the
// zoom outlives the page: sign in with Enter and the dashboard arrives already
// zoomed in. So once nothing is being typed into — focus has left the fields,
// or a new page has come up — this puts the zoom back where it was.
//
// There's no call for setting the zoom. What there is: a viewport that says
// `maximum-scale=1` pulls the page back to 1, and taking that back off a moment
// later leaves pinch-zoom working as before. That's the whole trick.
//
// Only the zoom a field caused is undone. The scale is noted when a field is
// first focused; if the page was already pinched in by hand at that point, it's
// left alone.

const TYPING = 'input:not([type=checkbox], [type=radio], [type=button], [type=submit], [type=file], [type=range], [type=color]), textarea, select, [contenteditable="true"]'

const scale = () => window.visualViewport?.scale ?? 1

let before = null  // the scale when a field took focus, while one has it

function zoomBack() {
	const started = before
	before = null
	// nothing to undo: no field zoomed us, we'd been pinched in already, or
	// the field didn't actually zoom
	if (started == null || started > 1.01 || scale() <= started + 0.01) return

	const meta = document.querySelector('meta[name="viewport"]')
	if (!meta) return
	const content = meta.getAttribute('content')
	meta.setAttribute('content', `${content}, maximum-scale=1`)
	// long enough for Safari to apply it, then pinch-zoom is handed back
	setTimeout(() => meta.setAttribute('content', content), 300)
}

export default function ZoomReset() {
	const pathname = usePathname()

	useEffect(() => {
		const onFocusIn = (event) => {
			if (before == null && event.target.matches?.(TYPING)) before = scale()
		}
		// focus moving from one field straight to the next isn't leaving —
		// wait for the new one to take it before deciding
		const onFocusOut = () => {
			setTimeout(() => {
				if (!document.activeElement?.matches?.(TYPING)) zoomBack()
			}, 0)
		}
		document.addEventListener('focusin', onFocusIn)
		document.addEventListener('focusout', onFocusOut)
		return () => {
			document.removeEventListener('focusin', onFocusIn)
			document.removeEventListener('focusout', onFocusOut)
		}
	}, [])

	// A new page: the field that zoomed us may have been taken away with the
	// old one without ever reporting that it lost focus.
	useEffect(() => {
		if (!document.activeElement?.matches?.(TYPING)) zoomBack()
	}, [pathname])

	return null
}
