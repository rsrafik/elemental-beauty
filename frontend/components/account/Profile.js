'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import DashboardShell from '@/components/dashboards/DashboardShell'
import { Popup, PopupButton } from '@/components/labs/LabViewParts'
import { hasRole, roleLabel } from '@/lib/roles'
import { useRole, useSession, useSignOut } from '@/lib/session'
import { members as membersApi, auth } from '@/lib/api'
import { longDate, prettyTime } from '@/lib/dates'
import { useDismiss } from '@/lib/dismiss'
import { AVATAR_MAX, shrinkImage } from '@/lib/images'

// /account — the one page that's about the person looking at it rather than
// about the club. Same sidebar as everywhere else; it's just another stop on
// the menu.
//
// The page is built as a masthead and two things underneath it:
//
//   masthead   a salmon banner with the photo hung off its bottom edge and the
//              name sitting on the cream beside it, so the top of the page is
//              one shape rather than a card in a row of cards
//   counter    the five numbers on one white rule — points first, then what
//              earned them. A strip rather than tiles: they're one sentence
//              about the same person, not five separate readings. Each number
//              opens a popup of what it counts (see HistoryDialog).
//   below      what you can change on the left (a paper form: underlines, not
//              boxes) and where you stand on the right (a rail — the board as
//              a line you're a point on, rather than a list you're a row in)
//
// The photo belongs to the form even though it sits up in the masthead: one
// draft, one save, so a picked photo can't quietly commit itself while the
// names are still unsaved.
//
// Somebody with an account and no member row (role 'user') has no points and no
// place, so the counter and the rail aren't drawn for them — the rail's card
// says what they'd have to do to get one.

// ---- data ------------------------------------------------------------------

// The counter's four numbers before GET /members/me answers. Zeroes rather
// than blanks: the strip is five cells wide either way, and a member who really
// has done nothing yet sees the same thing.
//
// The email is what's edited here, and the username beside it is only ever its
// first half — the part before the @, which is what you log in with. PUT
// /members/me moves the two together, so the page derives the username rather
// than letting it be typed and disagree.
const NO_STATS = { pastLabs: 0, rsvpLabs: 0, pastEvents: 0, rsvpEvents: 0 }

// GET /members returns the roster with the user row nested under it. The board
// only wants the four fields it ranks and prints.
function toBoard(rows) {
	return rows.map((row) => ({
		id: row.userId,
		first: row.user?.firstName ?? '',
		last: row.user?.lastName ?? '',
		points: row.points,
	}))
}

// The role, written on the banner as a stamped rosette. 'user' is the one the
// roster has no row for: an account with no membership behind it yet.
const ROLE_INK = {
	user: 'text-black/45 border-black/25',
	member: 'text-salmon-dark border-salmon-dark/60',
	officer: 'text-blue-med border-blue-med/60',
	jboard: 'text-[#6B4FBF] border-[#6B4FBF]/60',
	treasurer: 'text-yellow-dark border-yellow-dark/60',
	admin: 'text-green-dark border-green-dark/60',
}

// The colour each number on the counter is written in. Five different inks on
// one white strip is what keeps it from reading as a table.
const COUNTER_INK = {
	points: 'text-salmon-med',
	pastLabs: 'text-green-dark',
	rsvpLabs: 'text-yellow-dark',
	pastEvents: 'text-blue-med',
	rsvpEvents: 'text-orange-dark',
}

// How many places either side of yours the rail names.
const REACH = 2

// The banner's bubbles: x/y are percentages of the banner, so the drift holds
// its shape at every width, and the big faint ones sit under the small bright
// ones. Placed by hand — a random scatter reliably lands two of them on top of
// each other.
const BUBBLES = [
	{ x: 4, y: 52, size: 120, opacity: 0.12 },
	{ x: 16, y: -18, size: 74, opacity: 0.16 },
	{ x: 27, y: 58, size: 46, opacity: 0.2 },
	{ x: 38, y: 8, size: 96, opacity: 0.1 },
	{ x: 52, y: 62, size: 64, opacity: 0.16 },
	{ x: 63, y: 4, size: 34, opacity: 0.24 },
	{ x: 74, y: 46, size: 110, opacity: 0.1 },
	{ x: 88, y: 70, size: 52, opacity: 0.18 },
]

// ---- helpers ---------------------------------------------------------------

function initials(first, last) {
	return `${(first || '?').charAt(0)}${(last || '?').charAt(0)}`.toUpperCase()
}

// '2025-09-02' -> 'Sep 2, 2025'. Split by hand rather than through Date, which
// reads a bare date string as UTC and can hand back the day before.
//
// The API sends dates as full ISO timestamps ('2025-09-02T00:00:00.000Z'), so
// the date half is taken off the front first — splitting the whole string on
// '-' would make the day '02T00:00:00.000Z' and the whole thing NaN.
function prettyDate(value) {
	if (!value) return ''
	const [year, month, day] = String(value).slice(0, 10).split('-').map(Number)
	return new Date(year, month - 1, day).toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	})
}

// Points first, name to break a tie — otherwise two people on the same score
// would swap places between renders.
function ranked(board) {
	return [...board]
		.sort((a, b) => b.points - a.points || a.first.localeCompare(b.first))
		.map((person, i) => ({ ...person, place: i + 1 }))
}

// What the rail draws: the top of the board, the places around yours, and —
// wherever those two runs don't meet — a marker for the stretch in between.
// So the whole board is accounted for in about seven rows, and the distance
// between you and the top is a length on the page rather than a number you
// have to work out.
function railRows(board, place) {
	const named = new Set([1, 2, 3])
	if (place) {
		for (let p = place - REACH; p <= place + REACH; p++) {
			if (p >= 1 && p <= board.length) named.add(p)
		}
	}

	const rows = []
	let last = 0
	for (const person of board) {
		if (!named.has(person.place)) continue
		if (person.place - last > 1) {
			rows.push({ key: `gap-${person.place}`, skipped: person.place - last - 1 })
		}
		rows.push({ key: person.id, person })
		last = person.place
	}
	if (last < board.length) {
		rows.push({ key: 'gap-tail', skipped: board.length - last, tail: true })
	}
	return rows
}

// ---- icons -----------------------------------------------------------------

function CameraIcon({ className = '' }) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			<path d="M3.5 8.5h3l1.5-2.5h8l1.5 2.5h3v10h-17z" />
			<circle cx="12" cy="13" r="3.5" />
		</svg>
	)
}

function CloseIcon({ className = '' }) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
			strokeLinecap="round"
			className={className}
			aria-hidden="true"
		>
			<path d="M6 6l12 12M18 6L6 18" />
		</svg>
	)
}

function CheckIcon({ className = '' }) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="3"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			<path d="M5 12.5l4.5 4.5L19 7" />
		</svg>
	)
}

function KeyIcon({ className = '' }) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			<circle cx="8.5" cy="12" r="3.5" />
			<path d="M12 12h8.5" />
			<path d="M17 12v3" />
			<path d="M20.5 12v2" />
		</svg>
	)
}

function MailIcon({ className = '' }) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			<rect x="3" y="5.5" width="18" height="13" rx="2.5" />
			<path d="M4 7l8 5.5L20 7" />
		</svg>
	)
}

