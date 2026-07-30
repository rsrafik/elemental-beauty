import Sidebar from '@/components/dashboards/Sidebar'

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

function StatCard({ title, value, bg, valueColor }) {
	return (
		<div className={`
			rounded-[30px]
			p-6
			min-h-[150px]
			flex
			flex-col
            items-center
			${bg}
            shadow-[-4px_4px_8px_rgba(0,0,0,0.5)]
		`}>
			<p className="
				font-vietnam
				font-semibold
				text-lg
				text-black
			">
				{title}
			</p>
			<p className={`
				font-beachday
				text-[50px]
				mt-auto
				${valueColor}
			`}>
				{value}
			</p>
		</div>
	)
}

function Stamp({ day, date, note, style, rotate = 0 }) {
	// Position + rotation live on this one wrapper. Everything inside
	// (stamp, pin, text) rotates with it automatically — no per-item angles.
	//
	// `center` = horizontal distance (px) of the stamp's center from the green
	// panel's center x-axis. 0 = dead center, negative = left, positive = right.
	// (90px below is half the stamp width, 180 / 2.)
	const { center = 0, ...pos } = style
	const sign = center < 0 ? '-' : '+'
	// rotate lives on the outer div (inline), so hover:scale goes on the inner
	// wrapper — otherwise the inline transform would override the scale.
	return (
		<div
			className="group absolute w-[180px] h-[236px] cursor-pointer hover:z-20"
			style={{
				...pos,
				left: `calc(50% - 90px ${sign} ${Math.abs(center)}px)`,
				transform: `rotate(${rotate}deg)`,
			}}
		>
			<div className="
				relative
				w-full
				h-full
				transition-transform
				duration-200
				ease-out
				group-hover:scale-105
			">
				{/* white base stays fully opaque — the yellow just fades in on top,
				    so the stamp never goes see-through and reveals the ones behind */}
				<img
					src="/stamp.png"
					alt=""
					className="
						absolute
						inset-0
						w-full
						h-full
						select-none
					"
				/>
				<img
					src="/stamp-yellow.png"
					alt=""
					className="
						absolute
						inset-0
						w-full
						h-full
						select-none
						opacity-0
						transition-opacity
						duration-200
						group-hover:opacity-100
					"
				/>
				<img
					src="/pin.png"
					alt=""
					className="
						absolute
						top-[20px]
						left-1/2
						-translate-x-1/2
						w-9
						select-none
					"
				/>
				<div className="
					absolute
					inset-0
					flex
					flex-col
					items-center
					justify-center
					px-6
					text-center
				">
					<p className="
						font-beautifulbg
						text-[30px]
						text-black
					">
						{day} <span className="
							text-lg
							align-baseline
						">{date}</span>
					</p>
					<p className="
						font-handrawn
						text-[20px]
						text-black
						mt-3
						leading-tight
						w-full
					">
						{note}
					</p>
				</div>
			</div>
		</div>
	)
}

// ---- data ------------------------------------------------------------------

// Per-stamp layout inside the group box (GROUP_W × GROUP_H, centered in the panel).
//   top    = px distance from the top of the group.
//   center = px distance of the stamp's center from the panel's center x-axis
//            (0 = centered, negative = left, positive = right).
//   rotate = tilt in degrees.
const GROUP_W = 395
const GROUP_H = 851

const upcoming = [
	{ day: 'Mon.', date: '27', note: 'none', style: { top: '30px', center: -70 }, rotate: -11 },
	{ day: 'Tues.', date: '28', note: 'bubbles & beakers p.1', style: { top: '155px', center: 75 }, rotate: 7 },
	{ day: 'Wed.', date: '29', note: 'none', style: { top: '305px', center: -75 }, rotate: -23 },
	{ day: 'Thurs.', date: '30', note: 'bubbles & beakers p.2', style: { top: '460px', center: 95 }, rotate: 4 },
	{ day: 'Fri.', date: '31', note: 'none', style: { top: '615px', center: -50 }, rotate: -4 },
]

// ---- page ------------------------------------------------------------------

export default function MemberDashboard() {
	return (
		<main className="
			bg-cream
			w-full
			h-screen
			overflow-hidden
			p-8
			flex
			gap-15
		">
			<Sidebar items={['dashboard', 'labs', 'events', 'calendar']} active="dashboard" />

			{/* center column */}
			<section className="
				flex-1
				flex
				flex-col
				justify-center
				gap-5
			">
				{/* announcements */}
				<div className="
					relative
					bg-white
					border-[5px]
					border-orange
					rounded-tl-[50px]
                    rounded-br-[50px]
					px-8
					py-5
				">
					<p className="
						font-vietnam
						text-[18px]
                        font-semibold
						text-black
					">
						announcements
					</p>
					<p className="
						font-handrawn
						text-4xl
						text-black
						mt-2
					">
						Welcome to Elemental Beauty!
					</p>
				</div>

				{/* elementist pass */}
				<div className="
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

				{/* stats + points cloud */}
				<div className="relative">
					<div className="
                    mt-5
						grid
						grid-cols-2
						gap-x-[90px]
						gap-y-[24px]
					">
						<StatCard title="past labs" value="10" bg="bg-green" valueColor="text-green-dark" />
						<StatCard title="rsvp'd labs" value="1" bg="bg-yellow-light" valueColor="text-yellow-dark" />
						<StatCard title="past events" value="2" bg="bg-salmon-light" valueColor="text-salmon-dark" />
						<StatCard title="rsvp'd events" value="3" bg="bg-orange" valueColor="text-orange-dark" />
					</div>
					{/* cloud overlapping the grid center */}
					<div className="
						absolute
						inset-0
						flex
						items-center
						justify-center
						pointer-events-none
					">
						<div className="relative w-60 ">
							<img
								src="/cloud-1.png"
								alt=""
								className="
									w-full
									select-none
                                    
								"
							/>
							<div className="
								absolute
								inset-0
								flex
								flex-col
								items-center
								justify-center
							">
								<p className="
									font-vietnam
                                    font-semibold
									text-[20px]
									text-black
								">
									points
								</p>
								<p className="
									font-beachday
									font-bold
									text-3xl
									text-salmon-med
									leading-none
								">
									20
								</p>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* right column: upcoming */}
			<section className="
				w-[500px]
				-my-8
				-mr-8
				bg-green
				rounded-tl-[100px]
				rounded-bl-[100px]
				p-8
				flex
				flex-col
				shadow-[inset_7px_5px_6px_rgba(0,0,0,0.25)]
			">
				<h2 className="
					font-canobis
					text-green-dark
					text-5xl
					text-center
					mb-4
                    [-webkit-text-stroke:1px_black]
				">
					UPCOMING
				</h2>
				<div className="
					flex-1
					min-h-0
					flex
					items-center
					justify-center
				">
					<div
						className="relative"
						style={{ width: `${GROUP_W}px`, height: `${GROUP_H}px` }}
					>
						{upcoming.map((s) => (
							<Stamp key={s.day} {...s} />
						))}
					</div>
				</div>
			</section>
		</main>
	)
}
