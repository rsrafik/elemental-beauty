'use client'

import { TEAMS } from '@/lib/calendar'

// The event forms' "team", which stands where "available spots" does when an
// event is for j-board: j-board events don't take sign-ups, so there's no cap
// to set, but they do belong to one of j-board's teams. Blank is the whole of
// j-board. `fieldClass` and `Label` are the form's own.
export default function TeamField({ value, onChange, fieldClass, Label }) {
	return (
		<label className="block">
			<Label>team</Label>
			<select
				value={value}
				onChange={(event) => onChange(event.target.value)}
				className={`${fieldClass} cursor-pointer`}
			>
				<option value="">all of j-board</option>
				{TEAMS.map((team) => (
					<option key={team.key} value={team.key}>
						{team.label}
					</option>
				))}
			</select>
		</label>
	)
}
