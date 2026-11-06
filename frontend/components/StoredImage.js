'use client'

import { useEffect, useRef, useState } from 'react'
import { getToken } from '@/lib/api'
import { storedImage } from '@/lib/images'

// A transparent pixel: the <img> keeps its box (its classes size it) while
// the picture's on its way.
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

// <img> for any picture the API hands out — an address (GET /api/img/...),
// fetched with the sign-in token and kept by the browser (lib/images.js), or
// a data URL picked just now, shown as it is. Takes everything an <img> does.
//
// It's fetched only once it's about to scroll into view, so a page of fifty
// cards asks for the dozen on screen; it fades in when it lands.
export default function StoredImage({ src, alt = '', className = '', style, ...rest }) {
	const ref = useRef(null)
	const direct = typeof src === 'string' && !src.startsWith('/api/img/')
	const [loaded, setLoaded] = useState(null) // { src, url }
	const [near, setNear] = useState(false)

	// close enough to the screen to be worth fetching
	useEffect(() => {
		if (direct || !src) return
		const node = ref.current
		if (!node || typeof IntersectionObserver === 'undefined') {
			setNear(true)
			return
		}
		const watch = new IntersectionObserver((entries) => {
			if (entries.some((entry) => entry.isIntersecting)) {
				setNear(true)
				watch.disconnect()
			}
		}, { rootMargin: '400px' })
		watch.observe(node)
		return () => watch.disconnect()
	}, [src, direct])

	useEffect(() => {
		if (direct || !src || !near) return
		let live = true
		Promise.resolve(storedImage(src, getToken()))
			.then((url) => live && setLoaded({ src, url }))
			.catch(() => live && setLoaded({ src, url: null }))
		return () => { live = false }
	}, [src, near, direct])

	const url = direct ? src : loaded?.src === src ? loaded.url : null

	return (
		<img
			ref={ref}
			src={url || BLANK}
			alt={url ? alt : ''}
			decoding="async"
			className={className}
			style={{ transition: 'opacity 200ms ease', opacity: url ? 1 : 0, ...style }}
			{...rest}
		/>
	)
}
