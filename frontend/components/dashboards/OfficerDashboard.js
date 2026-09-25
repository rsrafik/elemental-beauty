'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/dashboards/Sidebar'
import { useRole, useSignOut } from '@/lib/session'
import { navFor, showInstagramFor } from '@/lib/nav'
import { announcements as announcementsApi, events as eventsApi, labs as labsApi, members } from '@/lib/api'
import { openCompose, useMailProvider } from '@/lib/compose'
import { isoDate, shortDate, today } from '@/lib/dates'

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

// The date written up the corner of one of the upcoming rings. All three rings
// carry the same one, so it lives here — and it sits closer in on a narrow
// panel, where 40px from the corner puts it off the ring entirely.
function RingDate({ children }) {
	return (
		<p className="
			absolute
			top-[20px]
			right-[20px]
			lg:top-[40px]
			lg:right-[40px]
			rotate-[45deg]
			font-handrawn
			text-[20px]
			lg:text-[20px]
			text-black
		">
			{children}
		</p>
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
	const role = useRole()
	const signOut = useSignOut()
	const router = useRouter()

	// The roster, sorted by points — the podium takes the top three and the
	// grid under it the next six. Read off /members rather than kept anywhere,
	// so it can't disagree with the roster on /students.
	const [board, setBoard] = useState([])

	// Everyone whose role is plain member, for "Email All" — officers,
	// treasurers and admins aren't on it. Held from the same /members read as
	// the board, so the click can open Gmail straight away: a window opened
	// after waiting on a request gets stopped by the popup blocker.
	const [memberEmails, setMemberEmails] = useState([])
	const mail = useMailProvider()

	// The next three things on the calendar, labs and events together — the club
	// doesn't think of them as separate queues, and neither does this panel.
	// Soonest first: [0] is drawn on the front ring, [2] on the one at the back.
	const [upcoming, setUpcoming] = useState([])

	// what's in the announcement box, and what the POST button is doing about it
	const [draft, setDraft] = useState('')
	const [posting, setPosting] = useState(false)
	const [posted, setPosted] = useState(false)
	const [error, setError] = useState(null)

	useEffect(() => {
		let live = true
		members
			.list()
			.then((rows) => {
				if (!live) return
				setMemberEmails(
					rows
						.filter((row) => row.role === 'member' && row.user?.email)
						.map((row) => row.user.email)
				)
				setBoard(
					[...rows]
						.sort((a, b) =>
							b.points - a.points ||
							(a.user?.firstName ?? '').localeCompare(b.user?.firstName ?? '')
						)
						.map((row) => ({
							id: row.userId,
							// "Ada W." — the podium and the rows are narrow, and a full
							// surname is what overflows them
							name: `${row.user?.firstName ?? ''} ${(row.user?.lastName ?? '').charAt(0)}.`.trim(),
							points: row.points,
						}))
				)
			})
			.catch(() => {})

		// Today counts as upcoming — a lab running this afternoon is the most
		// upcoming thing there is — so the cut is made here rather than with the
		// API's ?when=upcoming, which measures from the current instant and would
		// drop anything dated today.
		Promise.all([labsApi.list(), eventsApi.list()])
			.then(([labs, events]) => {
				if (!live) return
				const now = today()
				const soon = [
					// drafts aren't happening yet — they stay on /labs until published
					...labs.filter((lab) => lab.published !== false).map((lab) => ({
						id: `lab-${lab.labId}`,
						date: isoDate(lab.date),
						time: '',
						title: lab.title,
						taken: lab.taken,
						capacity: lab.capacity,
					})),
					...events.map((event) => ({
						id: `event-${event.eventId}`,
						date: isoDate(event.date),
						time: event.startTime ?? '',
						title: event.title,
						taken: event.taken,
						capacity: event.capacity,
					})),
				]
					.filter((row) => row.date >= now)
					// same day: the earlier start time comes first, and something
					// with no time on it sorts ahead of something with one
					.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
					.slice(0, 3)
				setUpcoming(soon)
			})
			.catch(() => {})

		return () => { live = false }
	}, [])

	// An event with no cap is uncapped, not 0 — the label drops the denominator
	// rather than inventing one.
	const attending = (row) =>
		row.capacity == null ? `Attending: ${row.taken}` : `Attending: ${row.taken}/${row.capacity}`

	const post = async () => {
		const body = draft.trim()
		if (!body || posting) return

		setPosting(true)
		setError(null)
		try {
			await announcementsApi.post(body)
			setDraft('')
			setPosted(true)
			// the confirmation is a receipt, not a state — it clears itself
			setTimeout(() => setPosted(false), 2500)
		} catch (err) {
			setError(err.message)
		} finally {
			setPosting(false)
		}
	}

	const podium = board.slice(0, 3)
	const rest = board.slice(3, 9)

	return (
		<main className="
			bg-cream
			w-full
			min-h-screen
			xl:h-screen
			overflow-x-clip
			xl:overflow-hidden
			p-4
			sm:p-6
			lg:p-8
			flex
			flex-col
			lg:flex-row
			gap-4
			lg:gap-6
		">
			<Sidebar
				items={navFor(role)}
				showInstagram={showInstagramFor(role)}
				onLogout={signOut}
			/>

			{/* 2x2 grid + centered overlay circle. page-enter / page-stagger are
			    the entrance (see globals.css) — the grid drifts up and the four
			    quadrants come in one after another, so landing here from the
			    sidebar reads as movement rather than a swap.

			    Below `lg` the four quadrants become one column and the circle
			    stops being an overlay — there's no intersection to sit on once
			    they're stacked, so it leaves the middle and becomes the heading at
			    the top instead. */}
			<section className="
				page-enter
				page-stagger
				flex-1
				min-w-0
				relative
				grid
				grid-cols-1
				xl:grid-cols-2
				xl:grid-rows-2
				gap-6
				xl:gap-10
				m-0
                xl:m-10
			">
				{/* quick actions */}
				<div className="
					bg-salmon
					rounded-[30px]
					xl:rounded-none
					xl:rounded-tl-[100px]
					p-6
                    xl:px-15
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
					{/* Two of the three go where the thing is actually made rather
					    than opening a dialog here — the event and lab forms live on
					    their own pages, and a second copy of either would be a second
					    form to keep in step. `?new` asks that page to open its form
					    on arrival, so it's still one click from here.

					    "Email All" opens a new message with every member in BCC, so
					    nobody sees anyone else's address, in whichever mail service
					    the officer's own address is on — Outlook for @purdue.edu,
					    Gmail for @gmail.com (see lib/compose.js). */}
					<button
						type="button"
						onClick={() => openCompose({ provider: mail.provider, from: mail.email, bcc: memberEmails })}
						disabled={memberEmails.length === 0}
						title={`Email all ${memberEmails.length} members`}
						className="
                        mt-6
						w-full
						rounded-full
						bg-salmon-lightest
						py-3
						font-handrawn
						text-[26px]
						text-black
						shadow-[inset_-5px_-5px_2px_rgba(0,0,0,0.5)]
						cursor-pointer
						transition
						duration-200
						ease-out
						hover:-translate-y-0.5
						hover:shadow-[inset_0px_0px_0px_rgba(0,0,0,0.5)]
						active:brightness-105
						disabled:text-black/40
						disabled:cursor-not-allowed
						disabled:hover:translate-y-0
						disabled:hover:shadow-[inset_-5px_-5px_2px_rgba(0,0,0,0.5)]
					">
						Email All
					</button>
					<button
						type="button"
						onClick={() => router.push('/events?new=1')}
						className="
						w-full
						rounded-full
						bg-salmon-light
						py-3
						font-handrawn
						text-[26px]
						text-black
						shadow-[inset_-5px_-5px_2px_rgba(0,0,0,0.5)]
						cursor-pointer
						transition
						duration-200
						ease-out
						hover:-translate-y-0.5
						hover:shadow-[inset_0px_0px_0px_rgba(0,0,0,0.5)]
						active:brightness-105
					">
						New Event
					</button>
					<button
						type="button"
						onClick={() => router.push('/labs?new=1')}
						className="
						w-full
						rounded-full
						bg-[#FFA799]
						py-3
						font-handrawn
						text-[26px]
						text-black
						shadow-[inset_-5px_-5px_2px_rgba(0,0,0,0.5)]
						cursor-pointer
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
				{/* every layer in here is absolutely positioned, so the panel has no
				    content to get its height from — the 2x2 grid row used to supply
				    it. Stacked, it has to bring its own. */}
				<div className="
					relative
					overflow-hidden
					bg-orange
					rounded-[30px]
					xl:rounded-none
					xl:rounded-tr-[100px]
					min-h-[420px]
					xl:min-h-0
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
						rounded-tr-[60px]
						xl:rounded-tr-[100px]
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
						<RingDate>{upcoming[2] ? shortDate(upcoming[2].date) : ''}</RingDate>
							<h2 className="
								ml-4
								sm:ml-8
								lg:ml-20
								text-center
								lg:text-left
								text-black
								font-beachday
								text-[20px]
								sm:text-[26px]
								lg:text-[30px]
								leading-tight
							">
								{upcoming[2]?.title ?? ''}
							</h2>
							<h3 className="
								text-black
								font-vietnam
								text-sm
								sm:text-base
								mt-1
								ml-4
								sm:ml-8
								lg:ml-20
								mb-6
								lg:mb-10
							">
								{upcoming[2] ? attending(upcoming[2]) : ''}
							</h3>
                    </div>
					<div className="
						peer/lighter
						absolute
						bottom-0
						left-0
						w-[75%]
						h-[70%]
						rounded-tr-[60px]
						xl:rounded-tr-[100px]
						border-black/10
						bg-orange-lighter
						transition-transform
						duration-700
						ease-out
						peer-hover/light:-translate-x-[50%]
						peer-hover/light:translate-y-[45%]
                        shadow-[5px_-5px_2px_rgba(0,0,0,0.5)]
					">
						<RingDate>{upcoming[1] ? shortDate(upcoming[1].date) : ''}</RingDate>
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
								text-[20px]
								sm:text-[26px]
								lg:text-[30px]
								leading-tight
							">
								{upcoming[1]?.title ?? ''}
							</h2>
							<h3 className="
								text-black
								font-vietnam
								text-sm
								sm:text-base
								mt-1
							">
								{upcoming[1] ? attending(upcoming[1]) : ''}
							</h3>
						</div>
                    </div>
					<div className="
						absolute
						bottom-0
						left-0
						w-[65%]
						h-[60%]
						rounded-tr-[60px]
						xl:rounded-tr-[100px]
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
						<RingDate>{upcoming[0] ? shortDate(upcoming[0].date) : ''}</RingDate>
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
								text-[20px]
								sm:text-[26px]
								lg:text-[30px]
								leading-tight
							">
								{upcoming[0]?.title ?? ''}
							</h2>
							<h3 className="
								text-black
								font-vietnam
								text-sm
								sm:text-base
								mt-1
							">
								{upcoming[0] ? attending(upcoming[0]) : ''}
							</h3>
						</div>
                    </div>

				</div>

				{/* make announcement.

				    The padding is what sets where the message box ends, and so where
				    the POST button sits against it. On both axes it's half the
				    button plus the button's own offset from the panel, which puts
				    the circle's centre on the box's corner:

				      px-10 = right-2  + half of w-16      py: pb-14 = bottom-6 + half of h-16

				    So all three change together with the button's size — w-16/h-16
				    below `sm`, w-20/h-20 above. */}
				<div className="
					relative
					bg-green
					rounded-[30px]
					xl:rounded-none
					xl:rounded-bl-[100px]
					pt-6
                    px-10
                    sm:px-14
                    xl:px-20
                    pb-14
                    sm:pb-16
                    xl:pb-15
					min-h-[280px]
					xl:min-h-0
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
						{/* the heading doubles as the receipt: posting is instant and a
						    separate toast would land somewhere nobody is looking */}
						{posted ? 'posted!' : error ? error : 'make announcement'}
					</h2>
					<textarea
						value={draft}
						onChange={(event) => {
							setDraft(event.target.value)
							setError(null)
						}}
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
							text-[20px]
							sm:text-[25px]
							text-black
							outline-none
                            shadow-[-5px_5px_2px_rgba(0,0,0,0.5)]
						"
					/>
					<button
						type="button"
						onClick={post}
						disabled={draft.trim() === '' || posting}
						aria-label="Post announcement"
						className={`
						absolute
						bottom-6
						right-2
						sm:right-4
						xl:right-9
						flex
						h-16
						w-16
						sm:h-20
						sm:w-20
						flex-col
						items-center
						justify-center
						rounded-full
						font-beachday
						text-[28px]
						leading-none
						text-white
						shadow-[-5px_5px_2px_rgba(0,0,0,0.5)]
						transition
						duration-200
						ease-out
						${draft.trim() === '' || posting
							? 'bg-blue-med/40 cursor-not-allowed'
							: `bg-blue-med
							   cursor-pointer
							   hover:brightness-110
							   active:shadow-[0px_0px_0px_rgba(0,0,0,0.5)]`}
					`}>
						<span>PO</span>
						<span>ST</span>
					</button>
				</div>

				{/* leaderboard */}
				<div className="
					bg-yellow-light
					rounded-[30px]
					xl:rounded-none
					xl:rounded-br-[100px]
					overflow-hidden
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
						gap-4
						sm:gap-10
					">
						{/* second, first, third — the tallest bar in the middle is
						    what makes it a podium rather than a bar chart */}
						<PodiumSpot name={podium[1]?.name ?? '—'} medal="🥈" height={50} />
						<PodiumSpot name={podium[0]?.name ?? '—'} medal="🥇" height={70} />
						<PodiumSpot name={podium[2]?.name ?? '—'} medal="🥉" height={40} />
					</div>

					{/* no top margin: this is the ground the podium stands on, so its
					    top edge has to meet the bottom of the three bars */}
					<div className="
						w-full
						h-full
						bg-yellow
						p-4
						sm:p-5
						flex
						items-center
						justify-center
						xl:rounded-br-[100px]
						overflow-hidden
					">
						<div className="
							mt-4
							grid
							grid-cols-1
							sm:grid-cols-2
							gap-3
							sm:gap-4
							w-full
						">
							{/* fourth place down. The index is the place because the
							    list was already sorted and sliced from three. */}
							{rest.map((person, index) => (
								<LeaderRow
									key={person.id}
									place={index + 4}
									name={person.name}
								/>
							))}
						</div>
					</div>
					
				</div>

				{/* centered DASH BOARD circle overlaying the grid intersection.
				    It only exists to fill that intersection, so once the quadrants
				    stack there's nothing for it to do and it isn't drawn. */}
				<div className="
					hidden
					xl:flex
					absolute
					top-1/2
					left-1/2
					z-10
					h-[180px]
					w-[180px]
					-translate-x-1/2
					-translate-y-1/2
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
