'use client'

import { useEffect, useState } from 'react'
import { Popup, PopupButton } from '@/components/labs/LabViewParts'

// Asking before somebody leaves a page with changes they haven't saved.
//
//   useUnsavedChanges(dirty)   a page says it has unsaved work while `dirty`
//   <LeaveGuard />             mounted once, in the root layout: catches the
//                              ways out and asks "discard?" first
//
// The ways out it catches:
//
//   links          any same-tab link to another page — the sidebar, the back
//                  arrow, a card. Caught on the way down (the capture phase,
//                  before React's own handler sees the click), held, and
//                  clicked again for real if they choose to leave.
//   data-leaves-page
//                  a button that leaves without being a link — log out.
//   back/forward   the browser's own buttons. By the time the browser says so
//                  it has already moved, so the guard stops Next.js from
//                  drawing the page it moved to (its listener comes after this
//                  one), steps straight back, and only then asks. Leaving
//                  repeats the step with the guard out of the way.
//   reload, close, typing an address
//                  the browser's own "leave site?" box — it doesn't let a page
//                  draw its own there.
//
// What it doesn't catch is a page moving on by itself — router.push after a
// save or a confirmed discard — which is the page's own decision, not
// somebody walking away from their work.
//
// State is the module's rather than React's: it's one per tab and the
// listeners read it at the moment of the click, not at the last render.

// one token per page currently holding unsaved work
const holds = new Set()
// where that page is — what back/forward has to land on again if they stay
let guardedHref = null
// set while a leave they've agreed to goes through, so the guard doesn't
// stop the very navigation it just let go
let leaving = false
// a back/forward being undone: the step that would redo it, and whether the
// first guess at its direction has already been corrected
let undoing = null

const blocking = () => holds.size > 0 && !leaving

function letGo(go) {
	leaving = true
	go()
	// a link's navigation starts within the click and back/forward's popstate
	// within a few ms; after that the guard is back on in case they stayed
	setTimeout(() => { leaving = false }, 1000)
}

export function useUnsavedChanges(dirty) {
	useEffect(() => {
		if (!dirty) return
		const token = {}
		holds.add(token)
		const onBeforeUnload = (event) => {
			if (leaving) return
			event.preventDefault()
			event.returnValue = ''
		}
		window.addEventListener('beforeunload', onBeforeUnload)
		return () => {
			holds.delete(token)
			window.removeEventListener('beforeunload', onBeforeUnload)
		}
	}, [dirty])

	// kept current every render: a page can change its own address while it
	// has work open (a new lab gets its id on its first save)
	useEffect(() => {
		if (dirty) guardedHref = window.location.href
	})
}

// A link the guard should let past: a new tab, a download, somewhere that
// isn't a page (mailto:), or this same page.
function staysHere(link) {
	if (link.target && link.target !== '_self') return true
	if (link.hasAttribute('download')) return true
	const url = new URL(link.href, window.location.href)
	if (url.protocol !== 'http:' && url.protocol !== 'https:') return true
	const here = window.location
	return url.origin === here.origin && url.pathname === here.pathname && url.search === here.search
}

export function LeaveGuard() {
	// what leaving would do, while the question is up
	const [pending, setPending] = useState(null)

	useEffect(() => {
		const onClick = (event) => {
			if (!blocking()) return
			if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
			const target = event.target.closest?.('a[href], [data-leaves-page]')
			if (!target) return
			if (target.tagName === 'A' && staysHere(target)) return
			event.preventDefault()
			event.stopPropagation()
			setPending(() => () => letGo(() => target.click()))
		}

		const onPopState = (event) => {
			if (leaving) return
			if (undoing) {
				event.stopImmediatePropagation()
				// The first guess is that they went back, so forward one should
				// be where they were. If it isn't, they went forward: two back
				// from here is.
				if (window.location.href !== guardedHref && !undoing.corrected) {
					undoing = { step: 1, corrected: true }
					window.history.go(-2)
					return
				}
				const { step } = undoing
				undoing = null
				setPending(() => () => letGo(() => window.history.go(step)))
				return
			}
			if (!blocking()) return
			event.stopImmediatePropagation()
			undoing = { step: -1, corrected: false }
			window.history.go(1)
		}

		document.addEventListener('click', onClick, true)
		// capture, so it runs ahead of Next.js's own popstate listener
		window.addEventListener('popstate', onPopState, true)
		return () => {
			document.removeEventListener('click', onClick, true)
			window.removeEventListener('popstate', onPopState, true)
		}
	}, [])

	if (!pending) return null
	return (
		<Popup title="unsaved changes" onClose={() => setPending(null)}>
			{(dismiss) => (
				<>
					<p className="
						font-vietnam
						text-sm
						text-black/60
						mt-3
					">
						You have changes on this page that haven&apos;t been saved. If you
						leave now, they&apos;ll be lost.
					</p>
					<div className="
						mt-8
						flex
						justify-end
						gap-3
					">
						<PopupButton onClick={() => dismiss(() => setPending(null))}>keep editing</PopupButton>
						<PopupButton
							danger
							onClick={() => dismiss(() => {
								setPending(null)
								pending()
							})}
						>
							discard
						</PopupButton>
					</div>
				</>
			)}
		</Popup>
	)
}
