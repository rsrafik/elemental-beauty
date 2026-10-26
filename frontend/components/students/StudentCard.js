'use client'

import { useEffect, useState } from 'react'
import { members as membersApi } from '@/lib/api'
import { roleLabel } from '@/lib/roles'
import { Popup, PopupButton } from '@/components/labs/LabViewParts'

// One person, as j-board and up see them from a row on /students: the same
// five numbers as the counter on their own /account (points, labs done and
// rsvp'd, events done and rsvp'd) in a row, then their email and whichever
// handles they've given — instagram, discord. A VIP's name wears the crown.
// GET /members/:id/card.

// the counter's colours, number for number (Profile.js)
const CELLS = [
	{ key: 'points', label: 'points', ink: 'text-salmon-med' },
	{ key: 'pastLabs', label: 'labs done', ink: 'text-green-dark' },
	{ key: 'rsvpLabs', label: "labs rsvp'd", ink: 'text-yellow-dark' },
	{ key: 'pastEvents', label: 'events done', ink: 'text-blue-med' },
	{ key: 'rsvpEvents', label: "events rsvp'd", ink: 'text-orange-dark' },
]

// gold, the check-in page's (CheckInView)
function CrownIcon({ className }) {
	return (
		<svg viewBox="0 0 24 24" className={className} aria-hidden="true">
			<path d="M4.2 8.8l4.1 3.5L12 5.8l3.7 6.5 4.1-3.5-1.6 9.2H5.8z" fill="#F5C842" stroke="#B8860B" strokeWidth="1.3" strokeLinejoin="round" />
			<path d="M5.8 20h12.4" stroke="#B8860B" strokeWidth="1.8" strokeLinecap="round" />
			<circle cx="4.2" cy="8.4" r="1.5" fill="#F5C842" stroke="#B8860B" strokeWidth="1" />
			<circle cx="12" cy="5" r="1.5" fill="#F5C842" stroke="#B8860B" strokeWidth="1" />
			<circle cx="19.8" cy="8.4" r="1.5" fill="#F5C842" stroke="#B8860B" strokeWidth="1" />
		</svg>
	)
}

function Detail({ label, value }) {
	return (
		<div className="
			flex
			items-baseline
			justify-between
			gap-4
			py-2.5
			border-b
			border-black/10
			last:border-b-0
		">
			<span className="
				font-vietnam
				text-[11px]
				uppercase
				tracking-[0.14em]
				text-black/45
			">
				{label}
			</span>
			<span className={`
				min-w-0
				font-vietnam
				text-sm
				text-right
				break-all
				${value ? 'text-black' : 'text-black/30'}
			`}>
				{value || 'not given'}
			</span>
		</div>
	)
}

export default function StudentCard({ id, onClose }) {
	const [person, setPerson] = useState(null)
	const [error, setError] = useState(null)

	useEffect(() => {
		let live = true
		membersApi.card(id)
			.then((reply) => live && setPerson(reply))
			.catch((err) => live && setError(err.message))
		return () => { live = false }
	}, [id])

	const name = person
		? [person.firstName, person.lastName].filter(Boolean).join(' ') || `@${person.username}`
		: 'loading…'

	return (
		<Popup title={name} label={person ? `${name}'s profile` : 'Profile'} onClose={onClose} width="max-w-[600px]">
			{(dismiss) => (
				<>
					{person && (
						<p className="
							mt-2
							flex
							items-center
							gap-2
							font-vietnam
							text-sm
							text-black/55
						">
							{person.role === 'vip' && (
								<span title="VIP: dues paid for the year" className="inline-flex">
									<CrownIcon className="w-5 h-5" />
								</span>
							)}
							@{person.username} · {roleLabel(person.role)}
						</p>
					)}

					{error && (
						<p className="
							mt-3
							font-vietnam
							text-sm
							text-salmon-dark
						">
							{error}
						</p>
					)}

					{person && (
						<>
							{/* the counter from their /account, one row across */}
							<div className="
								mt-5
								grid
								grid-cols-5
								divide-x
								divide-black/10
								rounded-[18px]
								bg-white
								py-2
								shadow-[0_0_20px_rgba(0,0,0,0.12)]
							">
								{CELLS.map((cell) => (
									<div
										key={cell.key}
										className="
											flex
											flex-col
											items-center
											justify-center
											px-1
											py-2
										"
									>
										<p className={`
											font-beachday
											text-[26px]
											sm:text-[30px]
											leading-none
											${cell.ink}
										`}>
											{cell.key === 'points' ? person.points : person.stats[cell.key]}
										</p>
										<p className="
											mt-1
											font-vietnam
											text-[9px]
											sm:text-[10px]
											uppercase
											tracking-[0.1em]
											text-black/45
											text-center
										">
											{cell.label}
										</p>
									</div>
								))}
							</div>

							<div className="mt-5">
								<Detail label="email" value={person.email} />
								<Detail label="instagram" value={person.instagram} />
								<Detail label="discord" value={person.discord} />
							</div>
						</>
					)}

					<div className="
						mt-6
						flex
						justify-end
					">
						<PopupButton onClick={() => dismiss(onClose)}>close</PopupButton>
					</div>
				</>
			)}
		</Popup>
	)
}
