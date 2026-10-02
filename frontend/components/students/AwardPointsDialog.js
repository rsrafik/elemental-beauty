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
// Above them, their total in a box: type a different number and "set" makes it
// their points, for anything the three don't cover (the server logs the
// difference).
//
// Following on instagram and joining the discord are one-time (`once`; the
// server's ONE_TIME_ACTIONS): once given, the button greys out, and clicking
// it again takes the points back. A repost can be given any number of times.
//
//   student   the row: { id, first, last, points, claimed }
//   onAwarded (id, newPoints, claimed) — the table updates the row

export const AWARDS = [
	{ action: 'instagram_follow', label: 'followed us on instagram', points: 2, once: true },
	{ action: 'instagram_repost', label: 'reposted us on instagram', points: 1 },
	{ action: 'discord_join', label: 'joined the discord', points: 2, once: true },
]

export default function AwardPointsDialog({ student, onClose, onAwarded }) {
	const [busy, setBusy] = useState(null)
	const [status, setStatus] = useState(null)
	const [points, setPoints] = useState(student.points)
	// which one-time awards they've had
	const [claimed, setClaimed] = useState(student.claimed ?? [])
	// the box, as typed — kept a string so it can be cleared while editing
	const [typed, setTyped] = useState(String(student.points))
	const typedNumber = Number(typed)
	const typedOk = typed.trim() !== '' && Number.isInteger(typedNumber) && typedNumber >= 0
	const canSet = typedOk && typedNumber !== points && busy === null

	const setTotal = async (submitted) => {
		submitted.preventDefault()
		if (!canSet) return
		setBusy('manual')
		setStatus(null)
		try {
			const reply = await membersApi.setPoints(student.id, typedNumber)
			setPoints(reply.points)
			setTyped(String(reply.points))
			onAwarded(student.id, reply.points)
			setStatus({ text: `${student.first} has ${reply.points} now` })
		} catch (err) {
			setStatus({ error: true, text: err.message })
		} finally {
			setBusy(null)
		}
	}

	// a one-time award they've had is taken back instead
	const give = async (award) => {
		if (busy) return
		const undo = award.once && claimed.includes(award.action)
		setBusy(award.action)
		setStatus(null)
		try {
			const reply = undo
				? await membersApi.undoPoints(student.id, award.action)
				: await membersApi.awardPoints(student.id, award.action)
			setPoints(reply.points)
			setTyped(String(reply.points))
			if (reply.awardsClaimed) setClaimed(reply.awardsClaimed)
			onAwarded(student.id, reply.points, reply.awardsClaimed)
			setStatus({
				text: undo
					? `took back the points for ${award.label} — ${student.first} has ${reply.points} now`
					: `+${award.points} for ${award.label} — ${student.first} has ${reply.points} now`,
			})
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
						<span className="font-semibold text-black tabular-nums">{points}</span>{' '}points. Type a new total,
						or pick what they did — either way it&apos;s logged under your name on the activity log.
					</p>

					<form
						onSubmit={setTotal}
						className="
							mt-5
							flex
							items-center
							gap-2
						"
					>
						<input
							type="number"
							min="0"
							step="1"
							inputMode="numeric"
							value={typed}
							onChange={(changed) => setTyped(changed.target.value)}
							aria-label={`${student.first} ${student.last}'s points`}
							className={`
								min-w-0
								flex-1
								rounded-[12px]
								border
								bg-white
								px-4
								py-3
								font-vietnam
								text-sm
								text-black
								tabular-nums
								outline-none
								transition-colors
								duration-200
								${typedOk ? 'border-black/25 focus:border-black' : 'border-red focus:border-red'}
							`}
						/>
						<button
							type="submit"
							disabled={!canSet}
							className={`
								shrink-0
								rounded-full
								px-6
								py-3
								font-vietnam
								font-semibold
								text-sm
								transition-all
								duration-200
								ease-out
								${canSet
									? 'bg-salmon-med text-white cursor-pointer hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 active:translate-y-0 active:shadow-none'
									: 'bg-black/10 text-black/40 cursor-not-allowed'}
							`}
						>
							{busy === 'manual' ? 'setting…' : 'set'}
						</button>
					</form>

					<ul className="
						mt-3
						flex
						flex-col
						gap-2
					">
						{AWARDS.map((award) => {
							// given already: greyed, and a click takes it back
							const had = award.once && claimed.includes(award.action)
							return (
								<li key={award.action}>
									<button
										type="button"
										onClick={() => give(award)}
										disabled={busy !== null}
										aria-pressed={award.once ? had : undefined}
										title={had ? `Already given — click to take the ${award.points} points back` : undefined}
										className={`
											w-full
											flex
											items-center
											justify-between
											gap-3
											rounded-[12px]
											px-4
											py-3
											text-left
											font-vietnam
											text-sm
											transition-all
											duration-200
											ease-out
											${had
												? 'bg-black/5 text-black/40'
												: 'bg-white text-black shadow-[0_2px_6px_rgba(0,0,0,0.08)]'}
											${busy === null
												? `cursor-pointer ${had ? 'hover:bg-black/10 hover:text-black/60' : 'hover:-translate-y-0.5 hover:shadow-[0_6px_14px_rgba(0,0,0,0.12)]'}`
												: 'opacity-60 cursor-wait'}
										`}
									>
										<span>
											{busy === award.action
												? (had ? 'taking back…' : 'giving…')
												: had ? `✓ ${award.label}` : award.label}
										</span>
										{had ? (
											<span className="
												font-vietnam
												font-semibold
												text-xs
												uppercase
												tracking-[0.1em]
											">
												undo
											</span>
										) : (
											<span className="
												font-beachday
												text-[22px]
												leading-none
												text-salmon-med
											">
												+{award.points}
											</span>
										)}
									</button>
								</li>
							)
						})}
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
