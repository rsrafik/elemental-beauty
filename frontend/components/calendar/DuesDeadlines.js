'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { payments as paymentsApi } from '@/lib/api'

// The viewer's unpaid due dates on the calendar — one for every lab or event
// they're signed up for (or offered) and still owe for (GET /payments/deadlines:
// a week before, their confirmation deadline, their 48 hours owing late, a
// sent-back payment's 48 hours, or an offer's). The day it's due on turns light
// red (DUE_CELL) and says, in bold, what and how much by when (DueLine). Both
// calendars, the member's and the officers', draw them the same way.

// the day's box, when something's due on it: square, the cell's width, and
// from the line above the week to the line under it — the negative margin
// takes it down through the week row's bottom padding to its rule (the rows
// are pb-2 / md:pb-4 in both calendars), and the padding keeps what's in it
// off that line
export const DUE_CELL = 'bg-red/10 -mb-2 md:-mb-4 pb-2 md:pb-4 md:pl-2'

const money = (amount) => Number(amount).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 })
const timeText = (at) => new Date(at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

const PAGES = { lab: (id) => `/labs/view?id=${id}`, event: (id) => `/events/view?id=${id}` }

// Their due dates, as a lookup: dueOn(year, month, day) — month 0-based, the
// way the calendars count — gives the ones due that day. Read once, on the
// calendar's own clock (the browser's), like the rest of the grid.
export function useDuesDeadlines() {
	const [byDay, setByDay] = useState({})
	useEffect(() => {
		let live = true
		paymentsApi.deadlines()
			.then((list) => {
				if (!live) return
				const map = {}
				for (const due of list) {
					const at = new Date(due.at)
					const key = `${at.getFullYear()}-${at.getMonth()}-${at.getDate()}`
					;(map[key] ??= []).push(due)
				}
				setByDay(map)
			})
			// staff never owe anything, and a calendar without them is still a
			// calendar
			.catch(() => {})
		return () => { live = false }
	}, [])
	return (year, month, day) => byDay[`${year}-${month}-${day}`] ?? []
}

// 'Lip Scrub $20 due by 8:11 PM', bold and red, to its page — where it's paid
export function DueLine({ due, className = '' }) {
	return (
		<Link
			href={PAGES[due.kind](due.id)}
			className={`
				block
				font-vietnam
				font-bold
				text-[12px]
				leading-tight
				text-red
				hover:underline
				underline-offset-2
				${className}
			`}
		>
			{due.title} {money(due.amount)} due by {timeText(due.at)}
		</Link>
	)
}
