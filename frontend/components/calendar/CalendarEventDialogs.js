'use client'

import { useState } from 'react'
import { events as eventsApi } from '@/lib/api'
import { STAFF_TRACKS } from '@/lib/calendar'
import EventDetailsDialog from '@/components/events/EventDetailsDialog'
import { EventDialog as EditEventDialog, eventBody, toCard, withDraft } from '@/components/events/OfficerEvents'

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

	// on the saved draft, if it has one (withDraft)
	const open = async (row) => {
		if (row.canEdit === false) {
			setViewing(row)
			return
		}
		onError?.(null)
		try {
			setEditing(await withDraft(toCard(row)))
		} catch (err) {
			onError?.(err.message)
		}
	}

	// Same body /events sends — publish, or `published` false for a draft.
	const update = async (values, published = true) => {
		onError?.(null)
		try {
			await eventsApi.update(editing.id, { ...eventBody(values), published })
			await onChanged?.()
		} catch (err) {
			onError?.(err.message)
		}
		setEditing(null)
	}

	// discard on one with a draft saved: the draft goes, the live event stays
	const discardDraft = async () => {
		onError?.(null)
		try {
			await eventsApi.update(editing.id, { discardDraft: true })
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
					onDiscardDraft={discardDraft}
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
