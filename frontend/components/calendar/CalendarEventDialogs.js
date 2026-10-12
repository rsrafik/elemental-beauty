'use client'

import { useState } from 'react'
import { events as eventsApi } from '@/lib/api'
import { STAFF_TRACKS, capacityField, hasMeetingLink } from '@/lib/calendar'
import EventDetailsDialog from '@/components/events/EventDetailsDialog'
import { EventDialog as EditEventDialog, toCard } from '@/components/events/OfficerEvents'

// What clicking an event on the staff calendar opens: the same editor /events
// uses, or — for one that isn't this person's to change (the API's `canEdit`
// is false: a j-board event an officer or above added, seen by j-board) — the
// read-only overview. The calendar uses it, and so does the staff dashboard's
// upcoming panel for the events that live only on the calendar, so the two
// can't open the same event two different ways.
//
//   const { open, dialogs } = useCalendarEventDialogs({ categories, onChanged, onError })
//   open(row)   row straight off GET /api/events
//   {dialogs}   rendered wherever the page keeps its popups
//
// `onChanged` runs after a save or delete — the page reloads whatever it drew
// from the rows. `onError` gets null when one starts and the message if the
// API refuses it.
export function useCalendarEventDialogs({ categories, onChanged, onError }) {
	// the event open in the editor, as /events' cards shape it
	const [editing, setEditing] = useState(null)
	// or the row open read-only
	const [viewing, setViewing] = useState(null)

	const open = (row) => {
		if (row.canEdit === false) setViewing(row)
		else setEditing(toCard(row))
	}

	// Same body /events sends.
	const update = async (values) => {
		onError?.(null)
		try {
			await eventsApi.update(editing.id, {
				title: values.title,
				date: values.date,
				startTime: values.time || null,
				endTime: values.time ? values.endTime || null : null,
				categoryId: values.categoryId === '' ? null : Number(values.categoryId),
				track: values.track,
				description: values.description,
				image: values.image,
				capacity: capacityField(values.track) !== 'spots' || values.spots.trim() === '' ? null : Number(values.spots),
				team: values.track === 'jboard' ? values.team || null : null,
				location: values.location.trim() || null,
				hideFromEvents: values.hideFromEvents,
				links: values.links,
				meetingUrl: hasMeetingLink(values.track) ? values.meetingUrl.trim() || null : null,
			})
			await onChanged?.()
		} catch (err) {
			onError?.(err.message)
		}
		setEditing(null)
	}

	const remove = async () => {
		onError?.(null)
		try {
			await eventsApi.remove(editing.id)
			await onChanged?.()
		} catch (err) {
			onError?.(err.message)
		}
		setEditing(null)
	}

	const dialogs = (
		<>
			{editing && (
				<EditEventDialog
					event={editing}
					categories={categories}
					onClose={() => setEditing(null)}
					onSave={update}
					onDelete={remove}
				/>
			)}

			{viewing && (
				<EventDetailsDialog
					event={viewing}
					trackLabel={STAFF_TRACKS[viewing.track]?.label}
					onClose={() => setViewing(null)}
				/>
			)}
		</>
	)

	return { open, dialogs }
}
