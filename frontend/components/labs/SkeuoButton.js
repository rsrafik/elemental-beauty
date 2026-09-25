'use client'

// The design's Framer "SkeuoButton", ported: a raised pill whose fill is a
// gradient worked out from one background colour, with a four-layer outer glow
// and an inner shadow. The styles (and the hover / active / focus states) are
// in globals.css under `.skeuo-btn`; this only fills in the variables.
//
// The defaults are the values from the full-lab design's property panel —
// Be Vietnam Pro Medium 22px, black text with a white text shadow, #FFFBEB
// (or #FFEA75 when selected), gradient on, radius 999, glow light #FFFBEB,
// glow dark #CECFD1, glow size 1, inner shadow #CECFD1.
//
// The panel's border is black with its swatch on the transparency
// checkerboard, so it isn't solid; the 15% here is what the edge of the
// buttons in the mockup measures as.

export default function SkeuoButton({
	children,
	onClick,
	selected = false,
	background = selected ? '#FFEA75' : '#FFFBEB',
	textColor = '#000000',
	textShadowColor = '#FFFFFF',
	useGradient = true,
	borderColor = 'rgba(0, 0, 0, 0.15)',
	radius = 999,
	outerShadow = true,
	highlightColor = '#FFFBEB',
	shadowColor = '#CECFD1',
	shadowSize = 1,
	innerShadowColor = '#CECFD1',
	disabled = false,
	className = '',
	// the label's type — the lab tabs' 22px medium unless a page says otherwise
	textClassName = 'font-medium text-[22px]',
	type = 'button',
	...rest
}) {
	// slightly darker at the bottom, the base colour at 80%, a hair lighter at
	// the top — straight from the Framer component
	const fill = useGradient
		? `linear-gradient(to top,
			color-mix(in srgb, ${background} 85%, black) 0%,
			${background} 80%,
			color-mix(in srgb, ${background} 99%, white) 100%)`
		: background

	const s = shadowSize
	const outer = outerShadow
		? [
			`0 ${4 * s}px ${3 * s}px ${1 * s}px ${highlightColor}`,
			`0 ${6 * s}px ${8 * s}px ${shadowColor}`,
			`0 ${-4 * s}px ${4 * s}px ${shadowColor}`,
			`0 ${-6 * s}px ${4 * s}px ${highlightColor}`,
		].join(', ')
		: '0 0 0 0 transparent'

	return (
		<div className={`relative overflow-visible ${className}`}>
			<button
				type={type}
				className="skeuo-btn"
				disabled={disabled}
				onClick={onClick}
				aria-pressed={selected}
				style={{
					'--skeuo-fill': fill,
					'--skeuo-border': borderColor,
					'--skeuo-radius': `${radius}px`,
					'--skeuo-text': textColor,
					'--skeuo-text-shadow': textShadowColor,
					'--skeuo-outer': outer,
					'--skeuo-inner': innerShadowColor,
				}}
				{...rest}
			>
				<span className={`
					block
					w-full
					m-0
					text-center
					whitespace-nowrap
					font-vietnam
					leading-[1]
					${textClassName}
				`}>
					{children}
				</span>
			</button>
		</div>
	)
}
