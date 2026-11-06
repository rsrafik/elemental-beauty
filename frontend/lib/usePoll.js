'use client'

import { useEffect, useRef } from 'react'

// Runs `read` now and every `ms` after — but only while the tab is being
// looked at. A tab in the background asks nothing; coming back to it asks
// straight away, so what's on screen is never stale. One read at a time: a
// slow answer isn't stacked up behind by the next tick.
//
// `read` can change every render (it's kept in a ref); `ms` and `enabled`
// restart the clock. `immediate: false` skips the first read, for a page
// that's already loading on its own.
export default function usePoll(read, ms, enabled = true, { immediate = true } = {}) {
	const latest = useRef(read)
	useEffect(() => {
		latest.current = read
	})

	useEffect(() => {
		if (!enabled) return
		let timer = null
		let busy = false
		const run = () => {
			if (busy || document.visibilityState === 'hidden') return
			busy = true
			Promise.resolve()
				.then(() => latest.current())
				.catch(() => {})
				.finally(() => { busy = false })
		}
		const start = () => {
			clearInterval(timer)
			timer = setInterval(run, ms)
		}
		const onVisibility = () => {
			if (document.visibilityState === 'visible') {
				run()
				start()
			} else {
				clearInterval(timer)
			}
		}
		if (immediate) run()
		start()
		document.addEventListener('visibilitychange', onVisibility)
		return () => {
			clearInterval(timer)
			document.removeEventListener('visibilitychange', onVisibility)
		}
	}, [ms, enabled, immediate])
}
