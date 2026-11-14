'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Popup, PopupButton } from '@/components/labs/LabViewParts'
import { feedback as feedbackApi } from '@/lib/api'
import { useSession } from '@/lib/session'
import { hasRole } from '@/lib/roles'
import { EditorButton } from '@/components/labs/EditorParts'

// The feedback form after a lab or event (src/feedback.js), and everything
// that leads to it:
//
//   FeedbackButton    on the lab's page (above its photo) and the event's
//                     page (under its caption) — only there for someone the
//                     server says may give feedback, once it's open
//   FeedbackPopup     the form: what they thought, and their name if they
//                     want it known. Sending it again edits the same entry
//   FeedbackReminder  on opening the site, asks once about each lab or event
//                     they could give feedback on and haven't
//   FeedbackControls  the check-in page's two buttons: "release feedback
//                     form" and "feedback", which opens FeedbackListPopup
//   FeedbackListPopup the check-in page's list of everything sent in
//
// `kind` is 'lab' or 'event' throughout.

const BODY_MAX = 5000
const NAME_MAX = 100

const FIELD = `
	w-full
	rounded-[10px]
	border
	border-black/25
	bg-white
	px-4
	py-2.5
	font-vietnam
	text-sm
	text-black
	outline-none
	transition-colors
	duration-200
	focus:border-black
`

function FieldLabel({ children }) {
	return (
		<span className="
			block
			font-vietnam
			text-[11px]
			uppercase
			tracking-[0.12em]
			text-black/50
			mb-1.5
		">
			{children}
		</span>
	)
}