// ---- the masthead ----------------------------------------------------------

// The photo, and the control for changing it. Picking one only previews it:
// there's nowhere to upload to yet, so the file never leaves the browser and
// the path it would be stored under arrives with that endpoint.
//
// The cream ring is what lets it hang off the banner — the same colour as the
// page, so the circle punches a hole in the salmon rather than sitting on it.
function PhotoPicker({ photo, name, onPick, onClear, className = '' }) {
	const input = useRef(null)

	const pick = (event) => {
		const file = event.target.files?.[0]
		if (!file) return
		// shrunk to a small square-ish JPEG first: the photo is sent back with
		// every roster and leaderboard read, so it has to stay tiny (lib/images.js)
		shrinkImage(file, AVATAR_MAX, { keepUnder: 60_000 }).then(onPick).catch(() => {})
		// so picking the same file twice still fires a change
		event.target.value = ''
	}

	return (
		// w-fit, and self-start for the stacked layout: the badge is positioned
		// against this box, so a box that stretches the width of the column would
		// throw the badge out to the far edge of the page.
		<div className={`
			relative
			w-fit
			self-start
			shrink-0
			${className}
		`}>
			<button
				type="button"
				onClick={() => input.current?.click()}
				aria-label="Change profile photo"
				className="
					group
					relative
					block
					w-[118px]
					h-[118px]
					sm:w-[150px]
					sm:h-[150px]
					overflow-hidden
					rounded-full
					border-[6px]
					border-cream
					bg-salmon-light
					cursor-pointer
					transition-transform
					duration-300
					ease-out
					hover:-rotate-3
				"
			>
				{photo ? (
					<img
						src={photo}
						alt=""
						className="
							w-full
							h-full
							object-cover
						"
					/>
				) : (
					<span className="
						w-full
						h-full
						flex
						items-center
						justify-center
						font-canobis
						text-[42px]
						sm:text-[54px]
						text-salmon-dark
						select-none
					">
						{name}
					</span>
				)}

				{/* the scrim is only on the way in — a permanent overlay on a photo
				    you chose is the app second-guessing it */}
				<span className="
					absolute
					inset-0
					flex
					items-center
					justify-center
					bg-black/45
					text-white
					opacity-0
					transition-opacity
					duration-200
					ease-out
					group-hover:opacity-100
				">
					<CameraIcon className="w-7 h-7" />
				</span>
			</button>

			{/* the badge says the circle is a control even when nobody's hovering */}
			<button
				type="button"
				onClick={() => (photo ? onClear() : input.current?.click())}
				aria-label={photo ? 'Remove profile photo' : 'Add a profile photo'}
				className="
					absolute
					bottom-0
					right-0
					w-9
					h-9
					flex
					items-center
					justify-center
					rounded-full
					border-[3px]
					border-cream
					bg-black
					text-cream
					cursor-pointer
					transition-all
					duration-200
					ease-out
					hover:brightness-150
					active:scale-95
				"
			>
				{photo
					? <CloseIcon className="w-3.5 h-3.5" />
					: <CameraIcon className="w-4 h-4" />}
			</button>

			<input
				ref={input}
				type="file"
				accept="image/*"
				onChange={pick}
				className="hidden"
			/>
		</div>
	)
}

// The role, stamped rather than labelled: dashed, tilted, and sitting on the
// banner the way a rubber stamp sits on a form.
function RoleStamp({ role }) {
	return (
		<span className={`
			inline-flex
			items-center
			rounded-full
			border-2
			border-dashed
			bg-cream/70
			px-5
			py-1.5
			font-vietnam
			font-bold
			text-xs
			sm:text-sm
			uppercase
			tracking-[0.22em]
			-rotate-6
			select-none
			${ROLE_INK[role] ?? ROLE_INK.user}
		`}>
			{role === 'user' ? 'no membership' : roleLabel(role)}
		</span>
	)
}

// Banner, photo, name — one shape. The salmon runs the width of the column and
// takes a deep bite out of its bottom-right corner; the role is stamped in the
// top corner; the photo and the name sit along the bottom of it, with the
// circle hanging past the edge into the cream.
//
// The name is *on* the salmon rather than under it, so the top of the page is a
// single object: colour, face, name. The overhang is what keeps it from being a
// flat band — the circle belongs to both the banner and the page.
//
// The band is kept as shallow as the name and the circle need it to be: the
// stamp and the date are taken out of the flow and hung in the top corner, so
// they cost the banner no height at all and there's no empty salmon between
// them and the name. What's left setting the height is one row — the photo and
// the name — plus its padding. The rest of the page gains everything the band
// gives up, which is what lets the form and the password bar finish inside one
// screen.
//
// From `sm` the circle's negative bottom margin is how far it drops past the
// banner's inner edge; what shows below the banner is that minus the banner's
// own bottom padding (72 - 20 ≈ 52px). The section carries a matching bottom
// padding, because a negative margin takes up no room and the counter would
// otherwise be laid out underneath the circle. Stacked, the name is below the
// photo rather than beside it, so a circle pulled downward would land on top of
// it — there the photo sits inside the banner and nothing overhangs.
function Masthead({ role, profile, draft, onPick, onClear }) {
	return (
		// Only the wide layout hangs the circle out of the banner, so only it
		// needs room reserved underneath.
		<section className="
			pb-0
			sm:pb-[48px]
		">
			{/* not overflow-hidden: the photo has to be able to hang out of the
			    bottom. The bubbles bring their own clip, with the same corners. */}
			<div className="
				relative
				rounded-[24px]
				rounded-br-[56px]
				sm:rounded-br-[72px]
				bg-salmon
				px-5
				sm:px-8
				pt-4
				sm:pt-5
				pb-5
				flex
				flex-col
			">
				{/* Texture, not decoration with a meaning: bubbles drifting across
				    the salmon, cut off by the banner's own edges. They're behind
				    everything and nothing is measured off them, so the photo and
				    the stamp can sit wherever the layout wants them. */}
				<span
					aria-hidden="true"
					className="
						pointer-events-none
						absolute
						inset-0
						overflow-hidden
						rounded-[24px]
						rounded-br-[56px]
						sm:rounded-br-[72px]
					"
				>
					{BUBBLES.map((bubble, i) => (
						<span
							key={i}
							className="
								absolute
								rounded-full
								bg-white
							"
							style={{
								left: `${bubble.x}%`,
								top: `${bubble.y}%`,
								width: `${bubble.size}px`,
								height: `${bubble.size}px`,
								opacity: bubble.opacity,
							}}
						/>
					))}
				</span>

				{/* Out of the flow on purpose — see the note above. It sits in the
				    corner the banner's deep radius doesn't touch, opposite the
				    photo, so it clears the name at every width. */}
				<div className="
					absolute
					top-4
					right-5
					sm:top-5
					sm:right-8
					flex
					flex-col
					items-end
					gap-2
				">
					<RoleStamp role={role} />
					{/* a member joined the club on this date; somebody without a
					    member row only opened an account */}
					<span className="
						font-vietnam
						text-[11px]
						sm:text-xs
						uppercase
						tracking-[0.14em]
						text-black/45
					">
						{hasRole('member', role) ? 'joined' : 'account since'}
						{' '}
						{prettyDate(profile.joined)}
					</span>
				</div>

				{/* Photo and name along the bottom edge. Side by side once there's
				    room for both; stacked on a phone, where a name beside a 118px
				    circle in a 340px banner has about a word and a half of space.
				    The phone layout starts below the stamp rather than beside it. */}
				<div className="
					relative
					mt-[76px]
					sm:mt-0
					flex
					flex-col
					items-start
					sm:flex-row
					sm:items-end
					gap-4
					sm:gap-6
				">
					<PhotoPicker
						photo={draft.photo}
						name={initials(draft.first, draft.last)}
						onPick={onPick}
						onClear={onClear}
						className="sm:-mb-[64px]"
					/>

					<div className="
						min-w-0
						max-w-full
					">
						<h1 className="
							font-canobis
							text-[36px]
							sm:text-[52px]
							leading-none
							text-black
							break-words
						">
							{draft.first} {draft.last}
						</h1>
						<p className="
							mt-2
							font-vietnam
							text-sm
							sm:text-base
							text-black/50
							truncate
						">
							{draft.email}
						</p>
					</div>
				</div>
			</div>
		</section>
	)
}

