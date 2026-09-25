'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import DashboardShell from '@/components/dashboards/DashboardShell'
import { BackButton, metaLine, useDesignZoom } from '@/components/labs/LabViewParts'
import QrScanner from '@/components/checkin/QrScanner'
import { INSET, EditorButton } from '@/components/labs/EditorParts'
import { openCompose, useMailProvider } from '@/lib/compose'
import { labs as labsApi, events as eventsApi, members as membersApi } from '@/lib/api'

// The officer's check-in page for one lab or one event — where clicking its
// card on /labs or /events lands. Top: the camera for scanning members' QR
// codes beside the date line and title. Below: three columns.
//
//   not checked in   signed up and not here yet — tick checks them in by
//                    hand, x drops their spot (which goes to the waitlist)
//   checked in       here — x undoes the check-in
//   waitlist         in the order they joined — the yellow button gives them
//                    a spot, x takes them off, and manual add puts someone on
//                    by username
//
// Laid out in the design's pixels and zoomed to the window like the member
// lab pages (see Scaled in LabViewParts). The columns run to the bottom of the
// window, where the sidebar ends, and scroll inside themselves.

const API = { lab: labsApi, event: eventsApi }

// how often the lists are re-read, to catch sign-ups and other officers
const POLL_MS = 5_000

function fullName(row) {
	return [row.firstName, row.lastName].filter(Boolean).join(' ') || `@${row.username}`
}

const byName = (a, b) => fullName(a).localeCompare(fullName(b))


// ---- icons -----------------------------------------------------------------

function TickIcon({ className }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
			<path d="M7.5 12.3l3 3 6-6.3" />
		</svg>
	)
}

function CrossIcon({ className }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" className={className} aria-hidden="true">
			<path d="M8.3 8.3l7.4 7.4M15.7 8.3l-7.4 7.4" />
		</svg>
	)
}

// a person with a tick beside them — let them in
function AdmitIcon({ className }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
			<circle cx="10" cy="9" r="2.8" />
			<path d="M5 17.5c0-2.6 2.2-4.4 5-4.4 1 0 1.9.2 2.6.6" />
			<path d="M13.2 16l1.9 1.9 3.6-3.8" />
		</svg>
	)
}

function AddPersonIcon({ className }) {
	return (
		<svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
			<circle cx="9.5" cy="8" r="3.6" />
			<path d="M2.8 19.2c0-3.6 3-6 6.7-6s6.7 2.4 6.7 6c0 .5-.4.8-.8.8H3.6c-.4 0-.8-.3-.8-.8z" />
			<path d="M18.5 7.5v6M15.5 10.5h6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
		</svg>
	)
}

// ---- pieces ----------------------------------------------------------------

const TONES = {
	green: 'bg-green text-white',
	red: 'bg-red text-white',
	yellow: 'bg-[#EBD24A] text-white',
}

function RowButton({ tone, label, onClick, disabled, children }) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			aria-label={label}
			title={label}
			className={`
				w-[22px]
				h-[22px]
				shrink-0
				rounded-full
				flex
				items-center
				justify-center
				cursor-pointer
				transition-[scale,filter]
				duration-150
				ease-out
				hover:scale-110
				hover:brightness-105
				active:scale-95
				disabled:opacity-50
				disabled:cursor-wait
				${TONES[tone]}
			`}
		>
			{children}
		</button>
	)
}

function Person({ row, number }) {
	return (
		<div className="
			flex
			items-center
			min-w-0
		">
			{number != null && (
				<span className="
					w-[31.5px]
					shrink-0
					font-vietnam
					font-semibold
					text-[18px]
					leading-none
					text-black
				">
					{number}
				</span>
			)}
			<div className="min-w-0">
				<p className="
					font-vietnam
					text-[18px]
					leading-[22px]
					text-black
					truncate
				">
					{fullName(row)}
				</p>
				<p className="
					mt-[1.2px]
					font-vietnam
					text-[15px]
					leading-[18px]
					text-black
					truncate
				">
					@{row.username}
				</p>
			</div>
		</div>
	)
}