// The member's own form. `entry` is what they sent before ({ body, name }), to
// fill it back in; `points` what the first one earns. `onSaved(entry,
// awarded)` hears about a send.
export function FeedbackPopup({ kind, id, title, entry, points = 1, onSaved, onClose }) {
	const [body, setBody] = useState(entry?.body ?? '')
	const [name, setName] = useState(entry?.name ?? '')
	const [busy, setBusy] = useState(false)
	const [status, setStatus] = useState(null) // { error?, text }

	const editing = Boolean(entry)
	const ready = body.trim() !== '' && !busy

	const send = async (dismiss) => {
		if (!ready) return
		setBusy(true)
		setStatus(null)
		try {
			const reply = await feedbackApi.send(kind, id, { body: body.trim(), name: name.trim() || null })
			onSaved?.(reply.entry, reply.awarded)
			setStatus({
				text: reply.awarded
					? `Thanks! +${reply.awarded} ${reply.awarded === 1 ? 'point' : 'points'}`
					: 'Your feedback is updated',
			})
			setTimeout(() => dismiss(onClose), 1400)
		} catch (err) {
			setStatus({ error: true, text: err.message })
			setBusy(false)
		}
	}

	const line = 'font-vietnam text-sm text-black/60 mt-3'

	return (
		<Popup title="feedback" onClose={onClose}>
			{(dismiss) => (
				<>
					<p className={line}>
						How was <span className="font-semibold text-black">{title}</span>? Tell us what you liked and what
						we could do better.
					</p>
					<p className={line}>
						It&apos;s anonymous: nobody on e-board sees who sent it unless you add your name below.
						{editing
							? ' You can change it as often as you like.'
							: ` Sending it gets you ${points} club ${points === 1 ? 'point' : 'points'}.`}
					</p>

					<label className="block mt-5">
						<FieldLabel>your feedback</FieldLabel>
						<textarea
							value={body}
							onChange={(event) => setBody(event.target.value)}
							rows={6}
							maxLength={BODY_MAX}
							autoFocus
							className={`${FIELD} resize-y`}
						/>
					</label>

					<label className="block mt-4">
						<FieldLabel>your name (optional)</FieldLabel>
						<input
							type="text"
							value={name}
							onChange={(event) => setName(event.target.value)}
							maxLength={NAME_MAX}
							placeholder="leave blank to stay anonymous"
							className={FIELD}
						/>
					</label>

					{status && (
						<p
							role="status"
							className={`
								mt-3
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
						gap-3
					">
						<PopupButton onClick={() => dismiss(onClose)}>cancel</PopupButton>
						<PopupButton primary onClick={() => send(dismiss)} disabled={!ready}>
							{busy ? 'sending…' : editing ? 'update' : 'send'}
						</PopupButton>
					</div>
				</>
			)}
		</Popup>
	)
}

// The button on a lab's or event's page. It asks the server whether this
// member may give feedback here, and draws nothing until the answer is yes and
// the form is open.
export function FeedbackButton({ kind, id, title, className = '' }) {
	const [mine, setMine] = useState(null)
	const [open, setOpen] = useState(false)

	useEffect(() => {
		let live = true
		feedbackApi.mine(kind, id)
			.then((reply) => live && setMine(reply))
			.catch(() => {})
		return () => { live = false }
	}, [kind, id])

	if (!mine?.eligible || !mine.open) return null

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className={`
					rounded-full
					bg-salmon-lightest
					px-5
					py-1.5
					font-vietnam
					font-semibold
					text-[13px]
					text-salmon-dark
					shadow-[0_2px_6px_rgba(0,0,0,0.12)]
					cursor-pointer
					transition-all
					duration-200
					ease-out
					hover:-translate-y-0.5
					hover:shadow-[0_4px_10px_rgba(0,0,0,0.16)]
					${className}
				`}
			>
				{mine.entry ? 'edit your feedback' : 'give feedback'}
			</button>
			{open && (
				<FeedbackPopup
					kind={kind}
					id={id}
					title={title}
					entry={mine.entry}
					points={mine.points}
					onSaved={(entry) => setMine((was) => ({ ...was, entry }))}
					onClose={() => setOpen(false)}
				/>
			)}
		</>
	)
}

// Pages a member never opens the site onto — nothing is asked there.
const QUIET = ['/landing', '/login', '/verify', '/reset-password', '/offer', '/privacy', '/about-us']

// Asked for once per load of the site, not on every page change
let askedThisLoad = false

// On opening the site: if there's a lab or event they could give feedback on
// and haven't (and haven't been asked about), ask — once. The server marks it
// asked as soon as it's shown, so closing it is the end of it; the button on
// its page is still there if they change their mind.
export function FeedbackReminder() {
	const { user } = useSession()
	const pathname = usePathname()
	const [item, setItem] = useState(null)
	const [stage, setStage] = useState('ask') // 'ask' | 'form'
	const [mine, setMine] = useState(null)

	const member = user && hasRole('member', user.role) && user.role !== 'advisor'
	const quiet = QUIET.some((path) => pathname?.startsWith(path))

	useEffect(() => {
		if (!member || quiet || askedThisLoad) return
		askedThisLoad = true
		feedbackApi.pending()
			.then((rows) => {
				const first = rows[0]
				if (!first) return
				setItem(first)
				feedbackApi.asked(first.kind, first.id).catch(() => {})
			})
			.catch(() => {})
	}, [member, quiet])

	const close = useCallback(() => setItem(null), [])

	const toForm = async () => {
		try {
			setMine(await feedbackApi.mine(item.kind, item.id))
		} catch {
			setMine({ entry: null, points: 1 })
		}
		setStage('form')
	}

	if (!item) return null

	if (stage === 'form' && mine) {
		return (
			<FeedbackPopup
				kind={item.kind}
				id={item.id}
				title={item.title}
				entry={mine.entry}
				points={mine.points}
				onClose={close}
			/>
		)
	}

	return (
		<Popup title="how was it?" onClose={close}>
			{(dismiss) => (
				<>
					<p className="font-vietnam text-sm text-black/60 mt-3">
						Would you like to give feedback on{' '}
						<span className="font-semibold text-black">{item.title}</span>
						{`, the ${item.kind} you came to? It’s anonymous unless you add your name, and it gets you a club point.`}
					</p>
					<div className="
						mt-6
						flex
						justify-end
						gap-3
					">
						<PopupButton onClick={() => dismiss(close)}>not now</PopupButton>
						<PopupButton primary onClick={toForm}>give feedback</PopupButton>
					</div>
				</>
			)}
		</Popup>
	)
}

// The check-in page's list: every entry, newest first. A signed one has the
// name in bold over it; an unsigned one has nothing at all — the server never
// says who sent it.
export function FeedbackListPopup({ kind, id, title, onClose }) {
	const [data, setData] = useState(null)
	const [error, setError] = useState(null)

	useEffect(() => {
		let live = true
		feedbackApi.list(kind, id)
			.then((reply) => live && setData(reply))
			.catch((err) => live && setError(err.message))
		return () => { live = false }
	}, [kind, id])

	const line = 'font-vietnam text-sm text-black/60 mt-3'

	return (
		<Popup title="feedback" onClose={onClose} width="max-w-[720px]">
			{() => (
				<>
					{error ? (
						<p className={line}>{error}</p>
					) : !data ? (
						<p className={line}>loading…</p>
					) : (
						<>
							<p className={line}>
								{data.entries.length === 0
									? `Nothing sent in for ${title} yet.`
									: `${data.entries.length} ${data.entries.length === 1 ? 'response' : 'responses'} for ${title}.`}
								{!data.open && ' The form isn’t open to members yet: it opens when this ends, or when you release it.'}
							</p>
							{data.entries.length > 0 && (
								<ul className="
									mt-5
									flex
									flex-col
									gap-3
								">
									{data.entries.map((entry, i) => (
										<li
											key={i}
											className="
												rounded-[12px]
												bg-white
												border
												border-black/10
												px-5
												py-4
											"
										>
											{entry.name && (
												<p className="
													font-vietnam
													font-bold
													text-sm
													text-black
													mb-1
												">
													{entry.name}
												</p>
											)}
											<p className="
												font-vietnam
												text-sm
												text-black/80
												whitespace-pre-line
												break-words
											">
												{entry.body}
											</p>
										</li>
									))}
								</ul>
							)}
						</>
					)}
				</>
			)}
		</Popup>
	)
}

// The check-in page's two cells in its button grid. "release feedback form"
// opens the form to the people who came before it's over; once it's over
// it's open regardless, so the button says so instead. "feedback" opens the
// list, with how many have come in on it.
export function FeedbackControls({ kind, id, title, className = '' }) {
	const [state, setState] = useState(null) // { released, open, entries }
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState(null)
	const [viewing, setViewing] = useState(false)

	const load = useCallback(() => {
		feedbackApi.list(kind, id)
			.then(setState)
			.catch((err) => setError(err.message))
	}, [kind, id])
	useEffect(load, [load])

	const release = async () => {
		setBusy(true)
		setError(null)
		try {
			const reply = await feedbackApi.release(kind, id, !state.released)
			setState((was) => ({ ...was, ...reply }))
		} catch (err) {
			setError(err.message)
		} finally {
			setBusy(false)
		}
	}

	// over, and not because of the switch: open on its own
	const openAnyway = Boolean(state?.open && !state.released)
	const count = state?.entries.length ?? 0

	return (
		<>
			<EditorButton
				className={`
					${className}
					${state?.released ? 'bg-green!' : ''}
				`}
				disabled={!state || busy || openAnyway}
				title={error
					?? (openAnyway
						? 'It’s over, so the feedback form is open to everyone who came'
						: state?.released
							? 'Close the feedback form again until this is over'
							: 'Let the people who came give feedback now, before it ends')}
				onClick={release}
			>
				{busy ? 'saving…' : openAnyway ? 'feedback open' : state?.released ? 'feedback released' : 'release feedback'}
			</EditorButton>
			<EditorButton
				className={className}
				disabled={!state}
				title="Read the feedback sent in"
				onClick={() => setViewing(true)}
			>
				{`feedback${count ? ` · ${count}` : ''}`}
			</EditorButton>
			{viewing && (
				<FeedbackListPopup
					kind={kind}
					id={id}
					title={title}
					onClose={() => {
						setViewing(false)
						load()
					}}
				/>
			)}
		</>
	)
}