function VerifiedTag() {
	return (
		<span className="
			shrink-0
			inline-flex
			items-center
			gap-1
			rounded-full
			bg-green
			px-2
			py-0.5
			font-vietnam
			font-semibold
			text-[10px]
			text-green-dark
		">
			<CheckIcon className="w-2.5 h-2.5" />
			verified
		</span>
	)
}

// 'lauren7712@purdue.edu' -> 'lauren7712' — the server's rule, shown as you type
function usernameOf(email) {
	const at = email.indexOf('@')
	return (at === -1 ? email : email.slice(0, at)).trim().toLowerCase()
}

// ---- the counter -----------------------------------------------------------

// One number and what it counts. The rules between cells are drawn by the
// strip, not by the cell, so the ends of the row stay open.
//
// With `onOpen` it's a button — the number opens the history behind it.
function CounterCell({ value, label, ink, onOpen, className = '' }) {
	const Tag = onOpen ? 'button' : 'div'
	return (
		<Tag
			{...(onOpen ? { type: 'button', onClick: onOpen, 'aria-label': `${value} ${label} — see the history` } : {})}
			className={`
				flex
				flex-col
				items-center
				justify-center
				px-2
				py-3
				${onOpen ? `
					cursor-pointer
					rounded-[18px]
					transition-colors
					duration-200
					hover:bg-black/[0.03]
				` : ''}
				${className}
			`}
		>
			<p className={`
				font-beachday
				text-[32px]
				sm:text-[38px]
				leading-none
				${ink}
			`}>
				{value}
			</p>
			<p className="
				mt-1.5
				font-vietnam
				text-[10px]
				sm:text-[11px]
				uppercase
				tracking-[0.14em]
				text-black/45
				text-center
				whitespace-nowrap
			">
				{label}
			</p>
		</Tag>
	)
}

function Counter({ points, stats, onOpen }) {
	return (
		// Five cells never divide evenly into a narrow grid, so points takes the
		// whole first row on a phone and the other four pair off underneath it —
		// which is the right emphasis anyway: the four are what the one is made
		// of. One row of five from `sm` up.
		<section className="
			rounded-[24px]
			bg-white
			px-2
			sm:px-4
			grid
			grid-cols-2
			sm:grid-cols-5
			divide-x-0
			sm:divide-x
			divide-black/10
			shadow-[0_0_20px_rgba(0,0,0,0.12)]
		">
			{/* the rules are only drawn once the five sit on one line — in the
			    stacked grid `divide-x` would put a border down the left edge of
			    every cell that starts a row, which is a line hanging off the front
			    of the strip rather than a rule between two numbers */}
			<CounterCell
				value={points}
				label="points"
				ink={COUNTER_INK.points}
				onOpen={() => onOpen('points')}
				className="
					col-span-2
					sm:col-span-1
					border-b
					border-black/10
					sm:border-b-0
				"
			/>
			<CounterCell value={stats.pastLabs} label="labs done" ink={COUNTER_INK.pastLabs} onOpen={() => onOpen('pastLabs')} />
			<CounterCell value={stats.rsvpLabs} label="labs rsvp'd" ink={COUNTER_INK.rsvpLabs} onOpen={() => onOpen('rsvpLabs')} />
			<CounterCell value={stats.pastEvents} label="events done" ink={COUNTER_INK.pastEvents} onOpen={() => onOpen('pastEvents')} />
			<CounterCell value={stats.rsvpEvents} label="events rsvp'd" ink={COUNTER_INK.rsvpEvents} onOpen={() => onOpen('rsvpEvents')} />
		</section>
	)
}

// ---- the history behind the counter ----------------------------------------

// What each number's popup is called and which rows it lists. GET
// /members/me/history hands back every sign-up with its status; the popups
// are filters over it.
const HOLDING = ['rsvped', 'waitlisted', 'offered']
const HISTORY = {
	points: { title: 'points' },
	pastLabs: { title: 'labs done', list: 'labs', keep: (row) => row.status === 'attended', empty: 'No labs checked into yet.' },
	rsvpLabs: { title: "labs rsvp'd", list: 'labs', keep: (row) => HOLDING.includes(row.status), empty: 'You’re not signed up for any labs right now.', ahead: true },
	pastEvents: { title: 'events done', list: 'events', keep: (row) => row.status === 'attended', empty: 'No events checked into yet.' },
	rsvpEvents: { title: "events rsvp'd", list: 'events', keep: (row) => HOLDING.includes(row.status), empty: 'You’re not signed up for any events right now.', ahead: true },
}

const STATUS_CHIP = {
	rsvped: { text: 'going', className: 'bg-green/40 text-green-dark' },
	waitlisted: { text: 'waitlist', className: 'bg-yellow-light text-yellow-dark' },
	offered: { text: 'spot offered', className: 'bg-blue-light/60 text-blue-med' },
}

const AWARD_REASON = {
	instagram_repost: 'instagram repost',
	instagram_follow: 'followed on instagram',
	discord_join: 'joined the discord',
}

// 'october 10, 2026 · 5:00 PM'
function whenLine(row) {
	return [row.date ? longDate(row.date).toLowerCase() : 'no date yet', prettyTime(row.startTime)].filter(Boolean).join(' · ')
}

function HistoryRow({ href, title, sub, right }) {
	const body = (
		<>
			<div className="min-w-0">
				<p className="
					font-vietnam
					font-semibold
					text-[15px]
					leading-tight
					text-black
					truncate
				">
					{title}
				</p>
				<p className="
					mt-0.5
					font-vietnam
					text-[12px]
					text-black/50
				">
					{sub}
				</p>
			</div>
			<div className="shrink-0">{right}</div>
		</>
	)
	const className = `
		flex
		items-center
		justify-between
		gap-3
		py-3
	`
	return (
		<li className="
			border-b
			border-black/10
			last:border-b-0
		">
			{href
				? <Link href={href} className={`${className} transition-opacity duration-200 hover:opacity-70`}>{body}</Link>
				: <div className={className}>{body}</div>}
		</li>
	)
}

