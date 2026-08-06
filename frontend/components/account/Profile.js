'use client'

import { useEffect, useRef, useState } from 'react'
import DashboardShell from '@/components/dashboards/DashboardShell'
import { currentRole, currentUser, hasRole } from '@/lib/roles'
import { useDismiss } from '@/lib/dismiss'

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
//              about the same person, not five separate readings.
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

// Placeholder until this is wired to GET /members/me. Name and id come from
// lib/roles so the preview switch drives this page too; the rest is what that
// endpoint returns alongside them (users.username, members.points,
// members.date_joined, members.profile_picture).
//
// No email field: the username *is* the purdue username, so the address is it
// with the domain on the end. users.email should agree with that — it's the
// same account — and the page derives it rather than showing a second copy
// that could say something different.
const seedProfile = {
	username: 'isabel887',
	emailVerified: true,
	photo: null,
	joined: '2025-09-02',
	stats: {
		pastLabs: 10,
		rsvpLabs: 1,
		pastEvents: 2,
		rsvpEvents: 3,
	},
}

// The board, until it's a GET /members read sorted by points. Same people the
// roster on /students carries, so a place here and a points column there can't
// disagree.
const seedBoard = [
	{ id: 12281, first: 'Molly', last: 'White', points: 310 },
	{ id: 12278, first: 'Nadia', last: 'Okafor', points: 240 },
	{ id: 12283, first: 'Lauren', last: 'Martin', points: 205 },
	{ id: 12288, first: 'Isabel', last: 'Harris', points: 155 },
	{ id: 12286, first: 'Debra', last: 'Nelson', points: 130 },
	{ id: 12280, first: 'Priya', last: 'Anand', points: 115 },
	{ id: 12285, first: 'Vera', last: 'Cooper', points: 90 },
	{ id: 12277, first: 'Sofia', last: 'Reyes', points: 75 },
	{ id: 12282, first: 'Milton', last: 'Smith', points: 65 },
	{ id: 12276, first: 'Hana', last: 'Yamada', points: 50 },
	{ id: 12289, first: 'Daisy', last: 'Scott', points: 40 },
	{ id: 12287, first: 'Dan', last: 'Thomas', points: 25 },
	{ id: 12279, first: 'Grace', last: 'Kim', points: 15 },
	{ id: 12284, first: 'Brian', last: 'Miller', points: 0 },
]

// The role, written on the banner as a stamped rosette. 'user' is the one the
// roster has no row for: an account with no membership behind it yet.
const ROLE_INK = {
	user: 'text-black/45 border-black/25',
	member: 'text-salmon-dark border-salmon-dark/60',
	officer: 'text-blue-med border-blue-med/60',
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
function prettyDate(value) {
	if (!value) return ''
	const [year, month, day] = value.split('-').map(Number)
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
		const reader = new FileReader()
		reader.onload = () => onPick(reader.result)
		reader.readAsDataURL(file)
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
			{role === 'user' ? 'no membership' : role}
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
function Masthead({ profile, draft, onPick, onClear }) {
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
					<RoleStamp role={currentRole} />
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
						{hasRole('member', currentRole) ? 'joined' : 'account since'}
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
							{draft.username}@purdue.edu
						</p>
					</div>
				</div>
			</div>
		</section>
	)
}

// ---- the counter -----------------------------------------------------------

// One number and what it counts. The rules between cells are drawn by the
// strip, not by the cell, so the ends of the row stay open.
function CounterCell({ value, label, ink, className = '' }) {
	return (
		<div className={`
			flex
			flex-col
			items-center
			justify-center
			px-2
			py-3
			${className}
		`}>
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
		</div>
	)
}

function Counter({ points, stats }) {
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
				className="
					col-span-2
					sm:col-span-1
					border-b
					border-black/10
					sm:border-b-0
				"
			/>
			<CounterCell value={stats.pastLabs} label="labs done" ink={COUNTER_INK.pastLabs} />
			<CounterCell value={stats.rsvpLabs} label="labs rsvp'd" ink={COUNTER_INK.rsvpLabs} />
			<CounterCell value={stats.pastEvents} label="events done" ink={COUNTER_INK.pastEvents} />
			<CounterCell value={stats.rsvpEvents} label="events rsvp'd" ink={COUNTER_INK.rsvpEvents} />
		</section>
	)
}

// ---- the form --------------------------------------------------------------

