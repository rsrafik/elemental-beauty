'use client'

import { useEffect, useRef, useState } from 'react'
import 'pdfjs-dist/web/pdf_viewer.css'
import { labs as labsApi } from '@/lib/api'

// The lesson tab: the lab's PDF (uploaded by an officer) in pdf.js's own
// viewer, under the design's orange toolbar instead of pdf.js's grey one.
//
//   sidebar   page thumbnails down the left, click to jump
//   ↑ ↓ / N   previous / next page and the page box (type a number + Enter)
//   − / +     zoom out / in, and the zoom list (automatic, page fit, 50% …)
//   ⛶ ⤓       fullscreen, and download the original file
//
// The toolbar is in the design's pixels like the rest of the page, which is
// zoomed to the window (see Scaled in LabViewParts). The pages are not: they
// sit in a box that undoes that zoom, so pdf.js draws them at the screen's
// real resolution instead of drawing them small and having them stretched.

const ZOOM_PRESETS = [
	['auto', 'automatic zoom'],
	['page-actual', 'actual size'],
	['page-fit', 'page fit'],
	['page-width', 'page width'],
	['0.5', '50%'],
	['0.75', '75%'],
	['1', '100%'],
	['1.25', '125%'],
	['1.5', '150%'],
	['2', '200%'],
	['3', '300%'],
	['4', '400%'],
]

const THUMB_W = 96

// ---- toolbar icons ---------------------------------------------------------
//
// Line icons in the toolbar's cream, drawn to the sizes measured off the
// mockup. `currentColor`, so a disabled button just changes colour.

const ICON = {
	fill: 'none',
	stroke: 'currentColor',
	strokeWidth: 1.6,
	strokeLinecap: 'round',
	strokeLinejoin: 'round',
	'aria-hidden': true,
}

function SidebarIcon(props) {
	return (
		<svg viewBox="0 0 16.3 15.6" {...ICON} {...props}>
			<rect x="0.8" y="0.8" width="14.7" height="14" rx="3" />
			<path d="M6.2 0.8v14" />
			<path d="M4 5.6 2.6 7.8 4 10" />
		</svg>
	)
}

function ArrowIcon({ down = false, ...props }) {
	return (
		<svg viewBox="0 0 12 16" {...ICON} {...props}>
			{down
				? <><path d="M6 1v14" /><path d="M1 10l5 5 5-5" /></>
				: <><path d="M6 15V1" /><path d="M1 6l5-5 5 5" /></>}
		</svg>
	)
}

function MinusIcon(props) {
	return (
		<svg viewBox="0 0 14.2 3" {...ICON} strokeWidth={2} {...props}>
			<path d="M1 1.5h12.2" />
		</svg>
	)
}

function PlusIcon(props) {
	return (
		<svg viewBox="0 0 13.5 12.7" {...ICON} strokeWidth={2} {...props}>
			<path d="M1 6.35h11.5M6.75 1v10.7" />
		</svg>
	)
}

function FullscreenIcon(props) {
	return (
		<svg viewBox="0 0 15.6 16.3" {...ICON} {...props}>
			<path d="M1 5V1h4M10.6 1h4v4M14.6 11.3v4h-4M5 15.3H1v-4" />
		</svg>
	)
}

function DownloadIcon(props) {
	return (
		<svg viewBox="0 0 17.1 16.4" {...ICON} {...props}>
			<path d="M8.55 1v9.6M4.4 6.6l4.15 4.1 4.15-4.1" />
			<path d="M1 11.4v4h15.1v-4" />
		</svg>
	)
}

function ChevronDownIcon(props) {
	return (
		<svg viewBox="0 0 9 6" {...ICON} strokeWidth={1.6} {...props}>
			<path d="M1 1l3.5 3.5L8 1" />
		</svg>
	)
}

// ---- toolbar ---------------------------------------------------------------

// One icon button, placed where the mockup has it. Enabled icons are cream,
// disabled ones the toolbar's pale orange — the ↑ on page one in the design.
function ToolButton({ label, onClick, disabled, style, children }) {
	return (
		<button
			type="button"
			aria-label={label}
			title={label}
			onClick={onClick}
			disabled={disabled}
			className="
				absolute
				flex
				items-center
				justify-center
				text-cream
				disabled:text-orange-lighter
				cursor-pointer
				disabled:cursor-default
				transition-transform
				duration-150
				ease-out
				hover:enabled:scale-110
				active:enabled:scale-95
			"
			style={style}
		>
			{children}
		</button>
	)
}