function PointsTag({ points }) {
	return (
		<span className={`
			font-beachday
			text-[22px]
			leading-none
			${points < 0 ? 'text-black/40' : 'text-salmon-med'}
		`}>
			{points > 0 ? `+${points}` : points}
		</span>
	)
}

// The popup behind one number. `which` is a key of HISTORY; `history` is the
// endpoint's answer (null while it's on its way).
function HistoryDialog({ which, history, error, onClose }) {
	const config = HISTORY[which]
	const hint = 'font-vietnam text-sm text-black/55 mt-3'

	let content
	if (error) {
		content = <p className={hint}>{error}</p>
	} else if (!history) {
		content = <p className={hint}>loading…</p>
	} else if (which === 'points') {
		// every row that earned something, newest first, and whatever the log
		// can't account for as one line at the bottom so it all adds up
		const earned = [
			...history.labs.filter((row) => row.points).map((row) => ({
				key: `lab-${row.labId}`, href: `/labs/view?id=${row.labId}`, title: row.title,
				sub: `lab · ${whenLine(row)}`, points: row.points, at: row.date,
			})),
			...history.events.filter((row) => row.points).map((row) => ({
				key: `event-${row.eventId}`, href: `/events/view?id=${row.eventId}`, title: row.title,
				sub: `${row.type === 'official' ? 'official' : 'social'} event · ${whenLine(row)}`, points: row.points, at: row.date,
			})),
			...history.awards.map((row) => ({
				key: `award-${row.id}`, title: AWARD_REASON[row.reason] ?? 'bonus points',
				sub: `from ${row.by} · ${longDate(row.at).toLowerCase()}`, points: row.points, at: row.at,
			})),
		].sort((a, b) => String(b.at ?? '').localeCompare(String(a.at ?? '')))

		content = (
			<>
				<p className={hint}>
					Where your {history.points} {history.points === 1 ? 'point' : 'points'} came from: 8 for a lab, 5 for
					an official event, 3 for a social one, plus anything an officer gave you.
				</p>
				{earned.length === 0 && history.earlier === 0
					? <p className={hint}>No points yet — check into a lab or event to start.</p>
					: (
						<ul className="mt-3">
							{earned.map(({ key, ...row }) => (
								<HistoryRow key={key} href={row.href} title={row.title} sub={row.sub} right={<PointsTag points={row.points} />} />
							))}
							{history.earlier !== 0 && (
								<HistoryRow
									title="earlier points"
									sub="from before the club kept a history"
									right={<PointsTag points={history.earlier} />}
								/>
							)}
						</ul>
					)}
			</>
		)
	} else {
		const kind = config.list === 'labs' ? 'lab' : 'event'
		const rows = history[config.list].filter(config.keep)
		// what's coming up reads soonest first; what's done, newest first
		if (config.ahead) rows.reverse()
		content = rows.length === 0
			? <p className={hint}>{config.empty}</p>
			: (
				<ul className="mt-3">
					{rows.map((row) => {
						const id = row.labId ?? row.eventId
						const chip = STATUS_CHIP[row.status]
						let right
						if (chip) {
							right = (
								<span className={`
									rounded-full
									px-2.5
									py-1
									font-vietnam
									font-semibold
									text-[11px]
									uppercase
									tracking-[0.1em]
									${chip.className}
								`}>
									{chip.text}
								</span>
							)
						} else if (kind === 'lab') {
							right = (
								<span className={`
									font-vietnam
									font-semibold
									text-[12px]
									${row.quizPassed ? 'text-green-dark' : 'text-black/40'}
								`}>
									{row.quizPassed ? 'quiz passed ✓' : 'quiz to take'}
								</span>
							)
						} else {
							right = <PointsTag points={row.points} />
						}
						return (
							<HistoryRow
								key={id}
								href={`/${config.list}/view?id=${id}`}
								title={row.title}
								sub={[whenLine(row), row.location].filter(Boolean).join(' · ')}
								right={right}
							/>
						)
					})}
				</ul>
			)
	}

	return (
		<Popup title={config.title} onClose={onClose}>
			{(dismiss) => (
				<>
					{content}
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

// ---- the form --------------------------------------------------------------

// A line to write on rather than a box to fill in: the underline is the whole
// field, and it takes the club's salmon while you're in it.
// `tag` rides at the right end of the label's line — the email's "verified".
function Line({ label, value, onChange, placeholder, type = 'text', autoComplete = 'off', tag = null }) {
	return (
		<label className="block">
			<span className="
				flex
				items-center
				justify-between
				gap-2
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
				{tag}
			</span>
			<input
				type={type}
				value={value}
				onChange={onChange}
				placeholder={placeholder}
				autoComplete={autoComplete}
				className="
					mt-1
					w-full
					bg-transparent
					border-b-2
					border-black/15
					px-1
					pb-2
					font-vietnam
					text-[17px]
					sm:text-[19px]
					text-black
					outline-none
					transition-colors
					duration-200
					ease-out
					hover:border-black/35
					focus:border-salmon
				"
			/>
		</label>
	)
}

function DetailsCard({ draft, dirty, ready, saved, saving, error, verified, onChange, onSave, onRevert }) {
	return (
		<section className="
			rounded-[26px]
			bg-white
			p-6
			sm:p-8
			shadow-[0_0_20px_rgba(0,0,0,0.12)]
		">
			<h2 className="
				font-beachday
				text-[28px]
				sm:text-[34px]
				leading-none
				text-black
			">
				your details
			</h2>
			<p className="
				mt-2
				font-vietnam
				text-sm
				text-black/50
			">
				What the roster, the board and your Elementist pass call you.
			</p>

			<div className="
				mt-7
				grid
				grid-cols-1
				sm:grid-cols-2
				gap-6
				sm:gap-7
			">
				<Line
					label="first name"
					value={draft.first}
					onChange={onChange('first')}
					placeholder="Isabel"
					autoComplete="given-name"
				/>
				<Line
					label="last name"
					value={draft.last}
					onChange={onChange('last')}
					placeholder="Harris"
					autoComplete="family-name"
				/>
				<Line
					label="email"
					type="email"
					value={draft.email}
					onChange={onChange('email')}
					placeholder="isabel887@purdue.edu"
					autoComplete="email"
					tag={verified && <VerifiedTag />}
				/>

				{/* Not a field: the username is the email's first half, so it's
				    written out here as the email changes rather than typed in twice
				    and left to disagree. Its line is drawn but never lights up.

				    It sits beside the email rather than under it — the two are the
				    same fact, and the pairing is what says so. */}
				<div>
					{/* the tag rides on the label line rather than the value line, so
					    the username gets the full width of the column */}
					<div className="
						flex
						items-center
						justify-between
						gap-2
					">
						<span className="
							font-vietnam
							text-[11px]
							uppercase
							tracking-[0.14em]
							text-black/45
						">
							username
						</span>
					</div>
					<div className="
						mt-1
						border-b-2
						border-dashed
						border-black/15
						px-1
						pb-2
					">
						<p className="
							font-vietnam
							text-[16px]
							sm:text-[18px]
							text-black/60
							truncate
						">
							{usernameOf(draft.email) || <span className="text-black/25">username</span>}
						</p>
					</div>
				</div>
			</div>

			{/* the footer says what state the form is in before it offers to act on
			    it: nothing to save, something to save, or just saved */}
			<div className="
				mt-8
				flex
				flex-wrap
				items-center
				justify-end
				gap-3
			">
				<p className={`
					mr-auto
					font-vietnam
					text-xs
					${error ? 'text-salmon-dark' : saved ? 'text-green-dark' : 'text-black/40'}
				`}>
					{/* one line, four things it can say — an error outranks the rest,
					    because it's the only one that needs doing something about */}
					{error
						? error
						: saving
							? 'saving…'
							: saved
								? 'saved'
								: dirty
									? 'unsaved changes'
									: 'everything up to date'}
				</p>

				<button
					type="button"
					onClick={onRevert}
					disabled={!dirty}
					className={`
						rounded-full
						px-5
						py-2
						font-vietnam
						font-semibold
						text-sm
						transition-all
						duration-200
						ease-out
						${dirty
							? `text-black/70
							   cursor-pointer
							   hover:bg-black/[0.06]
							   hover:text-black`
							: 'text-black/25 cursor-not-allowed'}
					`}
				>
					undo
				</button>
				<button
					type="button"
					onClick={onSave}
					disabled={!ready}
					className={`
						rounded-full
						px-7
						py-2.5
						font-vietnam
						font-semibold
						text-sm
						transition-all
						duration-200
						ease-out
						${ready
							? `bg-black
							   text-cream
							   cursor-pointer
							   hover:-translate-y-0.5
							   hover:shadow-lg
							   hover:shadow-black/25
							   active:translate-y-0
							   active:shadow-none`
							: 'bg-black/10 text-black/35 cursor-not-allowed'}
					`}
				>
					save changes
				</button>
			</div>
		</section>
	)
}

// The password doesn't live in the form above: it leaves through the mail
// rather than through the save button, so it gets its own strip.
// ---- email preferences ------------------------------------------------------

// One on/off switch. Each saves the moment it's flipped — there's nothing to
// review before sending, so it doesn't wait for the details form's button.
function Toggle({ label, hint, checked, busy, onChange }) {
	return (
		<label className="
			flex
			items-start
			justify-between
			gap-4
			py-3
			cursor-pointer
		">
			<span className="min-w-0">
				<span className="
					block
					font-vietnam
					font-semibold
					text-[15px]
					text-black
				">
					{label}
				</span>
				<span className="
					block
					mt-0.5
					font-vietnam
					text-sm
					text-black/55
				">
					{hint}
				</span>
			</span>
			<button
				type="button"
				role="switch"
				aria-checked={checked}
				aria-label={label}
				disabled={busy}
				onClick={() => onChange(!checked)}
				className={`
					relative
					mt-0.5
					w-11
					h-6
					shrink-0
					rounded-full
					cursor-pointer
					transition-colors
					duration-200
					ease-out
					disabled:opacity-60
					disabled:cursor-wait
					${checked ? 'bg-green' : 'bg-black/20'}
				`}
			>
				<span className={`
					absolute
					top-0.5
					left-0.5
					w-5
					h-5
					rounded-full
					bg-white
					shadow-[0_1px_3px_rgba(0,0,0,0.3)]
					transition-transform
					duration-200
					ease-out
					${checked ? 'translate-x-5' : ''}
				`} />
			</button>
		</label>
	)
}

// What officers' "email all" buttons may send you. Account mail — the link
// that confirms your address, password resets — isn't optional and isn't
// listed.
function EmailPrefsCard({ user, onSaved, className = '' }) {
	const staff = hasRole('officer', user?.role)
	const [prefs, setPrefs] = useState(() => ({
		emailClub: user?.emailClub !== false,
		emailEvents: user?.emailEvents !== false,
	}))
	const [busy, setBusy] = useState(null)
	const [error, setError] = useState(null)

	const flip = (key) => async (value) => {
		setBusy(key)
		setError(null)
		setPrefs((prev) => ({ ...prev, [key]: value }))
		try {
			await membersApi.update({ [key]: value })
			await onSaved()
		} catch (err) {
			setPrefs((prev) => ({ ...prev, [key]: !value }))
			setError(err.message)
		} finally {
			setBusy(null)
		}
	}

	return (
		<section className={`
			rounded-[26px]
			bg-white
			p-6
			sm:px-8
			shadow-[0_0_20px_rgba(0,0,0,0.12)]
			${className}
		`}>
			<h2 className="
				font-beachday
				text-[24px]
				sm:text-[28px]
				leading-none
				text-black
			">
				emails
			</h2>
			<p className="
				mt-1.5
				font-vietnam
				text-sm
				text-black/55
			">
				What officers can send you. Emails about your account — confirming
				your address, resetting your password — always come through.
				{staff && ' As staff you start opted out — turn these on if you want them, say for an event you’ve signed up for.'}
			</p>
			<div className="
				mt-3
				divide-y
				divide-black/10
			">
				<Toggle
					label="club-wide emails"
					hint="News and updates officers send to every member."
					checked={prefs.emailClub}
					busy={busy === 'emailClub'}
					onChange={flip('emailClub')}
				/>
				<Toggle
					label="lab & event emails"
					hint="Messages about labs and events you've signed up for."
					checked={prefs.emailEvents}
					busy={busy === 'emailEvents'}
					onChange={flip('emailEvents')}
				/>
			</div>
			{error && (
				<p className="
					mt-2
					font-vietnam
					text-sm
					text-salmon-dark
				">
					{error}
				</p>
			)}
		</section>
	)
}

function PasswordCard({ onReset, className = '' }) {
	return (
		<section className={`
			rounded-[26px]
			bg-yellow-light
			p-6
			sm:px-8
			flex
			flex-wrap
			items-center
			justify-between
			gap-5
			${className}
		`}>
			<div className="
				flex
				items-center
				gap-4
				min-w-0
			">
				<span className="
					w-11
					h-11
					shrink-0
					flex
					items-center
					justify-center
					rounded-full
					bg-yellow
					text-yellow-dark
				">
					<KeyIcon className="w-5 h-5" />
				</span>
				<div className="min-w-0">
					<h2 className="
						font-beachday
						text-[24px]
						sm:text-[28px]
						leading-none
						text-black
					">
						password
					</h2>
					<p className="
						mt-1.5
						font-vietnam
						text-sm
						text-black/55
					">
						We email you a link, you pick the new one.
					</p>
				</div>
			</div>

			<button
				type="button"
				onClick={onReset}
				className="
					ml-auto
					rounded-full
					bg-black
					px-6
					py-2.5
					font-vietnam
					font-semibold
					text-sm
					text-cream
					cursor-pointer
					transition-all
					duration-200
					ease-out
					hover:-translate-y-0.5
					hover:shadow-lg
					hover:shadow-black/25
					active:translate-y-0
					active:shadow-none
				"
			>
				reset password
			</button>
		</section>
	)
}

// ---- deleting the account --------------------------------------------------

// The last band on the page, and deliberately the quietest one: it's there
// when somebody goes looking for it.
function DeleteAccountCard({ onDelete, className = '' }) {
	return (
		<section className={`
			rounded-[26px]
			border
			border-salmon-dark/25
			p-6
			sm:px-8
			flex
			flex-wrap
			items-center
			justify-between
			gap-5
			${className}
		`}>
			<div className="min-w-0">
				<h2 className="
					font-beachday
					text-[24px]
					sm:text-[28px]
					leading-none
					text-salmon-dark
				">
					delete account
				</h2>
				<p className="
					mt-1.5
					font-vietnam
					text-sm
					text-black/55
				">
					Your points, sign-ups and history go with it. This can&apos;t be undone.
				</p>
			</div>
			<button
				type="button"
				onClick={onDelete}
				className="
					ml-auto
					rounded-full
					border
					border-salmon-dark
					px-6
					py-2.5
					font-vietnam
					font-semibold
					text-sm
					text-salmon-dark
					cursor-pointer
					transition-all
					duration-200
					ease-out
					hover:bg-salmon-dark
					hover:text-cream
					active:scale-[0.98]
				"
			>
				delete my account
			</button>
		</section>
	)
}

// Asks for the password again before anything goes — a laptop left signed in
// shouldn't be enough to wipe someone out. The server checks it (DELETE
// /auth/me) and refuses the club's last admin.
function DeleteAccountDialog({ onClose, onDeleted }) {
	const [password, setPassword] = useState('')
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState(null)
	const ready = password !== '' && !busy

	const submit = async (event) => {
		event.preventDefault()
		if (!ready) return
		setBusy(true)
		setError(null)
		try {
			await auth.deleteAccount(password)
			onDeleted()
		} catch (err) {
			setError(err.message)
			setBusy(false)
		}
	}

	return (
		<Popup title="delete account?" onClose={onClose}>
			{(dismiss) => (
				<form onSubmit={submit}>
					<p className="
						mt-3
						font-vietnam
						text-sm
						text-black/60
					">
						Your account, points, lab and event sign-ups all go, for good. Type your password to confirm.
					</p>
					<input
						type="password"
						autoComplete="current-password"
						autoFocus
						value={password}
						onChange={(event) => { setPassword(event.target.value); setError(null) }}
						placeholder="password"
						aria-label="Password"
						className="
							mt-5
							w-full
							h-[42px]
							rounded-[10px]
							border
							border-black/25
							bg-white
							px-4
							font-vietnam
							text-sm
							text-black
							outline-none
							transition-colors
							duration-200
							focus:border-black
						"
					/>
					{error && (
						<p
							role="alert"
							className="
								mt-3
								font-vietnam
								font-semibold
								text-sm
								text-salmon-dark
							"
						>
							{error}
						</p>
					)}
					<div className="
						mt-8
						flex
						justify-end
						gap-3
					">
						<PopupButton onClick={() => dismiss(onClose)}>cancel</PopupButton>
						<button
							type="submit"
							disabled={!ready}
							className={`
								rounded-full
								px-6
								py-2
								font-vietnam
								font-semibold
								text-sm
								transition-all
								duration-200
								ease-out
								${ready
									? 'bg-salmon-dark text-cream cursor-pointer hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/10'
									: 'bg-black/10 text-black/40 cursor-not-allowed'}
							`}
						>
							{busy ? 'deleting…' : 'delete forever'}
						</button>
					</div>
				</form>
			)}
		</Popup>
	)
}

// ---- the rail --------------------------------------------------------------

// One place on the board. Everybody else is a dot on the line with their name
// beside it; yours steps out of the column onto a white card, which is the
// only marking the rail needs to say where you are.
function RailStop({ person, mine }) {
	return (
		<div className={`
			relative
			flex
			items-center
			gap-3
			py-1
			${mine ? '-mx-3 rounded-[14px] bg-white px-3 py-2.5 shadow-[0_4px_14px_rgba(0,0,0,0.18)]' : ''}
		`}>
			<span className={`
				shrink-0
				flex
				items-center
				justify-center
				rounded-full
				font-vietnam
				font-bold
				tabular-nums
				${mine
					? 'w-9 h-9 bg-salmon text-white text-sm'
					: 'w-6 h-6 bg-cream text-black/55 text-[11px]'}
			`}>
				{person.place}
			</span>

			<span className={`
				flex-1
				min-w-0
				truncate
				font-vietnam
				${mine
					? 'font-bold text-[15px] text-black'
					: 'text-sm text-black/70'}
			`}>
				{mine ? 'you' : `${person.first} ${person.last}`}
			</span>

			<span className={`
				shrink-0
				font-vietnam
				tabular-nums
				${mine
					? 'font-bold text-[15px] text-black'
					: 'text-sm text-black/55'}
			`}>
				{person.points}
			</span>
		</div>
	)
}

// The stretch of the board the rail doesn't name, drawn as the length it is:
// a dotted run of the line with a count against it.
function RailGap({ skipped }) {
	return (
		<div className="
			flex
			items-center
			gap-3
			py-1
		">
			<span className="
				w-6
				shrink-0
				flex
				justify-center
			">
				<span className="
					h-6
					border-l-2
					border-dotted
					border-black/30
				" />
			</span>
			<span className="
				font-vietnam
				text-xs
				text-black/40
			">
				{skipped} {skipped === 1 ? 'place' : 'places'}
			</span>
		</div>
	)
}

// Where you stand, as a line rather than a leaderboard: the top of the club at
// the top of the card, you somewhere down it, and the distance between drawn
// as distance.
function RankRail({ board, place, points, meId }) {
	const rows = railRows(board, place)

	return (
		<section className="
			rounded-[26px]
			bg-blue-light
			p-6
			flex
			flex-col
		">
			<h2 className="
				font-beachday
				text-[28px]
				sm:text-[34px]
				leading-none
				text-black
			">
				where you stand
			</h2>

			<div className="
				mt-4
				flex
				items-end
				gap-3
			">
				<p className="
					font-canobis
					text-[56px]
					sm:text-[66px]
					leading-[0.8]
					text-blue-med
				">
					#{place}
				</p>
				<p className="
					pb-1
					font-vietnam
					text-sm
					text-black/55
				">
					of {board.length}
					<br />
					<span className="text-black/40">{points} points</span>
				</p>
			</div>

			{/* the line the stops hang on. It's behind them and inset by half a
			    marker, so every dot lands on it whatever size that dot is. */}
			<div className="
				relative
				mt-6
			">
				<span className="
					pointer-events-none
					absolute
					top-2
					bottom-2
					left-[11px]
					w-[2px]
					bg-black/15
				" />
				<div className="
					relative
					flex
					flex-col
				">
					{rows.map((row) =>
						row.person ? (
							<RailStop
								key={row.key}
								person={row.person}
								mine={row.person.id === meId}
							/>
						) : (
							<RailGap key={row.key} skipped={row.skipped} />
						)
					)}
				</div>
			</div>
		</section>
	)
}

// What the rail's card says to somebody with an account and no member row: the
// same slot on the page, holding the reason it's empty rather than an empty
// board.
function JoinCard() {
	return (
		<section className="
			rounded-[26px]
			bg-blue-light
			p-6
			sm:p-7
		">
			<h2 className="
				font-beachday
				text-[28px]
				sm:text-[34px]
				leading-none
				text-black
			">
				where you stand
			</h2>
			<p className="
				mt-4
				font-handrawn
				text-2xl
				leading-tight
				text-black
			">
				Nowhere yet! That&rsquo;s the fun part.
			</p>
			<p className="
				mt-3
				font-vietnam
				text-sm
				leading-relaxed
				text-black/60
			">
				Sign the waiver and come to a meeting. Labs and events start counting
				from your first check-in, and your place on the board shows up here.
			</p>
		</section>
	)
}

// ---- reset password --------------------------------------------------------

// The button doesn't set a password, it asks for the link that does — that's
// POST /auth/forgot-password, which mails a 15-minute token pointed at
// /reset-password. So the dialog's job is to say where the link is going and
// then confirm it went, which is also why it never asks for the old one.
function ResetPasswordDialog({ email, onClose }) {
	const { closing, dismiss } = useDismiss()
	const close = () => dismiss(onClose)
	const [sent, setSent] = useState(false)
	const [busy, setBusy] = useState(false)

	// POST /auth/forgot-password answers the same way whether or not the address
	// is registered — no enumeration — so there's nothing to report back but
	// "it's on its way", which is what the second page already says.
	const send = async () => {
		if (busy) return
		setBusy(true)
		try {
			await auth.forgotPassword(email)
		} catch {
			// A link that didn't send is indistinguishable from one that did
			// until the inbox says otherwise, and the panel already tells them
			// to ask for another if it doesn't arrive.
		} finally {
			setBusy(false)
			setSent(true)
		}
	}

	useEffect(() => {
		const onKey = (event) => {
			if (event.key === 'Escape') close()
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	})

	return (
		// dialog-open / dialog-leaving are the entrance and the exit (see
		// globals.css); the leaving half is what useDismiss holds the card on
		// screen for.
		<div
			className={`
				fixed
				inset-0
				z-50
				flex
				items-center
				justify-center
				bg-black/40
				p-4
				sm:p-8
				${closing ? 'dialog-leaving' : 'dialog-open'}
			`}
			onClick={close}
		>
			{/* the card swallows clicks so only the backdrop itself closes */}
			<div
				onClick={(event) => event.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-label="Reset password"
				className="
					w-full
					max-w-[460px]
					max-h-[85dvh]
					overflow-y-auto
					rounded-[26px]
					bg-cream
					p-6
					sm:p-8
					shadow-[0_10px_40px_rgba(0,0,0,0.35)]
				"
			>
				<div className="
					flex
					items-start
					justify-between
					gap-4
				">
					<h2 className="
						font-beachday
						text-[28px]
						sm:text-[34px]
						leading-none
						text-black
					">
						{sent ? 'check your email' : 'reset password'}
					</h2>
					<button
						type="button"
						onClick={close}
						aria-label="Close"
						className="
							w-9
							h-9
							shrink-0
							flex
							items-center
							justify-center
							rounded-full
							bg-black
							text-cream
							cursor-pointer
							transition-all
							duration-200
							ease-out
							hover:brightness-150
							active:scale-95
						"
					>
						<CloseIcon className="w-4 h-4" />
					</button>
				</div>

				<p className="
					mt-3
					font-vietnam
					text-sm
					leading-relaxed
					text-black/60
				">
					{sent
						? 'It’s on its way. The link works once and runs out after 15 minutes — ask for another if it does.'
						: 'We’ll email you a link that sets a new password. The one you have now keeps working until you use it.'}
				</p>

				{/* where the link is going, spelled out either way — before, so
				    there's no surprise; after, so there's somewhere to go and look */}
				<div className="
					mt-5
					flex
					items-center
					gap-3
					rounded-[16px]
					bg-white
					px-4
					py-3
				">
					<span className={`
						w-9
						h-9
						shrink-0
						flex
						items-center
						justify-center
						rounded-full
						${sent ? 'bg-green text-green-dark' : 'bg-salmon-lightest text-salmon-dark'}
					`}>
						{sent
							? <CheckIcon className="w-4 h-4" />
							: <MailIcon className="w-[18px] h-[18px]" />}
					</span>
					<span className="
						min-w-0
						flex-1
						font-vietnam
						text-sm
						text-black
						truncate
					">
						{email}
					</span>
				</div>

				<div className="
					mt-8
					flex
					justify-end
					gap-3
				">
					{!sent && (
						<button
							type="button"
							onClick={close}
							className="
								rounded-full
								px-5
								py-2.5
								font-vietnam
								font-semibold
								text-sm
								text-black/70
								cursor-pointer
								transition-colors
								duration-200
								ease-out
								hover:bg-black/[0.06]
								hover:text-black
							"
						>
							cancel
						</button>
					)}
					<button
						type="button"
						onClick={() => (sent ? close() : send())}
						className="
							rounded-full
							bg-black
							px-7
							py-2.5
							font-vietnam
							font-semibold
							text-sm
							text-cream
							cursor-pointer
							transition-all
							duration-200
							ease-out
							hover:-translate-y-0.5
							hover:shadow-lg
							hover:shadow-black/25
							active:translate-y-0
							active:shadow-none
						"
					>
						{sent ? 'done' : busy ? 'sending…' : 'send link'}
					</button>
				</div>
			</div>
		</div>
	)
}

// ---- page ------------------------------------------------------------------

export default function Profile() {
	const role = useRole()
	const { user, refresh } = useSession()
	const isMember = hasRole('member', role)

	// Points and places are a member's business. Officers run the board rather
	// than compete on it — they can see the whole thing on the dashboard and the
	// roster — so their profile is the masthead and the form, nothing else.
	const onTheBoard = isMember && !hasRole('officer', role)

	// What the server has, and what the form is doing to it. The photo is in the
	// draft rather than saved on the spot, so one save covers the masthead and
	// the form under it.
	//
	// Seeded from the session, which the app already loaded — so the masthead
	// draws with a name on it immediately and only the counter and the rail wait
	// on a fetch.
	const [profile, setProfile] = useState(() => ({
		first: user?.firstName ?? '',
		last: user?.lastName ?? '',
		email: user?.email ?? '',
		photo: user?.profilePicture ?? null,
		emailVerified: user?.emailVerified ?? false,
		joined: user?.dateJoined ?? user?.createdAt ?? null,
		points: user?.points ?? 0,
		stats: NO_STATS,
	}))
	const [draft, setDraft] = useState(() => ({
		first: user?.firstName ?? '',
		last: user?.lastName ?? '',
		email: user?.email ?? '',
		photo: user?.profilePicture ?? null,
	}))
	const [saved, setSaved] = useState(false)
	const [error, setError] = useState(null)
	const [saving, setSaving] = useState(false)
	const [resetting, setResetting] = useState(false)
	const [deleting, setDeleting] = useState(false)
	const [board, setBoard] = useState([])
	const signOut = useSignOut()

	// The popup behind a counter number: which one is open, and the history
	// they all read — fetched the first time any of them opens, then kept.
	const [historyOpen, setHistoryOpen] = useState(null)
	const [history, setHistory] = useState(null)
	const [historyError, setHistoryError] = useState(null)
	const openHistory = (which) => {
		setHistoryOpen(which)
		if (history) return
		setHistoryError(null)
		membersApi
			.history()
			.then(setHistory)
			.catch((err) => setHistoryError(err.message))
	}

	// The counter's four counts, which only /members/me computes. Officers and
	// 'user' accounts don't draw the counter, so neither asks for them — and a
	// 'user' has no member row for that endpoint to find in the first place.
	useEffect(() => {
		if (!onTheBoard) return
		let live = true

		membersApi
			.me()
			.then((me) => {
				if (!live) return
				setProfile((previous) => ({
					...previous,
					stats: me.stats ?? NO_STATS,
					points: me.points ?? previous.points,
					joined: me.dateJoined ?? previous.joined,
				}))
			})
			.catch(() => {})

		membersApi
			.list()
			.then((rows) => live && setBoard(toBoard(rows)))
			.catch(() => {})

		return () => { live = false }
	}, [onTheBoard])

	// the "saved" line is a receipt, not a state — it clears itself
	useEffect(() => {
		if (!saved) return
		const timer = setTimeout(() => setSaved(false), 2500)
		return () => clearTimeout(timer)
	}, [saved])

	const set = (field) => (event) => {
		setDraft((prev) => ({ ...prev, [field]: event.target.value }))
		setSaved(false)
		setError(null)
	}

	const setPhoto = (photo) => {
		setDraft((prev) => ({ ...prev, photo }))
		setSaved(false)
		setError(null)
	}

	const dirty =
		draft.first !== profile.first ||
		draft.last !== profile.last ||
		draft.email !== profile.email ||
		draft.photo !== profile.photo

	// a name nobody can read is worse than the one you had, so an empty field
	// greys the save out rather than being taken and complained about after
	const filled =
		draft.first.trim() !== '' &&
		draft.last.trim() !== '' &&
		draft.email.trim() !== ''

	// PUT /members/me takes all four: the names, the email (which moves the
	// username with it) and the picture. The picture is still a data URL held in
	// the browser — there's nowhere to upload a file to yet — so what's stored
	// is whatever the picker produced.
	//
	// The session is refreshed afterwards rather than patched by hand: the
	// sidebar, the pass and the masthead all read the same user off it, and
	// re-reading is what keeps them from disagreeing.
	const save = async () => {
		if (!dirty || !filled || saving) return

		const clean = {
			first: draft.first.trim(),
			last: draft.last.trim(),
			email: draft.email.trim().toLowerCase(),
			photo: draft.photo,
		}

		setSaving(true)
		setError(null)
		try {
			await membersApi.update({
				firstName: clean.first,
				lastName: clean.last,
				email: clean.email,
				profilePicture: clean.photo,
			})
			setDraft(clean)
			setProfile((prev) => ({ ...prev, ...clean }))
			setSaved(true)
			await refresh()
		} catch (err) {
			setError(err.message)
		} finally {
			setSaving(false)
		}
	}

	const revert = () => {
		setDraft({
			first: profile.first,
			last: profile.last,
			email: profile.email,
			photo: profile.photo,
		})
		setError(null)
	}

	const ranking = onTheBoard ? ranked(board) : []
	const mine = ranking.find((person) => person.id === user?.userId)

	// What sits beside the form, if anything: your place for a member, the
	// invitation for somebody who isn't one yet, and nothing for an officer —
	// whose form then stops widening rather than stretching a four-field paper
	// form across the whole window.
	const beside = onTheBoard
		? <RankRail board={ranking} place={mine?.place} points={mine?.points ?? 0} meId={user?.userId} />
		: isMember ? null : <JoinCard />

	const narrow = beside ? '' : 'xl:max-w-[900px]'

	return (
		// The column bleeds out to the window on every side and pads the same
		// amount back in, so nothing moves but the clipping edge does: card
		// shadows have room to land instead of being sliced off at the column's
		// border, and a page that scrolls runs out at the edge of the screen
		// rather than being cut across at some line inside it.
		<DashboardShell className="
			flex
			flex-col
			-my-4
			py-4
			-ml-4
			pl-4
			-mr-4
			pr-4
			sm:-my-6
			sm:py-6
			sm:-ml-6
			sm:pl-6
			sm:-mr-6
			sm:pr-6
			lg:-my-8
			lg:py-8
			lg:-ml-6
			lg:pl-6
			lg:-mr-8
			lg:pr-8
		">
			{/* page-stagger is the entrance (see globals.css): the masthead, the
			    counter and the row under them rise in sequence, so arriving here
			    from the menu reads as movement rather than a swap. DashboardShell
			    puts it on this column too, which is why these are its own children
			    rather than wrapped in one box. */}
			<div className="
				page-stagger
				flex
				flex-col
				gap-5
				sm:gap-6
				pb-2
			">
				<Masthead
					role={role}
					profile={profile}
					draft={draft}
					onPick={setPhoto}
					onClear={() => setPhoto(null)}
				/>

				{onTheBoard && (
					<Counter points={profile.points ?? mine?.points ?? 0} stats={profile.stats} onOpen={openHistory} />
				)}

				{/* the form and whatever's beside it pair off from xl — below that
				    the side card goes under the form full width, because the two
				    name fields need roughly 480px between them before they're worth
				    having side by side and the rail wants 320 of its own */}
				<div className={`
					flex
					flex-col
					xl:flex-row
					items-start
					gap-6
					sm:gap-7
					${narrow}
				`}>
					<div className="
						flex-1
						min-w-0
						w-full
					">
						<DetailsCard
							draft={draft}
							dirty={dirty}
							ready={dirty && filled && !saving}
							saved={saved}
							saving={saving}
							error={error}
							verified={profile.emailVerified && draft.email === profile.email}
							onChange={set}
							onSave={save}
							onRevert={revert}
						/>
					</div>

					{beside && (
						<div className="
							w-full
							xl:w-[340px]
							shrink-0
						">
							{beside}
						</div>
					)}
				</div>

				{/* the password runs the full width under the form: it belongs to it
				    but doesn't go through its save button, and a band across the
				    bottom is the clearest way to say so */}
				<PasswordCard
					className={narrow}
					onReset={() => setResetting(true)}
				/>

				<EmailPrefsCard
					className={narrow}
					user={user}
					onSaved={refresh}
				/>

				<DeleteAccountCard
					className={narrow}
					onDelete={() => setDeleting(true)}
				/>
			</div>

			{historyOpen && (
				<HistoryDialog
					which={historyOpen}
					history={history}
					error={historyError}
					onClose={() => setHistoryOpen(null)}
				/>
			)}

			{deleting && (
				<DeleteAccountDialog
					onClose={() => setDeleting(false)}
					onDeleted={signOut}
				/>
			)}

			{resetting && (
				<ResetPasswordDialog
					email={profile.email}
					onClose={() => setResetting(false)}
				/>
			)}
		</DashboardShell>
	)
}
