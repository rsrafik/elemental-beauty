'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDismiss } from '@/lib/dismiss'

// The waiver, to be read and signed: /waiver.pdf drawn page by page into a
// scrolling box, and under it a first name, a last name and "sign". Those
// stay locked until the box has been scrolled to the very end, so nobody signs
// something they haven't at least scrolled past.
//
// The pages are drawn with pdf.js rather than shown in the browser's own PDF
// viewer because an embedded viewer won't say how far it's been scrolled.
//
// `onSign({ firstName, lastName })` does the saving and throws if it's
// refused (the name has to match the account's); the popup shows why.

const WAIVER_URL = '/waiver.pdf'

// how close to the bottom counts as the bottom, for trackpads that stop a
// pixel or two short
const SLACK = 8

function CloseIcon({ className }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={className} aria-hidden="true">
			<path d="M6 6l12 12M18 6L6 18" />
		</svg>
	)
}

const FIELD = `
	w-full
	rounded-[10px]
	border
	border-black/25
	bg-white
	px-4
	py-2.5
	font-vietnam
	text-sm
	text-black
	outline-none
	transition-colors
	duration-200
	focus:border-black
	disabled:bg-black/[0.04]
	disabled:text-black/30
	disabled:cursor-not-allowed
`

export default function WaiverPopup({ onClose, onSign }) {
	const { closing, dismiss } = useDismiss()
	const close = () => dismiss(onClose)

	const scroller = useRef(null)
	const pagesRef = useRef(null)
	const [loaded, setLoaded] = useState(false)
	const [loadError, setLoadError] = useState(null)
	const [atEnd, setAtEnd] = useState(false)
	const [name, setName] = useState({ first: '', last: '' })
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState(null)

	useEffect(() => {
		const onKey = (event) => {
			if (event.key === 'Escape' && !busy) close()
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	})

	// Draw every page, at the box's width and the screen's pixel density so
	// the text is crisp.
	useEffect(() => {
		let live = true
		let task = null

		async function draw() {
			try {
				const pdfjs = await import('pdfjs-dist')
				pdfjs.GlobalWorkerOptions.workerSrc = new URL(
					'pdfjs-dist/build/pdf.worker.min.mjs',
					import.meta.url
				).toString()
				task = pdfjs.getDocument({ url: WAIVER_URL })
				const doc = await task.promise
				const holder = pagesRef.current
				if (!live || !holder) return
				const width = holder.clientWidth
				const dpr = window.devicePixelRatio || 1

				for (let n = 1; n <= doc.numPages; n++) {
					const page = await doc.getPage(n)
					if (!live) return
					const scale = width / page.getViewport({ scale: 1 }).width
					const viewport = page.getViewport({ scale: scale * dpr })
					const canvas = document.createElement('canvas')
					canvas.width = Math.floor(viewport.width)
					canvas.height = Math.floor(viewport.height)
					canvas.style.width = '100%'
					canvas.style.display = 'block'
					canvas.className = 'bg-white shadow-[0_1px_4px_rgba(0,0,0,0.15)]'
					canvas.setAttribute('aria-label', `Waiver page ${n} of ${doc.numPages}`)
					holder.appendChild(canvas)
					await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport }).promise
				}
				if (!live) return
				setLoaded(true)
				// a waiver short enough to fit without scrolling counts as read
				const box = scroller.current
				if (box && box.scrollHeight <= box.clientHeight + SLACK) setAtEnd(true)
			} catch (err) {
				if (live) setLoadError(err?.message || 'Could not open the waiver.')
			}
		}

		draw()
		return () => {
			live = false
			task?.destroy()
		}
	}, [])

	const check = () => {
		const el = scroller.current
		if (!el || !loaded) return
		if (el.scrollTop + el.clientHeight >= el.scrollHeight - SLACK) setAtEnd(true)
	}

	const ready = atEnd && name.first.trim() !== '' && name.last.trim() !== '' && !busy

	const sign = async (event) => {
		event.preventDefault()
		if (!ready) return
		setBusy(true)
		setError(null)
		try {
			await onSign({ firstName: name.first.trim(), lastName: name.last.trim() })
			dismiss(onClose)
		} catch (err) {
			setError(err.message)
			setBusy(false)
		}
	}

	const set = (field) => (event) => {
		setName((prev) => ({ ...prev, [field]: event.target.value }))
		setError(null)
	}

	return createPortal(
		<div
			className={`
				fixed
				inset-0
				z-50
				flex
				items-center
				justify-center
				bg-black/40
				p-3
				sm:p-6
				${closing ? 'dialog-leaving' : 'dialog-open'}
			`}
			onClick={() => !busy && close()}
		>
			<form
				onClick={(event) => event.stopPropagation()}
				onSubmit={sign}
				role="dialog"
				aria-modal="true"
				aria-label="Membership waiver"
				className="
					w-full
					max-w-[760px]
					h-[92dvh]
					flex
					flex-col
					bg-cream
					rounded-[20px]
					p-5
					sm:p-7
					shadow-[0_10px_40px_rgba(0,0,0,0.35)]
				"
			>
				<div className="
					shrink-0
					flex
					items-start
					justify-between
					gap-4
				">
					<div>
						<h2 className="
							font-beachday
							text-black
							text-[32px]
							sm:text-[38px]
							leading-none
						">
							waiver
						</h2>
						<p className="
							font-vietnam
							text-sm
							text-black/60
							mt-2
						">
							Read it through to the end, then sign with your name.
						</p>
					</div>
					<button
						type="button"
						onClick={close}
						aria-label="Close"
						className="
							w-9
							h-9
							shrink-0
							flex
							items-center
							justify-center
							rounded-full
							bg-black
							text-cream
							cursor-pointer
							transition-all
							duration-200
							ease-out
							hover:brightness-125
							active:scale-95
						"
					>
						<CloseIcon className="w-4 h-4" />
					</button>
				</div>

				<div
					ref={scroller}
					onScroll={check}
					className="
						mt-4
						flex-1
						min-h-0
						overflow-y-auto
						rounded-[12px]
						bg-black/[0.06]
						p-3
						sm:p-4
					"
				>
					<div
						ref={pagesRef}
						className="
							flex
							flex-col
							gap-3
						"
					/>
					{!loaded && !loadError && (
						<p className="
							py-20
							text-center
							font-vietnam
							text-sm
							text-black/40
						">
							opening the waiver…
						</p>
					)}
					{loadError && (
						<p className="
							py-20
							text-center
							font-vietnam
							text-sm
							text-salmon-dark
						">
							{loadError}
						</p>
					)}
				</div>

				<div className="shrink-0 mt-4">
					<p className={`
						font-vietnam
						text-[12px]
						font-semibold
						${atEnd ? 'text-green-dark' : 'text-black/45'}
					`}>
						{atEnd
							? 'Type your first and last name as they are on your account to sign.'
							: 'Scroll to the end of the waiver to sign it.'}
					</p>
					<div className="
						mt-2
						flex
						flex-col
						sm:flex-row
						gap-3
					">
						<input
							type="text"
							value={name.first}
							onChange={set('first')}
							disabled={!atEnd || busy}
							placeholder="first name"
							aria-label="First name"
							autoComplete="given-name"
							className={FIELD}
						/>
						<input
							type="text"
							value={name.last}
							onChange={set('last')}
							disabled={!atEnd || busy}
							placeholder="last name"
							aria-label="Last name"
							autoComplete="family-name"
							className={FIELD}
						/>
						<button
							type="submit"
							disabled={!ready}
							className={`
								shrink-0
								rounded-full
								px-8
								py-2.5
								font-vietnam
								font-semibold
								text-sm
								transition-all
								duration-200
								ease-out
								${ready
									? `bg-black
									   text-cream
									   cursor-pointer
									   hover:-translate-y-0.5
									   hover:shadow-lg
									   hover:shadow-black/25
									   active:translate-y-0
									   active:shadow-none`
									: 'bg-black/10 text-black/35 cursor-not-allowed'}
							`}
						>
							{busy ? 'signing…' : 'sign'}
						</button>
					</div>
					{error && (
						<p className="
							mt-2
							font-vietnam
							text-sm
							text-salmon-dark
						">
							{error}
						</p>
					)}
				</div>
			</form>
		</div>,
		document.body
	)
}