function Separator({ left }) {
	return (
		<span
			aria-hidden="true"
			className="
				absolute
				top-[2.8px]
				w-[2.2px]
				h-[18px]
				rounded-full
				bg-orange-dark
			"
			style={{ left }}
		/>
	)
}

function Toolbar({
	page,
	pages,
	onPage,
	scaleValue,
	customScale,
	onScale,
	onZoom,
	sidebarOpen,
	onSidebar,
	onFullscreen,
	onDownload,
}) {
	// what's typed in the page box, separate from the page actually showing
	// until Enter (or leaving the box) commits it
	const [draft, setDraft] = useState(null)

	const commit = () => {
		if (draft === null) return
		const n = parseInt(draft, 10)
		if (!Number.isNaN(n)) onPage(Math.min(Math.max(n, 1), pages || 1))
		setDraft(null)
	}

	const isPreset = ZOOM_PRESETS.some(([value]) => value === scaleValue)

	return (
		<div className="
			relative
			h-[24.1px]
			shrink-0
			rounded-t-[8px]
			bg-orange
			select-none
		">
			<ToolButton
				label={sidebarOpen ? 'Hide page thumbnails' : 'Show page thumbnails'}
				onClick={onSidebar}
				style={{ left: 8.5, top: 4.3, width: 16.3, height: 15.6 }}
			>
				<SidebarIcon className="w-full h-full" />
			</ToolButton>

			<ToolButton
				label="Previous page"
				onClick={() => onPage(page - 1)}
				disabled={page <= 1}
				style={{ left: 54.6, top: 4, width: 12, height: 16 }}
			>
				<ArrowIcon className="w-full h-full" />
			</ToolButton>
			<Separator left={72.3} />
			<ToolButton
				label="Next page"
				onClick={() => onPage(page + 1)}
				disabled={page >= pages}
				style={{ left: 80.9, top: 4, width: 12, height: 16 }}
			>
				<ArrowIcon down className="w-full h-full" />
			</ToolButton>

			<input
				type="text"
				inputMode="numeric"
				aria-label="Page"
				value={draft ?? String(page || '')}
				onChange={(event) => setDraft(event.target.value.replace(/\D/g, ''))}
				onFocus={(event) => event.target.select()}
				onBlur={commit}
				onKeyDown={(event) => {
					if (event.key === 'Enter') {
						commit()
						event.currentTarget.blur()
					}
					if (event.key === 'Escape') {
						setDraft(null)
						event.currentTarget.blur()
					}
				}}
				className="
					absolute
					left-[101.4px]
					top-[3.5px]
					w-[28.4px]
					h-[15px]
					rounded-[2px]
					bg-orange-lighter
					px-[3px]
					text-right
					font-vietnam
					text-[9px]
					leading-none
					text-orange-dark
					outline-none
					focus:ring-1
					focus:ring-cream
				"
			/>
			<span className="
				absolute
				left-[136.2px]
				top-0
				h-[24.1px]
				flex
				items-center
				font-vietnam
				text-[9px]
				text-orange-dark
			">
				of {pages || '–'}
			</span>

			{/* The zoom controls, as one group centred on the bar: − | + and
			    the zoom list, spaced as the mockup has them. */}
			<div className="
				absolute
				top-0
				left-1/2
				-translate-x-1/2
				w-[216.5px]
				h-full
			">
			<ToolButton
				label="Zoom out"
				onClick={() => onZoom(-1)}
				style={{ left: 0, top: 10.55, width: 14.2, height: 3 }}
			>
				<MinusIcon className="w-full h-full overflow-visible" />
			</ToolButton>
			<Separator left={23.4} />
			<ToolButton
				label="Zoom in"
				onClick={() => onZoom(1)}
				style={{ left: 34.1, top: 5.7, width: 13.5, height: 12.7 }}
			>
				<PlusIcon className="w-full h-full overflow-visible" />
			</ToolButton>

			{/* a real <select> for the keyboard and screen readers, dressed as
			    the design's pale pill with its chevron. The padding is the same
			    on both sides so the label centres in the pill itself, not in
			    the part of it left of the chevron. */}
			<div className="
				absolute
				left-[57.5px]
				top-[1.5px]
				w-[159px]
				h-[21px]
			">
				<select
					aria-label="Zoom"
					value={isPreset ? scaleValue : 'custom'}
					onChange={(event) => onScale(event.target.value)}
					className="
						block
						w-full
						h-full
						appearance-none
						rounded-[3px]
						bg-[#FDEBE6]
						px-[22px]
						text-center
						[text-align-last:center]
						font-vietnam
						text-[11px]
						text-black/50
						outline-none
						cursor-pointer
						focus-visible:ring-1
						focus-visible:ring-cream
					"
				>
					{!isPreset && (
						<option value="custom" disabled>
							{customScale}
						</option>
					)}
					{ZOOM_PRESETS.map(([value, label]) => (
						<option key={value} value={value}>{label}</option>
					))}
				</select>
				<ChevronDownIcon className="
					pointer-events-none
					absolute
					right-[10px]
					top-1/2
					-translate-y-1/2
					w-[9px]
					h-[6px]
					text-black/50
				" />
			</div>
			</div>

			<ToolButton
				label="Fullscreen"
				onClick={onFullscreen}
				style={{ right: 40.5, top: 2.8, width: 15.6, height: 16.3 }}
			>
				<FullscreenIcon className="w-full h-full" />
			</ToolButton>
			<ToolButton
				label="Download"
				onClick={onDownload}
				style={{ right: 7.1, top: 3.5, width: 17.1, height: 16.4 }}
			>
				<DownloadIcon className="w-full h-full" />
			</ToolButton>
		</div>
	)
}

// ---- thumbnails ------------------------------------------------------------

function Thumbnail({ doc, number, active, onClick }) {
	const canvasRef = useRef(null)

	useEffect(() => {
		let task = null
		let live = true
		doc.getPage(number).then((page) => {
			if (!live) return
			const base = page.getViewport({ scale: 1 })
			const ratio = window.devicePixelRatio || 1
			const viewport = page.getViewport({ scale: (THUMB_W / base.width) * ratio })
			const canvas = canvasRef.current
			if (!canvas) return
			canvas.width = viewport.width
			canvas.height = viewport.height
			task = page.render({ canvas, viewport })
			task.promise.catch(() => {})
		})
		return () => {
			live = false
			task?.cancel()
		}
	}, [doc, number])

	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={`Page ${number}`}
			aria-current={active ? 'page' : undefined}
			className="
				flex
				flex-col
				items-center
				gap-1
				cursor-pointer
				group
			"
		>
			<canvas
				ref={canvasRef}
				className={`
					bg-white
					shadow-[0_1px_3px_rgba(0,0,0,0.25)]
					outline-offset-2
					transition-[outline-color]
					duration-150
					${active
						? 'outline-2 outline-orange'
						: 'outline-2 outline-transparent group-hover:outline-orange-lighter'}
				`}
				style={{ width: THUMB_W }}
			/>
			<span className="
				font-vietnam
				text-[11px]
				text-black/60
			">
				{number}
			</span>
		</button>
	)
}

