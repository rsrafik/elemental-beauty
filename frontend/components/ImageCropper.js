'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import ReactCrop from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { cropToDataUrl } from '@/lib/images'

// The cropper every picture picker opens. The box over the picture has the
// shape of the frame the picture will be shown in (a frame from FRAMES in
// lib/images.js): its corners scale it up and down without changing that
// shape, and dragging inside it moves it. Beside it, the frame itself shows
// what's in the box, so what's saved is exactly what will fit.
//
// What's saved is the cropped picture (a JPEG data URL at the frame's shape),
// not the original and a rectangle: pictures are stored as data URLs and every
// frame draws them with object-cover, so a picture already at its frame's
// shape shows whole, everywhere, with nothing else having to know about crops.
//
//   const [crop, cropper] = useImageCrop()
//   const pick = (event) => {
//       const file = event.target.files?.[0]
//       crop(file, FRAMES.cover).then((url) => url && setImage(url)).catch(...)
//   }
//   ...
//   {cropper}
//
// `crop` resolves to the data URL, to null if the person cancels, and rejects
// if the file isn't a picture the browser can open.
export function useImageCrop() {
	// { src, frame, resolve, reject, id }: src is the picked file as an address
	// the <img> can show, let go of once the cropper's done with it
	const [job, setJob] = useState(null)
	const crop = useCallback((file, frame) => new Promise((resolve, reject) => {
		setJob({ src: URL.createObjectURL(file), frame, resolve, reject, id: Date.now() })
	}), [])

	const end = (run) => {
		run()
		URL.revokeObjectURL(job.src)
		setJob(null)
	}

	const cropper = job && typeof document !== 'undefined'
		? createPortal(
			<ImageCropper
				key={job.id}
				src={job.src}
				frame={job.frame}
				onDone={(url) => end(() => job.resolve(url))}
				onCancel={() => end(() => job.resolve(null))}
				onError={(error) => end(() => job.reject(error))}
			/>,
			document.body,
		)
		: null

	return [crop, cropper]
}

// The biggest box of the frame's shape that fits the picture, in the middle
// (in percent of the picture, which is what ReactCrop is handed)
function fullCrop(width, height, aspect) {
	const wide = width / height > aspect
	const w = wide ? (height * aspect / width) * 100 : 100
	const h = wide ? 100 : (width / aspect / height) * 100
	return { unit: '%', x: (100 - w) / 2, y: (100 - h) / 2, width: w, height: h }
}

const ROUNDING = { rect: 'rounded-[10px]', circle: 'rounded-full', pill: 'rounded-full' }

