'use client'

import { useLayoutEffect, useRef } from 'react'

// A heading as big as it's designed to be when it fits, and smaller when it
// doesn't. A long lab or event title — "Meet Wenrui Chen: Cosmetic Chemist at
// Innacos Labs" — would otherwise run to three or four lines at display size
// and shove everything under it down the page: the check-in page's buttons and
// lists, the member lab page's section buttons off the bottom of the window.
//
// It starts at the size its classes give it and steps down 2px at a time until
// the text sits on `lines` lines, never below `min`. Give it a line height
// relative to the size (`leading-[1.2]`, not a px value), or a shrunk title
// keeps the gaps of the big one.
//
// Lines are counted from the text's own line boxes rather than worked out from
// the height, because both pages sit inside a `zoom` (useDesignZoom) and
// heights read back scaled while the font size doesn't.
//
// `fits`, if given, is a second test the title keeps shrinking for — the member
// lab page passes "the section buttons end inside the window" — so a short
// window gets a smaller title even when two lines would do on a tall one. It
// runs after each step, once the new size is laid out.
//
// Refits when its column changes width, when the window is resized (which is
// what moves the answer to `fits`), and once the fonts have loaded — measured
// in the fallback face, a title can fit that won't in the real one.

function linesOf(element) {
	const range = document.createRange()
	range.selectNodeContents(element)
	return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size
}

export default function FitTitle({ text, className = '', lines = 2, min = 26, fits }) {
	const ref = useRef(null)

	useLayoutEffect(() => {
		const element = ref.current
		if (!element) return

		const fit = () => {
			element.style.fontSize = ''
			let size = parseFloat(getComputedStyle(element).fontSize)
			const ok = () => linesOf(element) <= lines && (!fits || fits())
			while (!ok() && size > min) {
				size = Math.max(min, size - 2)
				element.style.fontSize = `${size}px`
			}
		}
		fit()

		// the width is the only thing that changes the answer — the title's own
		// height moves every time it's refitted, so that's not watched
		let width = element.parentElement.clientWidth
		const observer = new ResizeObserver(() => {
			const next = element.parentElement.clientWidth
			if (next === width) return
			width = next
			fit()
		})
		observer.observe(element.parentElement)
		if (fits) window.addEventListener('resize', fit)
		let live = true
		document.fonts?.ready.then(() => live && fit())

		return () => {
			live = false
			observer.disconnect()
			if (fits) window.removeEventListener('resize', fit)
		}
	}, [text, lines, min, fits])

	return <h1 ref={ref} className={className}>{text}</h1>
}
