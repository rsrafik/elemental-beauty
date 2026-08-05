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
					duration-[900ms]
					[transform-style:preserve-3d]
					${flipped ? '[transform:rotateY(180deg)]' : ''}
				`}
			>
				{/* FRONT.

				    The photo sits beside the details while there's room for both;
				    on a narrow card it goes above them instead and stops being a
				    fixed 240px square, because two columns inside a phone-width
				    card leaves neither one usable. */}
				<div className="
					[backface-visibility:hidden]
					bg-salmon
					rounded-[10px]
					p-4
					sm:p-6
					flex
					flex-col
					sm:flex-row
					items-center
					sm:items-stretch
					gap-4
					sm:gap-6
					shadow-[-4px_4px_9px_rgba(0,0,0,0.5)]
				">
					{/* a share of the card rather than a fixed 240px, so the photo
					    gives ground as the card narrows instead of squeezing the
					    details out */}
					<div className="
						bg-neutral-300
						w-full
						max-w-[240px]
						sm:w-[38%]
						aspect-square
						rounded-md
						shrink-0
					" />
					<div className="
						flex-1
						min-w-0
						w-full
						flex
						flex-col
					">
						<h3 className="
							font-starbim
							text-yellow-light
							text-lg
							sm:text-xl
							2xl:text-2xl
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
							flex-col
							sm:flex-row
							gap-2
							sm:gap-3
							items-stretch
							sm:items-end
						">
							<PassField
								label="date joined"
								value="08/24/2026"
								className="sm:flex-1 sm:min-w-0"
							/>
							{/* wraps rather than holding one line: the card gets narrow
							    enough at some widths that a nowrap line here is what
							    would push the whole pass out of its column */}
							<p className="
								font-beachday
								font-bold
								text-[17px]
								sm:text-[20px]
								text-salmon-med
								pb-1
								flex-1
								min-w-0
								leading-tight
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
					p-4
					sm:p-6
					flex
					flex-col
					items-center
					justify-center
					gap-4
					shadow-[-4px_4px_9px_rgba(0,0,0,0.5)]
				">
					{/* the QR has to stay inside the card whatever the card's height
					    is — the front is what sets that, and on a narrow screen the
					    front is much taller than it is wide */}
					<div className="
						bg-neutral-300
						w-[225px]
						max-w-full
						max-h-[60%]
						aspect-square
						rounded-md
					" />
					<p className="
						font-beachday
						font-bold
						text-[17px]
						sm:text-[20px]
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
