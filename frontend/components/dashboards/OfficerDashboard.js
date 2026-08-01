import Sidebar from '@/components/dashboards/Sidebar'
import { currentRole } from '@/lib/roles'
import { navFor, showInstagramFor } from '@/lib/nav'

// Shown to officer / treasurer / admin.
// Sidebar + a 2x2 grid (quick actions / upcoming / announcement / leaderboard)
// with a centered circle overlaying the grid's intersection.

// ---- small building blocks -------------------------------------------------

function PodiumSpot({ name, medal, height }) {
	return (
		<div className="
			flex
			flex-col
			items-center
			gap-2
		">
			<span className="
				font-handrawn
				text-[20px]
				text-black
			">
				{name}
			</span>
			
			<div
				className="
					w-[92px] 
					bg-yellow
					flex
					justify-center
					shadow-[5px_5px_2px_rgba(0,0,0,0.5)]
					"
				style={{ height: `${height}px` }}
			>
				<span className="text-[30px]">{medal}</span>
			</div>
		</div>
	)
}

function LeaderRow({ place, name }) {
	return (
		<div className="
			rounded-[10px]
			bg-yellow-light
			px-5
			py-1.5
			shadow-[inset_5px_2px_2px_rgba(0,0,0,0.5)]
		">
			<span className="
				font-handrawn
				text-[20px]
				text-black
			">
				{place}. {name}
			</span>
		</div>
	)
}

// ---- page ------------------------------------------------------------------