// A line to write on rather than a box to fill in: the underline is the whole
// field, and it takes the club's salmon while you're in it.
function Line({ label, value, onChange, placeholder, autoComplete = 'off' }) {
	return (
		<label className="block">
			<span className="
				block
				font-vietnam
				text-[11px]
				uppercase
				tracking-[0.14em]
				text-black/45
			">
				{label}
			</span>
			<input
				type="text"
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

function DetailsCard({ draft, dirty, ready, saved, verified, onChange, onSave, onRevert }) {
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
					label="purdue username"
					value={draft.username}
					onChange={onChange('username')}
					placeholder="isabel887"
				/>

				{/* Not a field: the address is the purdue username with the domain on
				    the end, so it's written out here as it changes rather than typed
				    in twice and left to disagree. Its line is drawn but never lights
				    up, and the reset link goes to whatever this says.

				    It sits beside the username rather than under it — the two are
				    the same fact, and the pairing is what says so. */}
				<div>
					{/* the tag rides on the label line rather than the value line, so
					    the address gets the full width of the column and a long
					    username isn't truncated to make room for it */}
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
							email
						</span>
						{verified && (
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
						)}
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
							{draft.username || <span className="text-black/25">username</span>}
							<span className="text-black/35">@purdue.edu</span>
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
					${saved ? 'text-green-dark' : 'text-black/40'}
				`}>
					{saved
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
function RankRail({ board, place, points }) {
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
								mine={row.person.id === currentUser.id}
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
						onClick={() => (sent ? close() : setSent(true))}
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
						{sent ? 'done' : 'send link'}
					</button>
				</div>
			</div>
		</div>
	)
}

// ---- page ------------------------------------------------------------------

export default function Profile() {
	const isMember = hasRole('member', currentRole)

	// Points and places are a member's business. Officers run the board rather
	// than compete on it — they can see the whole thing on the dashboard and the
	// roster — so their profile is the masthead and the form, nothing else.
	const onTheBoard = isMember && !hasRole('officer', currentRole)

	// What the server has, and what the form is doing to it. The photo is in the
	// draft rather than saved on the spot, so one save covers the masthead and
	// the form under it.
	const [profile, setProfile] = useState(() => ({
		...seedProfile,
		first: currentUser.first,
		last: currentUser.last,
	}))
	const [draft, setDraft] = useState(() => ({
		first: currentUser.first,
		last: currentUser.last,
		username: seedProfile.username,
		photo: seedProfile.photo,
	}))
	const [saved, setSaved] = useState(false)
	const [resetting, setResetting] = useState(false)

	// the "saved" line is a receipt, not a state — it clears itself
	useEffect(() => {
		if (!saved) return
		const timer = setTimeout(() => setSaved(false), 2500)
		return () => clearTimeout(timer)
	}, [saved])

	const set = (field) => (event) => {
		setDraft((prev) => ({ ...prev, [field]: event.target.value }))
		setSaved(false)
	}

	const setPhoto = (photo) => {
		setDraft((prev) => ({ ...prev, photo }))
		setSaved(false)
	}

	const dirty =
		draft.first !== profile.first ||
		draft.last !== profile.last ||
		draft.username !== profile.username ||
		draft.photo !== profile.photo

	// a name nobody can read is worse than the one you had, so an empty field
	// greys the save out rather than being taken and complained about after
	const filled =
		draft.first.trim() !== '' &&
		draft.last.trim() !== '' &&
		draft.username.trim() !== ''

	// Local until this is wired up: the names and the username belong to the
	// user row and the photo to members.profile_picture, so saving becomes a
	// PUT /members/me once that route accepts them — today it whitelists
	// instagram and the picture — plus somewhere to upload the file itself.
	const save = () => {
		if (!dirty || !filled) return
		const clean = {
			...draft,
			first: draft.first.trim(),
			last: draft.last.trim(),
			username: draft.username.trim(),
		}
		setDraft(clean)
		setProfile((prev) => ({ ...prev, ...clean }))
		setSaved(true)
	}

	const revert = () =>
		setDraft({
			first: profile.first,
			last: profile.last,
			username: profile.username,
			photo: profile.photo,
		})

	const board = onTheBoard ? ranked(seedBoard) : []
	const mine = board.find((person) => person.id === currentUser.id)

	// What sits beside the form, if anything: your place for a member, the
	// invitation for somebody who isn't one yet, and nothing for an officer —
	// whose form then stops widening rather than stretching a four-field paper
	// form across the whole window.
	const beside = onTheBoard
		? <RankRail board={board} place={mine?.place} points={mine?.points ?? 0} />
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
					profile={profile}
					draft={draft}
					onPick={setPhoto}
					onClear={() => setPhoto(null)}
				/>

				{onTheBoard && (
					<Counter points={mine?.points ?? 0} stats={profile.stats} />
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
							ready={dirty && filled}
							saved={saved}
							verified={profile.emailVerified && draft.username === profile.username}
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
			</div>

			{resetting && (
				<ResetPasswordDialog
					email={`${profile.username}@purdue.edu`}
					onClose={() => setResetting(false)}
				/>
			)}
		</DashboardShell>
	)
}