// One column: its name and count over the card, the card running to the
// bottom of the page with its list scrolling inside it.
function Column({ title, count, footer, children }) {
	return (
		<div className="
			flex
			flex-col
			min-h-0
		">
			<div className="
				flex
				items-baseline
				justify-between
				pl-[12px]
				pr-[5px]
				font-vietnam
				font-semibold
				text-[17px]
				leading-[22px]
				text-black
			">
				<h2>{title}</h2>
				<span>{count}</span>
			</div>
			<div className="
				mt-[6px]
				flex-1
				min-h-[260px]
				lg:min-h-0
				flex
				flex-col
				rounded-[10px]
				bg-cream
				shadow-[inset_0_0_10px_rgba(0,0,0,0.3)]
				overflow-hidden
			">
				<div className="
					flex-1
					min-h-0
					overflow-y-auto
					pt-[22px]
					pb-[12px]
					flex
					flex-col
					gap-[17.3px]
				">
					{children}
				</div>
				{footer}
			</div>
		</div>
	)
}

function Row({ children }) {
	return (
		<div className="
			flex
			items-center
			justify-between
			gap-3
			pr-[16.2px]
		">
			{children}
		</div>
	)
}

function Empty({ children }) {
	return (
		<p className="
			px-[18px]
			font-vietnam
			text-[14px]
			text-black/40
		">
			{children}
		</p>
	)
}