export default function OfficerDashboard() {
	return (
		<main className="
			bg-cream
			w-full
			h-screen
			overflow-hidden
			p-8
			flex
			gap-6
		">
			<Sidebar
				items={navFor(currentRole)}
				showInstagram={showInstagramFor(currentRole)}
			/>

			{/* 2x2 grid + centered overlay circle */}
			<section className="
				flex-1
				relative
				grid
				grid-cols-2
				grid-rows-2
				gap-10
                m-10
			">
				{/* quick actions */}
				<div className="
					bg-salmon
					rounded-tl-[100px]
					p-6
                    px-15
					flex
					flex-col
					items-center
					gap-4
				">
					<h2 className="
						font-vietnam
						font-semibold
						text-[22px]
						text-black
					">
						quick actions
					</h2>
					<button className="
                        mt-6
						w-full
						rounded-full
						bg-salmon-lightest
						py-3
						font-handrawn
						text-[26px]
						text-black
						shadow-[inset_-5px_-5px_2px_rgba(0,0,0,0.5)]
						transition
						duration-200
						ease-out
						hover:-translate-y-0.5
						hover:shadow-[inset_0px_0px_0px_rgba(0,0,0,0.5)]
						active:brightness-105
					">
						Email All
					</button>
					<button className="
						w-full
						rounded-full
						bg-salmon-light
						py-3
						font-handrawn
						text-[26px]
						text-black
						shadow-[inset_-5px_-5px_2px_rgba(0,0,0,0.5)]
						transition
						duration-200
						ease-out
						hover:-translate-y-0.5
						hover:shadow-[inset_0px_0px_0px_rgba(0,0,0,0.5)]
						active:brightness-105
					">
						New Event
					</button>
					<button className="
						w-full
						rounded-full
						bg-[#FFA799]
						py-3
						font-handrawn
						text-[26px]
						text-black
						shadow-[inset_-5px_-5px_2px_rgba(0,0,0,0.5)]
						transition
						duration-200
						ease-out
						hover:-translate-y-0.5
						hover:shadow-[inset_0px_0px_0px_rgba(0,0,0,0.5)]
						active:brightness-105
					">
						New Lab
					</button>
				</div>

				{/* upcoming */}
				<div className="
					relative
					overflow-hidden
					bg-orange
					rounded-tr-[100px]
				">
                    <h2 className="
						absolute
						top-[50px]
                        right-[20px]
						rotate-[45deg]
						font-vietnam
						font-semibold
						text-[22px]
						text-black
					">
						upcoming
					</h2>
					{/* concentric rings anchored to the bottom-left corner */}
					<div className="
						peer/light
						absolute
						bottom-0
						left-0
						w-[85%]
						h-[80%]
						rounded-tr-[100px]
						border-black/10
						bg-orange-light
						flex
						items-center
						flex-col
						justify-center
						transition-all
						duration-700
						ease-out
                        shadow-[5px_-5px_2px_rgba(0,0,0,0.5)]
					">
                        <p className="
                            absolute
                            top-[40px]
                            right-[40px]
                            rotate-[45deg]
                            font-handrawn
                            text-[20px]
                            text-black
							
                        ">
                            oct 3
                        </p>
							<h2 className="
								ml-20
								text-black
								font-beachday
								text-[30px]
								leading-tight
							">
								Bubbles and Beakers
							</h2>
							<h3 className="
								text-black
								font-vietnam
								mt-1
								ml-20
								mb-10
							">
								Attending: 5/20
							</h3>
                    </div>
					<div className="
						peer/lighter
						absolute
						bottom-0
						left-0
						w-[75%]
						h-[70%]
						rounded-tr-[100px]
						border-black/10
						bg-orange-lighter
						transition-transform
						duration-700
						ease-out
						peer-hover/light:-translate-x-[50%]
						peer-hover/light:translate-y-[45%]
                        shadow-[5px_-5px_2px_rgba(0,0,0,0.5)]
					">
                        <p className="
                            absolute
                            top-[40px]
                            right-[40px]
                            rotate-[45deg]
                            font-handrawn
                            text-[20px]
                            text-black
                        ">
                            sep 17
                        </p>
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
							<h2 className="
								text-black
								font-beachday
								text-[30px]
								leading-tight
							">
								Bubbles and Beakers
							</h2>
							<h3 className="
								text-black
								font-vietnam
								mt-1
							">
								Attending: 5/20
							</h3>
						</div>
                    </div>
					<div className="
						absolute
						bottom-0
						left-0
						w-[65%]
						h-[60%]
						rounded-tr-[100px]
						border-black/10
						bg-orange-lightest
						transition-transform
						duration-700
						ease-out
						peer-hover/light:-translate-x-[60%]
						peer-hover/light:translate-y-[55%]
						peer-hover/lighter:-translate-x-[60%]
						peer-hover/lighter:translate-y-[55%]
                        shadow-[5px_-5px_2px_rgba(0,0,0,0.5)]
					">
                        <p className="
                            absolute
                            top-[40px]
                            right-[40px]
                            rotate-[45deg]
                            font-handrawn
                            text-[20px]
                            text-black
                        ">
                            aug 28
                        </p>
						<div className="
							mt-5
							mr-5
							absolute
							inset-0
							flex
							flex-col
							items-center
							justify-center
							px-6
							text-center
						">
							<h2 className="
								text-black
								font-beachday
								text-[30px]
								leading-tight
							">
								Bubbles and Beakers
							</h2>
							<h3 className="
								text-black
								font-vietnam
								mt-1
							">
								Attending: 5/20
							</h3>
						</div>
                    </div>

				</div>

				{/* make announcement */}
				<div className="
					relative
					bg-green
					rounded-bl-[100px]
					pt-6
                    px-20
                    pb-15
					flex
					flex-col
				">
					<h2 className="
						font-vietnam
						font-semibold
						text-[22px]
						text-black
						text-center
					">
						make announcement
					</h2>
					<textarea
						placeholder="type message here..."
						className="
							mt-4
							flex-1
							w-full
							resize-none
							rounded-[5px]
							bg-white
							p-4
							font-handrawn
							text-[25px]
							text-black
							outline-none
                            shadow-[-5px_5px_2px_rgba(0,0,0,0.5)]
						"
					/>
					<button className="
						absolute
						bottom-6
						right-9
						flex
						h-20
						w-20
						flex-col
						items-center
						justify-center
						rounded-full
						bg-blue-med
						font-beachday
						text-[28px]
						leading-none
						text-white
						shadow-[-5px_5px_2px_rgba(0,0,0,0.5)]
						transition
						duration-200
						ease-out
						hover:brightness-110
						active:shadow-[0px_0px_0px_rgba(0,0,0,0.5)]
					">
						<span>PO</span>
						<span>ST</span>
					</button>
				</div>

				{/* leaderboard */}
				<div className="
					bg-yellow-light
					rounded-br-[100px]
					flex
					flex-col
				">
					<h2 className="
						font-vietnam
						font-semibold
						text-[22px]
						text-black
						text-right
						pr-6
						pt-6
					">
						leaderboard
					</h2>
					<div className="
						mt-2
						flex
						items-end
						justify-center
						gap-10
					">
						<PodiumSpot name="Ting C." medal="🥈" height={50} />
						<PodiumSpot name="Azu N." medal="🥇" height={70} />
						<PodiumSpot name="Michelle C." medal="🥉" height={40} />
					</div>

					<div className="
						w-full
						h-full
						bg-yellow
						p-5
						flex
						items-center
						justify-center
						rounded-br-[100px]
						overflow-hidden
					">
						<div className="
							mt-4
							flex
							flex-col
							gap-4
							w-full
							grid
							grid-cols-2
							gap-4
						">
							<LeaderRow place="4" name="Toji Fushiguro" />
							<LeaderRow place="5" name="Yo Mama" />
							<LeaderRow place="6" name="Raia Rafiki" />
							<LeaderRow place="7" name="Elijah Leone" />
							<LeaderRow place="8" name="Miadora Bilanicz" />
							<LeaderRow place="9" name="Yoyo Qin" />
						</div>
					</div>
					
				</div>

				{/* centered DASH BOARD circle overlaying the grid intersection */}
				<div className="
					absolute
					top-1/2
					left-1/2
					z-10
					h-[180px]
					w-[180px]
					-translate-x-1/2
					-translate-y-1/2
					flex
					items-center
					justify-center
					rounded-full
					bg-cream
					shadow-[0_0px_20px_rgba(0,0,0,0.5)]
				">
					<h1 className="
						font-reasons
						text-[35px]
						leading-none
						text-center
						text-black
					">
						DASH<br />BOARD
					</h1>
				</div>
			</section>
		</main>
	)
}
