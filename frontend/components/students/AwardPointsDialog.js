'use client'

import { useState } from 'react'
import { Popup, PopupButton } from '@/components/labs/LabViewParts'
import { members as membersApi } from '@/lib/api'

// /students' "+" beside someone's points: the things an officer gives points
// for by hand. Attendance isn't one of them — check-in awards that on its own,
// so it can't be counted twice. What each is worth is the server's call
// (src/points.js); these numbers are only the labels, and the reply says what
// was actually given.
//
//   student   the row: { id, first, last, points }
//   onAwarded (id, newPoints) — the table updates the cell

export const AWARDS = [
	{ action: 'instagram_follow', label: 'followed us on instagram', points: 2 },
	{ action: 'instagram_repost', label: 'reposted us on instagram', points: 1 },
	{ action: 'discord_join', label: 'joined the discord', points: 2 },
]

export default function AwardPointsDialog({ student, onClose, onAwarded }) {
	const [busy, setBusy] = useState(null)
	const [status, setStatus] = useState(null)
	const [points, setPoints] = useState(student.points)

	const give = async (award) => {
		if (busy) return
		setBusy(award.action)
		setStatus(null)
		try {
			const reply = await membersApi.awardPoints(student.id, award.action)
			setPoints(reply.points)
			onAwarded(student.id, reply.points)
			setStatus({ text: `+${award.points} for ${award.label} — ${student.first} has ${reply.points} now` })
		} catch (err) {
			setStatus({ error: true, text: err.message })
		} finally {
			setBusy(null)
		}
	}

	return (
		<Popup title="give points" onClose={onClose}>
			{(dismiss) => (
				<>
					<p className="
						mt-3
						font-vietnam
						text-sm
						text-black/60
					">
						<span className="font-semibold text-black">{student.first} {student.last}</span> has{' '}
						<span className="font-semibold text-black tabular-nums">{points}</span>{' '}points. Pick what they did —
						it&apos;s logged under your name on the activity log.
					</p>

					<ul className="
						mt-5
						flex
						flex-col
						gap-2
					">
						{AWARDS.map((award) => (
							<li key={award.action}>
								<button
									type="button"
									onClick={() => give(award)}
									disabled={busy !== null}
									className={`
										w-full
										flex
										items-center
										justify-between
										gap-3
										rounded-[12px]
										bg-white
										px-4
										py-3
										text-left
										font-vietnam
										text-sm
										text-black
										shadow-[0_2px_6px_rgba(0,0,0,0.08)]
										transition-all
										duration-200
										ease-out
										${busy === null
											? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_6px_14px_rgba(0,0,0,0.12)]'
											: 'opacity-60 cursor-wait'}
									`}
								>
									<span>{busy === award.action ? 'giving…' : award.label}</span>
									<span className="
										font-beachday
										text-[22px]
										leading-none
										text-salmon-med
									">
										+{award.points}
									</span>
								</button>
							</li>
						))}
					</ul>

					{status && (
						<p
							role="status"
							className={`
								mt-4
								font-vietnam
								font-semibold
								text-sm
								${status.error ? 'text-salmon-dark' : 'text-green-dark'}
							`}
						>
							{status.text}
						</p>
					)}

					<div className="
						mt-6
						flex
						justify-end
					">
						<PopupButton onClick={() => dismiss(onClose)}>done</PopupButton>
					</div>
				</>
			)}
		</Popup>
	)
}
