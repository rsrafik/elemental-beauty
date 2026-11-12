'use client'

import { useEffect, useState } from 'react'
import { landing } from '@/lib/api'
import { ALBUM, SPONSORS, TEAM } from './content'

// What an admin has put on the page (/landing-editor), in the shapes the
// sections already draw from content.js. The page is a static export, so it
// asks the API once it's in the browser (GET /api/landing, no sign-in) and
// renders the placeholders until then — and for good if the request fails.
//
// Per section: no entries keeps that section's placeholders; one or more and
// only the real ones show. Anything optional left empty is simply not there
// (undefined), so the sections leave it off.
//
// Asked once per page load, however many sections ask.

// the stand-ins' swatch colours and tilts, handed round in turn to real
// entries without a picture (people) or for the rail's lean
const SHADES = ['salmon', 'lilac', 'green', 'yellow', 'serum', 'orange', 'berry', 'blue']
const TILTS = [5, -6, 6, -4, 4, -5]

const or = (value) => value || undefined

const prettyDate = (ymd) => {
	if (!ymd) return undefined
	const [year, month, day] = ymd.split('-').map(Number)
	return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

// The rail shows `name || role`, and the portrait's label is `role`: so the
// title (what the rail shows) goes in `name`, and their name in `role`.
const toPerson = (row, index) => ({
	name: row.title,
	role: or(row.name),
	text: or(row.description),
	src: or(row.imageUrl),
	shade: SHADES[index % SHADES.length],
	tilt: TILTS[index % TILTS.length],
})

const toPhoto = (row, index) => ({
	title: row.title,
	date: prettyDate(row.date),
	text: or(row.description),
	src: row.imageUrl,
	shade: SHADES[index % SHADES.length],
})

const toSponsor = (row) => ({
	name: or(row.title),
	image: or(row.imageUrl),
	href: or(row.website),
})

// A band is its list twice over, slid by one list's width, so a short list
// would leave a gap across a wide screen: each row is repeated until it's at
// least this long. The repeats are marked so screen readers skip them.
const BAND = 6

function bands(sponsors) {
	const rows = sponsors.length < 2 ? [sponsors] : [sponsors.filter((_, at) => at % 2 === 0), sponsors.filter((_, at) => at % 2 === 1)]
	return rows.map((row) => {
		const out = row.map((sponsor) => ({ ...sponsor }))
		for (let at = 0; out.length < BAND; at++) out.push({ ...row[at % row.length], repeat: true })
		return out
	})
}

const PLACEHOLDERS = { people: TEAM.people, photos: ALBUM.photos, sponsorRows: SPONSORS.rows }

let shared = null // the promise of what the API said

function shape(content) {
	return {
		people: content?.people?.length ? content.people.map(toPerson) : PLACEHOLDERS.people,
		photos: content?.album?.length ? content.album.map(toPhoto) : PLACEHOLDERS.photos,
		sponsorRows: content?.sponsors?.length ? bands(content.sponsors.map(toSponsor)) : PLACEHOLDERS.sponsorRows,
	}
}

let shaped = null

// { people, photos, sponsorRows }: each the section's content.js list until
// the API answers with something for it
export function useLandingContent() {
	const [content, setContent] = useState(shaped ?? PLACEHOLDERS)

	useEffect(() => {
		if (shaped) return
		let live = true
		shared ??= landing.page().catch(() => null)
		shared.then((answer) => {
			shaped ??= shape(answer)
			if (live) setContent(shaped)
		})
		return () => { live = false }
	}, [])

	return content
}
