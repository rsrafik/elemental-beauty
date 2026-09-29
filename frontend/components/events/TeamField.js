'use client'

import { TEAMS } from '@/lib/calendar'
import { useSession } from '@/lib/session'

// The event forms' "team", which stands where "available spots" does when an
// event is for j-board: j-board events don't take sign-ups, so there's no cap
// to set, but they do belong to one of j-board's teams. Blank is the whole of
// j-board. `fieldClass` and `Label` are the form's own.
//
// A j-board member only files for a team they're on or all of j-board —
// another team's event would vanish off their calendar (the API refuses it
// too). One already filed under another team keeps showing that team, so an
// edit doesn't quietly move it.
export default function TeamField({ value, onChange, fieldClass, Label }) {
	const { user } = useSession()
	const teams = user?.role === 'jboard'
		? TEAMS.filter((team) => (user.jboardTeams ?? []).includes(team.key) || team.key === value)
		: TEAMS
	return (
		<label className="block">
			<Label>team</Label>
			<select
				value={value}
				onChange={(event) => onChange(event.target.value)}
				className={`${fieldClass} cursor-pointer`}
			>
				<option value="">all of j-board</option>
				{teams.map((team) => (
					<option key={team.key} value={team.key}>
						{team.label}
					</option>
				))}
			</select>
		</label>
	)
}
