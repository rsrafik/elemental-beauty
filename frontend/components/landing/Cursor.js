'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'

// A bead of glass that trails the mouse. Over anything carrying `data-cursor`
// it opens and shows that word — "view" on an album card, "join" on a
// call-to-action — so the pointer says what a click will do.
//
// It is display:none on anything without a fine, hovering pointer (see
// app/landing.css), and nothing here runs for those devices either.

export default function Cursor() {
	const beadRef = useRef(null)
	const wordRef = useRef(null)

	useEffect(() => {
		if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
		const bead = beadRef.current
		const word = wordRef.current
		const x = gsap.quickTo(bead, 'x', { duration: 0.5, ease: 'expo.out' })
		const y = gsap.quickTo(bead, 'y', { duration: 0.5, ease: 'expo.out' })

		const onMove = (event) => {
			x(event.clientX)
			y(event.clientY)
			const marked = event.target.closest?.('[data-cursor]')
			if (marked) word.textContent = marked.dataset.cursor
			bead.classList.toggle('is-on', Boolean(marked))
		}
		const onLeave = () => bead.classList.remove('is-on')

		window.addEventListener('pointermove', onMove, { passive: true })
		document.documentElement.addEventListener('pointerleave', onLeave)
		return () => {
			window.removeEventListener('pointermove', onMove)
			document.documentElement.removeEventListener('pointerleave', onLeave)
		}
	}, [])

	return (
		<div
			ref={beadRef}
			aria-hidden="true"
			className="
				lp-cursor
				glass
				pointer-events-none
				fixed
				top-0
				left-0
				z-80
				-mt-[2.6rem]
				-ml-[2.6rem]
				size-[5.2rem]
				place-items-center
				rounded-full
			"
		>
			<span
				ref={wordRef}
				className="
					font-dmmono
					text-[0.68rem]
					font-medium
					tracking-[0.06em]
					uppercase
				"
			/>
		</div>
	)
}
