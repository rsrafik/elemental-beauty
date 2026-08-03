'use client'

import { useEffect, useRef, useState } from 'react'

// Letting a popup animate on its way out.
//
// React takes a dialog off the screen the moment the state that held it open
// goes false, which leaves nowhere for an exit animation to happen. This keeps
// it on screen for the length of that animation: `dismiss` marks it as closing
// — which is what puts the `dialog-leaving` class on it — and only runs the
// thing that actually closes it once the animation has played.
//
//   const { closing, dismiss } = useDismiss()
//   ...
//   <Dialog closing={closing} onClose={() => dismiss(onClose)} />
//
// Anything that ends the dialog goes through `dismiss`, including saving:
// `dismiss(() => onSave(values))` writes the change on the way out, so the card
// doesn't vanish mid-flight.

// Matches the exit animations in globals.css. If they change, this changes.
export const EXIT_MS = 160

export function useDismiss(exit = EXIT_MS) {
	const [closing, setClosing] = useState(false)
	const queued = useRef(null)

	useEffect(() => {
		if (!closing) return
		const timer = setTimeout(() => queued.current?.(), exit)
		return () => clearTimeout(timer)
	}, [closing, exit])

	// A second click while it's already on its way out would restart the timer
	// and could run the wrong thing, so the first one wins.
	const dismiss = (run) => {
		if (closing) return
		queued.current = run
		setClosing(true)
	}

	return { closing, dismiss }
}