// ---- viewer ----------------------------------------------------------------

export default function LabLesson({ labId, fileName, zoom = 1, style }) {
	const rootRef = useRef(null)
	const containerRef = useRef(null)
	const viewerRef = useRef(null)
	const pdfViewer = useRef(null)
	const bytes = useRef(null)

	const [doc, setDoc] = useState(null)
	const [error, setError] = useState(null)
	const [page, setPage] = useState(1)
	const [pages, setPages] = useState(0)
	const [scaleValue, setScaleValue] = useState('auto')
	const [customScale, setCustomScale] = useState('')
	const [sidebarOpen, setSidebarOpen] = useState(false)

	// Load pdf.js on the client only (it wants a DOM and a worker), fetch the
	// file through the authenticated endpoint, and hand it to pdf.js's viewer.
	useEffect(() => {
		let live = true
		let task = null
		let viewer = null

		async function start() {
			try {
				const pdfjs = await import('pdfjs-dist')
				pdfjs.GlobalWorkerOptions.workerSrc = new URL(
					'pdfjs-dist/build/pdf.worker.min.mjs',
					import.meta.url
				).toString()
				// pdf_viewer reads the library off the global rather than
				// importing it, so it has to be there before the import
				globalThis.pdfjsLib = pdfjs
				const { EventBus, PDFLinkService, PDFViewer, LinkTarget } =
					await import('pdfjs-dist/web/pdf_viewer.mjs')

				const data = await labsApi.lesson(labId)
				if (!live) return
				// pdf.js takes the buffer over, so keep a copy for the download
				bytes.current = data.slice()

				const eventBus = new EventBus()
				const linkService = new PDFLinkService({
					eventBus,
					externalLinkTarget: LinkTarget.BLANK,
				})
				viewer = new PDFViewer({
					container: containerRef.current,
					viewer: viewerRef.current,
					eventBus,
					linkService,
					removePageBorders: true,
				})
				linkService.setViewer(viewer)
				pdfViewer.current = viewer

				eventBus.on('pagesinit', () => {
					viewer.currentScaleValue = 'auto'
				})
				eventBus.on('pagechanging', ({ pageNumber }) => setPage(pageNumber))
				eventBus.on('scalechanging', ({ scale, presetValue }) => {
					setScaleValue(presetValue ?? String(scale))
					setCustomScale(`${Math.round(scale * 100)}%`)
				})

				// the loading task is the handle that tears the document (and its
				// worker) down again — the document itself has no destroy
				task = pdfjs.getDocument({ data })
				const loaded = await task.promise
				if (!live) return
				viewer.setDocument(loaded)
				linkService.setDocument(loaded)
				setDoc(loaded)
				setPages(loaded.numPages)
				setPage(1)
			} catch (err) {
				if (live) setError(err?.message || 'Could not open the lesson.')
			}
		}

		start()
		return () => {
			live = false
			viewer?.cleanup?.()
			task?.destroy()
			pdfViewer.current = null
		}
	}, [labId])

	const goTo = (n) => {
		const viewer = pdfViewer.current
		if (!viewer || !pages) return
		viewer.currentPageNumber = Math.min(Math.max(n, 1), pages)
	}

	const setScale = (value) => {
		const viewer = pdfViewer.current
		if (!viewer) return
		viewer.currentScaleValue = value
	}

	const zoomBy = (steps) => {
		const viewer = pdfViewer.current
		if (!viewer) return
		if (steps > 0) viewer.increaseScale()
		else viewer.decreaseScale()
	}

	const fullscreen = () => {
		const root = rootRef.current
		if (!root) return
		if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
		else root.requestFullscreen?.().catch(() => {})
	}

	const download = () => {
		if (!bytes.current) return
		const url = URL.createObjectURL(new Blob([bytes.current], { type: 'application/pdf' }))
		const link = document.createElement('a')
		link.href = url
		link.download = fileName || 'lesson.pdf'
		document.body.appendChild(link)
		link.click()
		link.remove()
		setTimeout(() => URL.revokeObjectURL(url), 1000)
	}

	return (
		<div
			ref={rootRef}
			className="
				flex
				flex-col
				bg-white
			"
			style={style}
		>
			<Toolbar
				page={page}
				pages={pages}
				onPage={goTo}
				scaleValue={scaleValue}
				customScale={customScale}
				onScale={setScale}
				onZoom={zoomBy}
				sidebarOpen={sidebarOpen}
				onSidebar={() => setSidebarOpen((open) => !open)}
				onFullscreen={fullscreen}
				onDownload={download}
			/>

			<div className="
				relative
				flex-1
				min-h-0
				border-x
				border-[#C2B3A1]
			">
				{/* back to the screen's own scale for everything pdf.js draws */}
				<div
					className="
						absolute
						inset-0
						flex
					"
					style={{ zoom: 1 / zoom }}
				>
					{sidebarOpen && doc && (
						<aside
							aria-label="Pages"
							className="
								shrink-0
								w-[132px]
								overflow-y-auto
								border-r
								border-[#C2B3A1]
								bg-[#FDEBE6]
								py-4
								flex
								flex-col
								items-center
								gap-4
							"
						>
							{Array.from({ length: pages }, (_, i) => (
								<Thumbnail
									key={i}
									doc={doc}
									number={i + 1}
									active={page === i + 1}
									onClick={() => goTo(i + 1)}
								/>
							))}
						</aside>
					)}

					<div className="
						relative
						flex-1
						min-w-0
					">
						{/* pdf.js insists its container is absolutely positioned */}
						<div
							ref={containerRef}
							className="
								lab-lesson
								absolute
								inset-0
								overflow-auto
								bg-white
							"
						>
							<div ref={viewerRef} className="pdfViewer" />
						</div>

						{(error || !doc) && (
							<div className="
								absolute
								inset-0
								flex
								items-center
								justify-center
								font-vietnam
								text-[14px]
								text-black/50
								pointer-events-none
							">
								{error ?? 'loading the lesson…'}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}
