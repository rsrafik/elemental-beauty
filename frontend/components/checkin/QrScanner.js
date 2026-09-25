'use client'

import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'

// The black square on the check-in page: the camera, with the four yellow
// corner marks to line a member's QR code up in. Every few frames it looks
// for a code, and hands what it finds to `onScan(token)`, which resolves to
// { tone, text } — shown across the bottom of the square for a moment.
//
// The camera only switches itself on when the browser has already been told
// it may; otherwise the square asks to be clicked first, so opening the page
// never springs a permission prompt on anyone.

const SIZE = 231.7
// the corner marks: inset from the edge, how long each arm is, how thick
const INSET = 29.3
const ARM = 57.5
const STROKE = 3.2

// how often a frame is read, and how long the same code is ignored after
// it's been handled (it stays in view while the member walks off)
const SCAN_MS = 200
const REPEAT_MS = 4_000
const FLASH_MS = 3_000

const FLASH_TONES = {
	green: 'bg-green text-[#295212]',
	yellow: 'bg-yellow-light text-[#8A7500]',
	red: 'bg-red text-white',
}

function Corners() {
	const far = SIZE - INSET
	const s = STROKE / 2
	const paths = [
		`M${INSET + s} ${INSET + ARM}V${INSET + s}H${INSET + ARM}`,
		`M${far - ARM} ${INSET + s}H${far - s}V${INSET + ARM}`,
		`M${far - s} ${far - ARM}V${far - s}H${far - ARM}`,
		`M${INSET + ARM} ${far - s}H${INSET + s}V${far - ARM}`,
	]
	return (
		<svg
			viewBox={`0 0 ${SIZE} ${SIZE}`}
			className="
				absolute
				inset-0
				w-full
				h-full
				pointer-events-none
			"
			aria-hidden="true"
		>
			{paths.map((d) => (
				<path key={d} d={d} fill="none" stroke="#FFEA75" strokeWidth={STROKE} />
			))}
		</svg>
	)
}

export default function QrScanner({ onScan }) {
	const videoRef = useRef(null)
	const canvasRef = useRef(null)
	const streamRef = useRef(null)
	const lastRef = useRef({ token: null, at: 0 })
	const handlingRef = useRef(false)
	const onScanRef = useRef(onScan)
	// 'idle' (click to start) | 'starting' | 'live' | 'blocked' | 'none'
	const [state, setState] = useState('idle')
	const [flash, setFlash] = useState(null)

	useEffect(() => {
		onScanRef.current = onScan
	})

	const start = async () => {
		if (!navigator.mediaDevices?.getUserMedia) {
			setState('none')
			return
		}
		setState('starting')
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: 'environment' },
				audio: false,
			})
			streamRef.current = stream
			const video = videoRef.current
			video.srcObject = stream
			await video.play()
			setState('live')
		} catch (err) {
			setState(err?.name === 'NotFoundError' ? 'none' : 'blocked')
		}
	}

	// Switch on straight away only if permission is already there.
	useEffect(() => {
		let live = true
		navigator.permissions?.query({ name: 'camera' })
			.then((status) => {
				if (live && status.state === 'granted') start()
			})
			.catch(() => {})
		return () => {
			live = false
			streamRef.current?.getTracks().forEach((track) => track.stop())
			streamRef.current = null
		}
	}, [])

	// the read loop, while the camera is on
	useEffect(() => {
		if (state !== 'live') return
		const timer = setInterval(async () => {
			const video = videoRef.current
			const canvas = canvasRef.current
			if (!video || !canvas || handlingRef.current || video.readyState < 2) return

			// a smaller frame decodes faster and a QR held up to the camera
			// is plenty big enough to survive it
			const scale = Math.min(1, 480 / Math.max(video.videoWidth, video.videoHeight))
			const w = Math.round(video.videoWidth * scale)
			const h = Math.round(video.videoHeight * scale)
			if (!w || !h) return
			canvas.width = w
			canvas.height = h
			const context = canvas.getContext('2d', { willReadFrequently: true })
			context.drawImage(video, 0, 0, w, h)
			const code = jsQR(context.getImageData(0, 0, w, h).data, w, h, {
				inversionAttempts: 'dontInvert',
			})
			if (!code?.data) return

			const now = Date.now()
			if (code.data === lastRef.current.token && now - lastRef.current.at < REPEAT_MS) return
			lastRef.current = { token: code.data, at: now }

			handlingRef.current = true
			try {
				setFlash(await onScanRef.current(code.data))
			} catch (err) {
				setFlash({ tone: 'red', text: err.message })
			} finally {
				handlingRef.current = false
			}
		}, SCAN_MS)
		return () => clearInterval(timer)
	}, [state])

	useEffect(() => {
		if (!flash) return
		const timer = setTimeout(() => setFlash(null), FLASH_MS)
		return () => clearTimeout(timer)
	}, [flash])

	const prompt = {
		idle: 'click to start scanning',
		starting: 'starting camera…',
		blocked: 'camera blocked — allow it in the address bar, then click',
		none: 'no camera found',
	}[state]

	return (
		<div
			className="
				relative
				shrink-0
				w-[231.7px]
				h-[231.7px]
				bg-black
				overflow-hidden
			"
		>
			<video
				ref={videoRef}
				muted
				playsInline
				className={`
					absolute
					inset-0
					w-full
					h-full
					object-cover
					${state === 'live' ? '' : 'invisible'}
				`}
			/>
			<canvas ref={canvasRef} className="hidden" />
			<Corners />

			{prompt && (
				<button
					type="button"
					onClick={start}
					disabled={state === 'starting' || state === 'none'}
					className="
						absolute
						inset-0
						flex
						items-center
						justify-center
						px-[70px]
						font-vietnam
						font-semibold
						text-[13px]
						leading-snug
						text-center
						text-yellow-light
						cursor-pointer
						disabled:cursor-default
					"
				>
					{prompt}
				</button>
			)}

			{flash && (
				<p
					role="status"
					className={`
						absolute
						left-[8px]
						right-[8px]
						bottom-[8px]
						rounded-[6px]
						px-[8px]
						py-[6px]
						font-vietnam
						font-semibold
						text-[12px]
						leading-tight
						text-center
						menu-open
						${FLASH_TONES[flash.tone]}
					`}
				>
					{flash.text}
				</p>
			)}
		</div>
	)
}