// The waitlist's footer: type a username (or pick one — the list is every
// member) and they go on the end of the waitlist.
function ManualAdd({ onAdd, people }) {
	const [value, setValue] = useState('')
	const [error, setError] = useState(null)
	const [busy, setBusy] = useState(false)

	const submit = async (event) => {
		event.preventDefault()
		const username = value.trim().replace(/^@/, '')
		if (!username || busy) return
		setBusy(true)
		setError(null)
		try {
			await onAdd(username)
			setValue('')
		} catch (err) {
			setError(err.message)
		} finally {
			setBusy(false)
		}
	}

	return (
		<form
			onSubmit={submit}
			className="
				shrink-0
				px-[21.8px]
				pb-[13.4px]
				pt-[6px]
			"
		>
			{error && (
				<p className="
					mb-[6px]
					font-vietnam
					text-[12px]
					leading-tight
					text-red
				">
					{error}
				</p>
			)}
			<div className="
				h-[34.5px]
				flex
				items-center
				rounded-full
				border
				border-[#ABA7A2]
				bg-white
				pl-[14px]
				pr-[4px]
			">
				<input
					type="text"
					value={value}
					onChange={(event) => setValue(event.target.value)}
					list="checkin-people"
					placeholder="manual add"
					aria-label="Add someone to the waitlist by username"
					autoComplete="off"
					className="
						flex-1
						min-w-0
						bg-transparent
						outline-none
						font-vietnam
						italic
						text-[16px]
						text-black
						placeholder:text-black/80
					"
				/>
				<datalist id="checkin-people">
					{people.map((person) => (
						<option key={person.userId} value={person.user.username}>
							{[person.user.firstName, person.user.lastName].filter(Boolean).join(' ')}
						</option>
					))}
				</datalist>
				<button
					type="submit"
					disabled={busy}
					aria-label="Add to waitlist"
					className={`
						w-[26px]
						h-[26px]
						shrink-0
						rounded-full
						flex
						items-center
						justify-center
						bg-cream
						text-black
						${INSET}
					`}
				>
					<AddPersonIcon className="w-[15px] h-[15px]" />
				</button>
			</div>
		</form>
	)
}

// ---- page ------------------------------------------------------------------

export default function CheckInView({ kind, id }) {
	const api = API[kind]
	const zoom = useDesignZoom()
	const mail = useMailProvider()
	const [item, setItem] = useState(null)
	const [roster, setRoster] = useState([])
	const [people, setPeople] = useState([])
	const [error, setError] = useState(null)
	// member ids with a request out, so a button can't be hit twice
	const [busy, setBusy] = useState(() => new Set())

	const loadRoster = useCallback(async () => {
		try {
			const rows = await api.roster(id)
			setRoster(rows)
			return rows
		} catch (err) {
			setError(err.message)
			return null
		}
	}, [api, id])

	useEffect(() => {
		if (!id) return
		let live = true
		api.get(id)
			.then((row) => live && setItem(row))
			.catch((err) => live && setError(err.message))
		api.roster(id)
			.then((rows) => live && setRoster(rows))
			.catch((err) => live && setError(err.message))
		membersApi.list()
			.then((rows) => live && setPeople(rows))
			.catch(() => {})
		const timer = setInterval(() => {
			api.roster(id).then((rows) => live && setRoster(rows)).catch(() => {})
		}, POLL_MS)
		return () => {
			live = false
			clearInterval(timer)
		}
	}, [api, id])

	const act = async (memberId, action) => {
		setBusy((prev) => new Set(prev).add(memberId))
		setError(null)
		try {
			await api.rosterAction(id, { memberId, action })
			await loadRoster()
		} catch (err) {
			setError(err.message)
		} finally {
			setBusy((prev) => {
				const next = new Set(prev)
				next.delete(memberId)
				return next
			})
		}
	}

	const add = async (username) => {
		await api.rosterAction(id, { action: 'add', username })
		await loadRoster()
	}

	// What the camera found: check it in, re-read the lists, and say who it
	// was. The code is the member's signed id; its payload is readable here,
	// which is enough to put a name to the result.
	const scanned = async (token) => {
		let who = null
		try {
			const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
			who = payload.id
		} catch {}

		const reply = await api.checkin(id, token)
		const rows = await loadRoster()
		const row = rows?.find((r) => r.memberId === who)
		const name = row ? fullName(row) : 'member'
		const tone = { CHECKED_IN: 'green', ALREADY_CHECKED_IN: 'green', WAITLISTED: 'yellow', ALREADY_WAITLISTED: 'yellow' }[reply.code] ?? 'green'
		const text = {
			CHECKED_IN: `${name} checked in`,
			ALREADY_CHECKED_IN: `${name} is already checked in`,
			WAITLISTED: `${name} wasn't signed up — added to the waitlist`,
			ALREADY_WAITLISTED: `${name} is on the waitlist`,
		}[reply.code] ?? reply.message
		return { tone, text }
	}

	const { waiting, here, waitlist } = useMemo(() => ({
		waiting: roster.filter((r) => r.status === 'rsvped' || r.status === 'absent').sort(byName),
		here: roster.filter((r) => r.status === 'attended').sort(byName),
		waitlist: roster
			.filter((r) => r.status === 'waitlisted')
			.sort((a, b) => new Date(a.waitlistedAt) - new Date(b.waitlistedAt)),
	}), [roster])

	// "email all": everyone who signed up (both "not checked in" and "checked
	// in" — not the waitlist), in BCC, in the officer's own mail service (see
	// lib/compose.js), with the lab or event's name as the subject
	const recipients = [...waiting, ...here]
		.map((row) => row.email)
		.filter(Boolean)

	const back = kind === 'lab'
		? { href: '/labs', label: 'Back to labs' }
		: { href: '/events', label: 'Back to events' }

	return (
		<DashboardShell className="
			lg:-mt-8
			lg:-mb-8
			lg:-mr-8
			lg:py-8
			lg:pr-8
		">
			<BackButton {...back} />

			<div
				className="
					lg:h-full
					flex
					flex-col
				"
				style={{ zoom }}
			>
				{/* ---- camera + header ---------------------------------------- */}
				<div className="
					shrink-0
					lg:pt-[64.5px]
					flex
					flex-col
					lg:flex-row
					items-center
					lg:items-start
					justify-center
					gap-6
					lg:gap-[33.8px]
				">
					<QrScanner onScan={scanned} />

					<div className="
						w-full
						lg:w-[366px]
						lg:pt-[16.9px]
						text-center
						lg:text-left
					">
						{item && (
							<>
								<p className="
									font-vietnam
									font-semibold
									text-[15px]
									leading-[22px]
									text-black
								">
									{metaLine(item)}
								</p>
								<h1 className="
									mt-[3.3px]
									font-beachday
									text-[40px]
									sm:text-[54px]
									leading-[1.2]
									sm:leading-[65.2px]
									text-salmon
									break-words
								">
									{item.title}
								</h1>
								<EditorButton
									className="
										mt-[14px]
										mx-auto
										lg:mx-0
										w-[121.7px]
										h-[32px]
									"
									disabled={recipients.length === 0}
									title={recipients.length === 0 ? 'Nobody has signed up yet' : `Email ${recipients.length} ${recipients.length === 1 ? 'person' : 'people'}`}
									onClick={() => openCompose({ provider: mail.provider, from: mail.email, bcc: recipients, subject: item.title })}
								>
									email all
								</EditorButton>
							</>
						)}
						{error && (
							<p className="
								mt-2
								font-vietnam
								text-[13px]
								text-salmon-dark
							">
								{error}
							</p>
						)}
					</div>
				</div>

				{/* ---- the three lists ---------------------------------------- */}
				<div className="
					mt-8
					lg:mt-[54.5px]
					flex-1
					min-h-0
					w-full
					lg:w-[905.6px]
					max-w-full
					mx-auto
					grid
					grid-cols-1
					md:grid-cols-3
					gap-y-8
					gap-x-[24px]
					lg:gap-x-[42.3px]
				">
					<Column title="not checked in" count={waiting.length}>
						{waiting.length === 0 && <Empty>nobody waiting to check in</Empty>}
						{waiting.map((row) => (
							<Row key={row.memberId}>
								<div className="pl-[18px] min-w-0">
									<Person row={row} />
								</div>
								<div className="
									flex
									gap-[15.5px]
								">
									<RowButton
										tone="green"
										label={`Check in ${fullName(row)}`}
										onClick={() => act(row.memberId, 'checkin')}
										disabled={busy.has(row.memberId)}
									>
										<TickIcon className="w-[20px] h-[20px]" />
									</RowButton>
									<RowButton
										tone="red"
										label={`Remove ${fullName(row)}`}
										onClick={() => act(row.memberId, 'remove')}
										disabled={busy.has(row.memberId)}
									>
										<CrossIcon className="w-[20px] h-[20px]" />
									</RowButton>
								</div>
							</Row>
						))}
					</Column>

					<Column title="checked in" count={here.length}>
						{here.length === 0 && <Empty>nobody checked in yet</Empty>}
						{here.map((row) => (
							<Row key={row.memberId}>
								<div className="pl-[18px] min-w-0">
									<Person row={row} />
								</div>
								<RowButton
									tone="red"
									label={`Undo ${fullName(row)}'s check-in`}
									onClick={() => act(row.memberId, 'uncheck')}
									disabled={busy.has(row.memberId)}
								>
									<CrossIcon className="w-[20px] h-[20px]" />
								</RowButton>
							</Row>
						))}
					</Column>

					<Column
						title="waitlist"
						count={waitlist.length}
						footer={<ManualAdd onAdd={add} people={people} />}
					>
						{waitlist.length === 0 && <Empty>nobody on the waitlist</Empty>}
						{waitlist.map((row, i) => (
							<Row key={row.memberId}>
								<div className="pl-[27.5px] min-w-0">
									<Person row={row} number={i + 1} />
								</div>
								<div className="
									flex
									gap-[10px]
								">
									<RowButton
										tone="yellow"
										label={`Give ${fullName(row)} a spot`}
										onClick={() => act(row.memberId, 'admit')}
										disabled={busy.has(row.memberId)}
									>
										<AdmitIcon className="w-[18px] h-[18px]" />
									</RowButton>
									<RowButton
										tone="red"
										label={`Take ${fullName(row)} off the waitlist`}
										onClick={() => act(row.memberId, 'remove')}
										disabled={busy.has(row.memberId)}
									>
										<CrossIcon className="w-[20px] h-[20px]" />
									</RowButton>
								</div>
							</Row>
						))}
					</Column>
				</div>
			</div>
		</DashboardShell>
	)
}
