'use client'

import { useState } from 'react'

// The salmon membership card. Click it to flip (3D rotateY) between the
// front (member details) and the back (QR code). Front sets the height;
// the back is absolutely stacked on top and pre-rotated 180°, so the card
// keeps the same footprint whichever side is showing.

function PassField({ label, value, className = '' }) {
	return (
		<div className={`
			border-1
			border-salmon-light
			px-2
			py-1
			${className}
		`}>
			<p className="
				font-vietnam
				font-semibold
				text-[13px]
				leading-tight
				text-white/80
			">
				{label}
			</p>
			<p className="
				font-handrawn
				text-[25px]
				leading-tight
				text-black
			">
				{value}
			</p>
		</div>
	)
}

export default function ElementistPass() {
	const [flipped, setFlipped] = useState(false)

	return (
		<div className="[perspective:1200px] select-none">
			<div
				onClick={() => setFlipped((f) => !f)}
				className={`
					relative
					cursor-pointer
					transition-transform
					duration-[600ms]
					[transform-style:preserve-3d]
					${flipped ? '[transform:rotateY(180deg)]' : ''}
				`}
			>
				{/* FRONT */}
				<div className="
					[backface-visibility:hidden]
					bg-salmon
					rounded-[10px]
					p-6
					flex
					gap-6
					shadow-[-4px_4px_9px_rgba(0,0,0,0.5)]
				">
					<div className="
						bg-neutral-300
						w-[240px]
						aspect-square
						rounded-md
						shrink-0
					" />
					<div className="
						flex-1
						flex
						flex-col
					">
						<h3 className="
							font-starbim
							text-yellow-light
							text-2xl
							text-center
							tracking-wide
							whitespace-nowrap
							[-webkit-text-stroke:0.75px_black]
						">
							ELEMENTIST PASS
						</h3>
						<PassField label="username" value="azuazu" />
						<PassField label="first name" value="Azu" />
						<PassField label="last name" value="Nakao" />
						<div className="
							flex
							gap-3
							items-end
						">
							<PassField
								label="date joined"
								value="08/24/2026"
								className="w-40 shrink-0"
							/>
							<p className="
								font-beachday
								font-bold
								text-[20px]
								text-salmon-med
								pb-1
								flex-1
								whitespace-nowrap
								text-center
							">
								CLICK CARD FOR QR CODE
							</p>
						</div>
					</div>
				</div>

				{/* BACK */}
				<div className="
					absolute
					inset-0
					[backface-visibility:hidden]
					[transform:rotateY(180deg)]
					bg-salmon
					rounded-[10px]
					p-6
					flex
					flex-col
					items-center
					justify-center
					gap-4
					shadow-[-4px_4px_9px_rgba(0,0,0,0.5)]
				">
					<div className="
						bg-neutral-300
						w-[225px]
						aspect-square
						rounded-md
					" />
					<p className="
						font-beachday
						font-bold
						text-[20px]
						text-salmon-med
						text-center
					">
						CLICK CARD TO FLIP BACK
					</p>
				</div>
			</div>
		</div>
	)
}