export default function ImageCropper({ src, frame, onDone, onCancel, onError }) {
	const image = useRef(null)
	const dialog = useRef(null)
	const row = useRef(null)
	const box = useRef(null)
	const [crop, setCrop] = useState(null)
	// how tall the picture may be drawn so the whole popup fits on the screen
	// without scrolling (null until it's been measured)
	const [fit, setFit] = useState(null)

	// The popup is as tall as it can be (its max-height) less everything in
	// it that isn't the picture; the picture gets what's left. Measured off
	// the popup as it stands, so the title wrapping on a narrow screen or the
	// preview dropping under the picture is counted in.
	const measure = () => {
		const node = dialog.current
		const img = image.current
		if (!node || !img || !row.current || !box.current) return
		const stacked = getComputedStyle(row.current).flexDirection === 'column'
		const picture = img.getBoundingClientRect().height
		// the row is as tall as the picture's box, or as the preview beside it
		const rowTaken = stacked ? box.current.offsetHeight : row.current.offsetHeight
		const others = node.scrollHeight - rowTaken + (box.current.offsetHeight - picture)
		const room = parseFloat(getComputedStyle(node).maxHeight) || window.innerHeight * 0.92
		setFit(Math.max(160, Math.floor(room - others)))
	}

	useEffect(() => {
		window.addEventListener('resize', measure)
		return () => window.removeEventListener('resize', measure)
	})

	// Escape cancels the cropper only, not the dialog it was opened from
	// (those listen on window too, after this)
	useEffect(() => {
		const onKey = (event) => {
			if (event.key !== 'Escape') return
			event.stopPropagation()
			event.preventDefault()
			onCancel()
		}
		window.addEventListener('keydown', onKey, true)
		return () => window.removeEventListener('keydown', onKey, true)
	}, [onCancel])

	const loaded = (event) => {
		const { naturalWidth, naturalHeight } = event.currentTarget
		setCrop(fullCrop(naturalWidth, naturalHeight, frame.aspect))
		measure()
	}

	const save = () => {
		const img = image.current
		if (!img || !crop) return
		const area = {
			x: (crop.x / 100) * img.naturalWidth,
			y: (crop.y / 100) * img.naturalHeight,
			width: (crop.width / 100) * img.naturalWidth,
			height: (crop.height / 100) * img.naturalHeight,
		}
		try {
			onDone(cropToDataUrl(img, area, frame))
		} catch {
			onError(new Error('Could not crop that image'))
		}
	}

	// the preview: the frame, at most 180px on its longer side
	const previewSize = frame.aspect >= 1
		? { width: 180, height: 180 / frame.aspect }
		: { width: 180 * frame.aspect, height: 180 }

	return (
		<div
			className="
				fixed
				inset-0
				z-[200]
				flex
				items-center
				justify-center
				bg-black/55
				p-4
				sm:p-8
				dialog-open
			"
			onClick={(event) => {
				event.stopPropagation()
				onCancel()
			}}
		>
			<div
				ref={dialog}
				role="dialog"
				aria-modal="true"
				aria-label="Crop the picture"
				onClick={(event) => event.stopPropagation()}
				className="
					w-full
					max-w-[900px]
					max-h-[92dvh]
					overflow-y-auto
					bg-cream
					rounded-[20px]
					p-5
					sm:p-8
					shadow-[0_10px_40px_rgba(0,0,0,0.35)]
				"
			>
				<h2 className="
					font-beachday
					text-black
					text-[28px]
					sm:text-[38px]
					leading-none
				">
					crop the picture
				</h2>
				<p className="
					mt-2
					font-vietnam
					text-sm
					text-black/55
				">
					Drag a corner to make the box bigger or smaller, and drag inside it to
					move it. What&rsquo;s in the box is exactly what shows in {frame.label}.
				</p>

				<div ref={row} className="
					mt-6
					flex
					flex-col
					items-center
					gap-6
					md:flex-row
					md:items-start
				">
					<div ref={box} className="
						flex
						min-w-0
						flex-1
						justify-center
						rounded-[12px]
						bg-black/5
						p-2
					">
						{src && (
							<ReactCrop
								crop={crop ?? undefined}
								onChange={(_, percent) => setCrop(percent)}
								aspect={frame.aspect}
								circularCrop={frame.shape === 'circle'}
								keepSelection
								minWidth={32}
								minHeight={32}
								className="max-w-full"
							>
								{/* eslint-disable-next-line @next/next/no-img-element */}
								<img
									ref={image}
									src={src}
									alt="The picture being cropped"
									onLoad={loaded}
									onError={() => onError(new Error('That file isn’t an image'))}
									style={{ maxHeight: fit ?? '50dvh' }}
									className="
										block
										max-w-full
										select-none
									"
								/>
							</ReactCrop>
						)}
					</div>

					<div className="
						flex
						shrink-0
						flex-col
						items-center
						gap-2
					">
						<div
							style={previewSize}
							className={`
								relative
								overflow-hidden
								bg-white
								shadow-[0_4px_14px_rgba(0,0,0,0.18)]
								${ROUNDING[frame.shape] || ROUNDING.rect}
							`}
						>
							{src && crop && crop.width > 0 && crop.height > 0 && (
								// eslint-disable-next-line @next/next/no-img-element
								<img
									src={src}
									alt=""
									aria-hidden="true"
									style={{
										position: 'absolute',
										maxWidth: 'none',
										width: `${10000 / crop.width}%`,
										height: `${10000 / crop.height}%`,
										left: `${(-crop.x / crop.width) * 100}%`,
										top: `${(-crop.y / crop.height) * 100}%`,
									}}
								/>
							)}
						</div>
						<p className="
							font-vietnam
							text-xs
							text-black/45
						">
							how it&rsquo;ll look
						</p>
					</div>
				</div>

				<div className="
					mt-8
					flex
					justify-end
					gap-3
				">
					<button
						type="button"
						onClick={onCancel}
						className="
							rounded-full
							border
							border-black/70
							px-6
							py-2
							font-vietnam
							font-semibold
							text-sm
							text-black
							cursor-pointer
							transition-all
							duration-200
							ease-out
							hover:-translate-y-0.5
							hover:shadow-lg
							hover:shadow-black/10
						"
					>
						cancel
					</button>
					<button
						type="button"
						onClick={save}
						disabled={!crop}
						className={`
							rounded-full
							px-6
							py-2
							font-vietnam
							font-semibold
							text-sm
							transition-all
							duration-200
							ease-out
							${crop
								? 'bg-salmon text-white cursor-pointer hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20'
								: 'bg-black/10 text-black/40 cursor-not-allowed'}
						`}
					>
						use this crop
					</button>
				</div>
			</div>
		</div>
	)
}
