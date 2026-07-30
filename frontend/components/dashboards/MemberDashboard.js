import Sidebar from '@/components/dashboards/Sidebar'

function PassField({ label, value, className = '' }) {
	return (
		<div className={`
			border-2
			border-salmon-light
			rounded-[10px]
			px-3
			py-1
			${className}
		`}>
			<p className="
				font-vietnam
                font-semibold
				text-[11px]
				leading-tight
				text-white/80
			">
				{label}
			</p>
			<p className="
				font-handrawn
				text-lg
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
			rounded-[28px]
			p-6
			min-h-[150px]
			flex
			flex-col
			${bg}
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
				font-vietnam
				font-extrabold
				text-5xl
				mt-auto
				${valueColor}
			`}>
				{value}
			</p>
		</div>
	)
}

function Stamp({ day, date, note, style, rotate = 0 }) {
	return (
		<div className="absolute w-[46%]" style={style}>
			<div className="relative" style={{ transform: `rotate(${rotate}deg)` }}>
				<img
					src="/stamp.png"
					alt=""
					className="
						w-full
						block
						select-none
					"
				/>
				<img
					src="/pin.png"
					alt=""
					className="
						absolute
						-top-3
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
						font-ettamelody
						text-2xl
						text-black
					">
						{day} <span className="
							text-lg
							align-baseline
						">{date}</span>
					</p>
					<p className="
						font-ettamelody
						text-lg
						text-black
						mt-3
						leading-tight
					">
						{note}
					</p>
				</div>
			</div>
		</div>
	)
}

// ---- data ------------------------------------------------------------------

const upcoming = [
	{ day: 'Mon.', date: '27', note: 'none', style: { top: '1%', left: '6%' }, rotate: -7 },
	{ day: 'Tues.', date: '28', note: 'bubbles & beakers p.1', style: { top: '17%', left: '48%' }, rotate: 6 },
	{ day: 'Wed.', date: '29', note: 'none', style: { top: '33%', left: '2%' }, rotate: -5 },
	{ day: 'Thurs.', date: '30', note: 'bubbles & beakers p.2', style: { top: '50%', left: '46%' }, rotate: 7 },
	{ day: 'Fri.', date: '31', note: 'none', style: { top: '70%', left: '9%' }, rotate: -4 },
]

// ---- page ------------------------------------------------------------------

export default function MemberDashboard() {
	return (
		<main className="
			bg-cream
			w-full
			min-h-screen
			p-4
			flex
			gap-4
		">
			<Sidebar items={['dashboard', 'labs', 'events', 'calendar']} active="dashboard" />

			{/* center column */}
			<section className="
				flex-1
				flex
				flex-col
				gap-6
			">
				{/* announcements */}
				<div className="
					relative
					bg-white
					border-[3px]
					border-orange
					rounded-[30px]
					px-8
					py-5
				">
					<p className="
						font-vietnam
						text-lg
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
					{/* speech-bubble tail */}
					<div className="
						absolute
						-bottom-[11px]
						left-12
						w-5
						h-5
						bg-white
						rotate-45
						border-b-[3px]
						border-r-[3px]
						border-orange
					" />
				</div>

				{/* elementist pass */}
				<div className="
					bg-salmon
					rounded-[24px]
					p-6
					flex
					gap-5
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
						gap-2
					">
						<h3 className="
							font-starbim
							text-yellow-light
							text-2xl
							text-right
							tracking-wide
							whitespace-nowrap
						">
							ELEMENTIST P★SS
						</h3>
						<PassField label="username" value="azuazu" />
						<PassField label="first name" value="Azu" />
						<PassField label="last name" value="Nakao" />
						<div className="
							flex
							gap-3
							items-end
							mt-1
						">
							<PassField
								label="date joined"
								value="08/24/2026"
								className="w-40 shrink-0"
							/>
							<p className="
								font-vietnam
								font-bold
								text-sm
								text-salmon-dark
								leading-tight
								pb-1
								shrink-0
								whitespace-nowrap
								text-right
							">
								CLICK CARD FOR<br />QR CODE
							</p>
						</div>
					</div>
				</div>

				{/* stats + points cloud */}
				<div className="relative">
					<div className="
						grid
						grid-cols-2
						gap-6
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
						<div className="relative w-44">
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
									text-sm
									text-black
								">
									points
								</p>
								<p className="
									font-vietnam
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
				w-[380px]
				bg-green
				rounded-[40px]
				p-8
				flex
				flex-col
			">
				<h2 className="
					font-reasons
					text-green-dark
					text-5xl
					text-center
					mb-4
				">
					upcoming
				</h2>
				<div className="
					relative
					flex-1
					min-h-[820px]
				">
					{upcoming.map((s) => (
						<Stamp key={s.day} {...s} />
					))}
				</div>
			</section>
		</main>
	)
}
