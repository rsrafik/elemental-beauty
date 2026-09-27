'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import DashboardShell from '@/components/dashboards/DashboardShell'
import { BackButton, useDesignZoom } from '@/components/labs/LabViewParts'
import MemberLabContent from '@/components/labs/MemberLabContent'
import {
	INSET,
	EditorButton,
	RemoveButton,
	UploadIcon,
	IconLabel,
	Asterisk,
	FieldLabel,
	fieldClass,
	DiscardPopup,
	StatusLine,
	PublishBar,
} from '@/components/labs/EditorParts'
import DateTimeField from '@/components/labs/DateTimeField'
import { labs as labsApi } from '@/lib/api'
import { isoDate } from '@/lib/dates'
import { parseInstructions } from '@/lib/labContent'
import { pastedSteps } from '@/lib/pasteSteps'
// cover photos are shrunk before they're sent — see lib/images.js
import { shrinkImage } from '@/lib/images'

// /labs/edit (a new lab) and /labs/edit?id=N — the officer's lab editor.
//
//   middle   the cover image, date, room, seats, title, description and the
//            lesson PDF. It stays put.
//   right    publish / save draft / discard, the materials and equipment
//            boxes, and the instructions as sections, each a title and its
//            steps. It scrolls on its own.
//
// Publishing puts the lab (and any changes) live. Saving a draft keeps a new
// lab off the members' pages, or — for one that's already live — parks the
// changes without touching what members see (see PUT /api/labs/:id). Discard
// throws away whatever hasn't been published.
//
// Laid out in the design's pixels and zoomed to the window like the member
// lab pages. The two columns sit where the mockup puts them from the sidebar
// and the window's right edge; the right one takes whatever width is left.

const SHELL_PAD = 32
const LG = 1024

// how many empty sections a brand new lab starts with — the mockup's two
const NEW_SECTIONS = 2

// A step wears a filled bullet; a warning under it, indented, a hollow one.
const BULLET = '• '
const WARN = '    ◦ '
const IS_STEP = /^\s*•\s?/
const IS_WARN = /^\s*◦\s?/

const INSTRUCTION_HINT = [
	{ text: 'instruction 1' },
	{ text: 'press tab for a warning under it', warning: true },
	{ text: 'instruction 2' },
]

const MATERIALS_HINT = '# Oils & Fats\n- Coconut oil - 230g\n- Olive oil - 200g'

function subscribe(onChange) {
	window.addEventListener('resize', onChange)
	return () => window.removeEventListener('resize', onChange)
}

function useWide() {
	return useSyncExternalStore(subscribe, () => window.innerWidth >= LG, () => true)
}

// ---- form <-> lab ----------------------------------------------------------

// A section's steps are typed one per line behind a bullet, each followed by
// its warnings, if any, on hollow-bullet lines of their own.
const toSteps = (part) =>
	part.items
		.flatMap((item, i) => [BULLET + item, ...(part.warnings[i] ?? []).map((w) => WARN + w)])
		.join('\n')

// -> [{ text, warnings }]. A warning with no step above it becomes a step
// rather than being dropped.
function fromSteps(text) {
	const steps = []
	for (const line of text.split('\n')) {
		const warning = IS_WARN.test(line)
		const body = line.replace(warning ? IS_WARN : IS_STEP, '').trim()
		if (!body) continue
		if (warning && steps.length) steps[steps.length - 1].warnings.push(body)
		else steps.push({ text: body, warnings: [] })
	}
	return steps
}

function emptySection() {
	return { title: '', steps: '' }
}

// The lab (or its parked draft, laid over it) as the form holds it.
function toForm(lab) {
	const source = { ...lab, ...(lab.draft ?? {}) }
	const sections = parseInstructions(source.instructions).map((part) => ({
		title: part.heading ?? '',
		steps: toSteps(part),
	}))
	const date = source.date ? isoDate(source.date) : ''
	return {
		when: date ? `${date}T${source.startTime || '00:00'}` : '',
		location: source.location ?? '',
		seats: source.capacity == null ? '' : String(source.capacity),
		title: source.title ?? '',
		description: source.description ?? '',
		materials: source.ingredients ?? '',
		equipment: source.equipment ?? '',
		sections: sections.length ? sections : [emptySection()],
		image: source.image ?? null,
	}
}

function blankForm() {
	return {
		when: '',
		location: '',
		seats: '',
		title: '',
		description: '',
		materials: '',
		equipment: '',
		sections: Array.from({ length: NEW_SECTIONS }, emptySection),
		image: null,
	}
}

// What PUT/POST /api/labs takes. Sections with nothing in them are dropped.
function toBody(form) {
	const [date, time] = form.when.split('T')
	const instructions = form.sections
		.map((section) => ({ title: section.title.trim(), steps: fromSteps(section.steps) }))
		.filter((section) => section.title || section.steps.length)
		.map((section) => [
			...(section.title ? [`# ${section.title}`] : []),
			...section.steps.flatMap((step) => [
				`- ${step.text}`,
				...step.warnings.map((warning) => `! ${warning}`),
			]),
		].join('\n'))
		.join('\n\n')
	return {
		title: form.title.trim(),
		// a draft can be saved without one, and clearing it clears it
		date: date || null,
		startTime: time && time !== '00:00' ? time : null,
		location: form.location.trim(),
		capacity: form.seats.trim() === '' ? null : Number(form.seats),
		description: form.description.trim(),
		ingredients: form.materials.trim(),
		equipment: form.equipment.trim(),
		instructions,
		image: form.image,
	}
}

// Everything with an asterisk. Publishing needs all of it; a draft only
// needs a title.
function missingFor(form, hasLesson, publishing) {
	const missing = new Set()
	if (!form.title.trim()) missing.add('title')
	if (form.seats.trim() !== '' && !(Number.isInteger(Number(form.seats)) && Number(form.seats) > 0)) {
		missing.add('seats')
	}
	if (!publishing) return missing
	if (!form.when) missing.add('when')
	if (!form.location.trim()) missing.add('location')
	if (!form.description.trim()) missing.add('description')
	if (!form.materials.trim()) missing.add('materials')
	if (!form.equipment.trim()) missing.add('equipment')
	if (!form.sections[0]?.title.trim()) missing.add('section-title')
	if (!fromSteps(form.sections[0]?.steps ?? '').length) missing.add('section-steps')
	if (!hasLesson) missing.add('lesson')
	return missing
}

// ---- pieces ----------------------------------------------------------------

function CrossIcon({ className }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="square" className={className} aria-hidden="true">
			<path d="M7 7l10 10M17 7L7 17" />
		</svg>
	)
}

// The cover: grey until there is one, with the raised x on its corner that
// takes it off again.
function Cover({ image, onRemove }) {
	return (
		<div className="relative">
			<div className="
				w-full
				h-[236.3px]
				rounded-[10px]
				overflow-hidden
				bg-[#CCCCCC]
			">
				{image && (
					<img
						src={image}
						alt=""
						className="
							w-full
							h-full
							object-cover
							select-none
						"
					/>
				)}
			</div>
			<button
				type="button"
				onClick={onRemove}
				disabled={!image}
				aria-label="Remove cover image"
				className={`
					absolute
					-right-[5.6px]
					-top-[8px]
					w-[25.6px]
					h-[25.6px]
					rounded-full
					flex
					items-center
					justify-center
					bg-cream
					text-[#EE4444]
					${INSET}
					disabled:opacity-100
					disabled:cursor-default
				`}
			>
				<CrossIcon className="w-[16px] h-[16px]" />
			</button>
		</div>
	)
}

// A label and its box on one line — date, location, seats available.
function InlineField({ id, label, required, invalid, className = '', children }) {
	return (
		<div className={`
			flex
			items-center
			gap-[9px]
			${className}
		`}>
			<FieldLabel htmlFor={id} required={required} className="shrink-0">
				{label}
			</FieldLabel>
			<div className={`flex-1 min-w-0 ${invalid ? 'rounded-[5px]' : ''}`}>
				{children}
			</div>
		</div>
	)
}

// One instructions box. Every line is a step and wears a bullet, so Enter
// starts the next step with one ready, and backspacing over a bare bullet
// takes the line away instead of leaving a dot behind.
//
// Tab makes the line a warning on the step above — indented, hollow bullet,
// shown in red as "WARNING:" to members — and Shift+Tab (or backspacing over
// its bare bullet) makes it a step again. A paste is read for its steps rather
// than line by line (lib/pasteSteps.js), so a numbered list from a document
// lands one bullet per step instead of one per wrapped line — and a document's
// opening line, its section name, goes in the title box if that's still empty.
//
// `onChange(steps, extra)` — `extra` is `{ title }` when a paste supplies one,
// sent in the same call because two separate section updates in one event
// would each start from the same old form and the second would undo the first.
function StepsBox({ id, value, onChange, invalid, title }) {
	const ref = useRef(null)
	// where to put the caret once the edit lands
	const caret = useRef(null)

	useEffect(() => {
		if (caret.current == null || !ref.current) return
		ref.current.setSelectionRange(caret.current, caret.current)
		caret.current = null
	})

	const normalise = (text) =>
		text
			.split('\n')
			.map((line) => {
				if (line === '' || line.startsWith(BULLET) || line.startsWith(WARN)) return line
				if (IS_WARN.test(line)) return WARN + line.replace(IS_WARN, '')
				return BULLET + line.replace(IS_STEP, '')
			})
			.join('\n')

	// the line the caret is on: where it starts, and its bullet
	const lineAt = (at) => {
		const start = value.lastIndexOf('\n', at - 1) + 1
		const end = value.indexOf('\n', at)
		const line = value.slice(start, end === -1 ? value.length : end)
		const prefix = line.startsWith(WARN) ? WARN : line.startsWith(BULLET) ? BULLET : ''
		return { start, line, prefix }
	}

	// swap the bullet on the caret's line, keeping the caret on the same letter
	const rebullet = (at, from, to) => {
		const { start } = lineAt(at)
		caret.current = Math.max(start + to.length, at + to.length - from.length)
		onChange(value.slice(0, start) + to + value.slice(start + from.length))
	}

	const onKeyDown = (event) => {
		const { selectionStart: start, selectionEnd: end } = event.target
		const { start: lineStart, prefix } = lineAt(start)

		if (event.key === 'Tab') {
			if (event.shiftKey && prefix === WARN) {
				event.preventDefault()
				rebullet(start, WARN, BULLET)
			} else if (!event.shiftKey) {
				event.preventDefault()
				if (prefix === BULLET) rebullet(start, BULLET, WARN)
			}
			// Shift+Tab on a step is left alone, so it still moves focus back
		} else if (event.key === 'Enter') {
			event.preventDefault()
			const next = value.slice(0, start) + '\n' + BULLET + value.slice(end)
			caret.current = start + 1 + BULLET.length
			onChange(next)
		} else if (event.key === 'Backspace' && start === end && prefix && value.slice(lineStart, start) === prefix) {
			event.preventDefault()
			if (prefix === WARN) {
				// a bare warning bullet steps back out to a step
				rebullet(start, WARN, BULLET)
			} else {
				// the bullet and the line break before it
				const from = Math.max(0, lineStart - 1)
				caret.current = from
				onChange(value.slice(0, from) + value.slice(start))
			}
		}
	}

	const onPaste = (event) => {
		let pasted = pastedSteps(event.clipboardData)
		if (!pasted) return
		event.preventDefault()

		let extra
		if (pasted[0].kind === 'heading') {
			if (!title?.trim()) {
				extra = { title: pasted[0].text }
				pasted = pasted.slice(1)
			} else {
				pasted = [{ ...pasted[0], kind: 'step' }, ...pasted.slice(1)]
			}
			if (!pasted.length) return onChange(value, extra)
		}

		const { selectionStart: start, selectionEnd: end } = event.target
		const block = pasted.map((item) => (item.kind === 'warning' ? WARN : BULLET) + item.text).join('\n')

		// on a line of its own: a bare bullet the caret sits after is replaced,
		// and text already on the line keeps its own line either side
		const { start: lineStart } = lineAt(start)
		const bare = /^\s*[•◦]?\s*$/.test(value.slice(lineStart, start))
		const head = bare ? value.slice(0, lineStart) : value.slice(0, start) + '\n'
		const tail = value.slice(end)
		const joiner = tail && !tail.startsWith('\n') ? '\n' : ''

		caret.current = head.length + block.length
		onChange(normalise(head + block + joiner + tail), extra)
	}

	return (
		<div className="relative">
			<textarea
				ref={ref}
				id={id}
				value={value}
				onChange={(event) => onChange(normalise(event.target.value))}
				onKeyDown={onKeyDown}
				onPaste={onPaste}
				className={`
					${fieldClass('green', invalid)}
					block
					h-[180px]
					resize-y
					px-[14px]
					py-[11px]
					text-[13px]
					leading-[22px]
				`}
			/>
			{!value && (
				<ul
					aria-hidden="true"
					className="
						pointer-events-none
						absolute
						left-[14px]
						top-[11px]
						font-vietnam
						text-[13px]
						leading-[22px]
						text-[#A6A6A6]
					"
				>
					{INSTRUCTION_HINT.map((line) => (
						<li
							key={line.text}
							className={`
								relative
								${line.warning ? 'pl-[42px]' : 'pl-[14px]'}
							`}
						>
							<span className={`
								absolute
								${line.warning ? 'left-[29px]' : 'left-[1px]'}
							`}>
								{line.warning ? '◦' : '•'}
							</span>
							{line.text}
						</li>
					))}
				</ul>
			)}
		</div>
	)
}

// ---- preview ---------------------------------------------------------------

function EyeIcon({ off = false, className }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
			<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
			<circle cx="12" cy="12" r="3" />
			{off && <path d="M4 4l16 16" />}
		</svg>
	)
}

// The eye beside the back arrow: shows the lab as a member will see it once
// they're through the quiz, built from what's in the form right now — saved or
// not — and back to the editor on a second press.
function PreviewToggle({ on, onToggle }) {
	return (
		<button
			type="button"
			onClick={onToggle}
			aria-pressed={on}
			aria-label={on ? 'Back to editing' : 'Preview as a member'}
			title={on ? 'back to editing' : 'preview as a member'}
			className="
				w-8
				h-8
				flex
				items-center
				justify-center
				cursor-pointer
				text-black
				transition-transform
				duration-200
				ease-out
				hover:scale-110
				active:scale-95
			"
		>
			<EyeIcon off={on} className="w-8 h-8" />
		</button>
	)
}

// The form as the member page's lab row: the same fields toBody would save,
// under the names GET /api/labs/:id gives them. A lesson picked but not yet
// uploaded is handed over as the file itself so the preview can show it.
function previewLab(form, { id, lesson, lab }) {
	const body = toBody(form)
	return {
		labId: id ? Number(id) : null,
		title: body.title,
		description: body.description,
		image: body.image,
		date: body.date,
		startTime: body.startTime,
		location: body.location,
		ingredients: body.ingredients,
		equipment: body.equipment,
		instructions: body.instructions,
		hasLesson: Boolean(lesson || lab?.hasLesson),
		lessonPdfName: lesson?.name ?? lab?.lessonPdfName,
		lessonFile: lesson,
	}
}

// ---- page ------------------------------------------------------------------

export default function LabEditor({ id }) {
	const router = useRouter()
	const zoom = useDesignZoom()
	const wide = useWide()

	const [lab, setLab] = useState(null)
	const [form, setForm] = useState(() => (id ? null : blankForm()))
	const [lesson, setLesson] = useState(null) // a picked File, not yet uploaded
	const [missing, setMissing] = useState(() => new Set())
	const [status, setStatus] = useState(null)
	const [busy, setBusy] = useState(false)
	const [previewing, setPreviewing] = useState(false)
	const [dirty, setDirty] = useState(false)
	const [confirmDiscard, setConfirmDiscard] = useState(false)
	const coverInput = useRef(null)
	const lessonInput = useRef(null)

	useEffect(() => {
		if (!id) return
		let live = true
		labsApi
			.get(id)
			.then((row) => {
				if (!live) return
				setLab(row)
				setForm(toForm(row))
			})
			.catch((err) => live && setStatus({ error: true, text: err.message }))
		return () => { live = false }
	}, [id])

	const hasLesson = Boolean(lesson || lab?.hasLesson)

	const update = (patch) => {
		setForm((prev) => ({ ...prev, ...patch }))
		setDirty(true)
		setStatus(null)
	}
	const field = (key) => ({
		id: `lab-${key}`,
		value: form?.[key] ?? '',
		onChange: (event) => update({ [key]: event.target.value }),
	})
	const setSection = (index, patch) =>
		update({ sections: form.sections.map((s, i) => (i === index ? { ...s, ...patch } : s)) })

	// A field flagged by the last save stops being flagged as soon as it's
	// filled — re-checked against the same rule the save used.
	const still = form ? missingFor(form, hasLesson, true) : new Set()
	const flagged = new Set([...missing].filter((key) => still.has(key)))

	const pickCover = async (event) => {
		const file = event.target.files?.[0]
		event.target.value = ''
		if (!file) return
		try {
			update({ image: await shrinkImage(file) })
		} catch (err) {
			setStatus({ error: true, text: err.message })
		}
	}

	const pickLesson = (event) => {
		const file = event.target.files?.[0]
		event.target.value = ''
		if (!file) return
		if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
			setStatus({ error: true, text: 'The lesson has to be a PDF' })
			return
		}
		setLesson(file)
		setDirty(true)
		setStatus(null)
	}

	const save = async (publishing) => {
		if (busy || !form) return
		const gaps = missingFor(form, hasLesson, publishing)
		setMissing(gaps)
		if (gaps.size) {
			setStatus({
				error: true,
				text: publishing
					? 'Fill in everything marked * to publish'
					: 'A draft needs at least a title',
			})
			return
		}

		setBusy(true)
		setStatus(null)
		try {
			const body = { ...toBody(form), published: publishing }
			const saved = lab ? await labsApi.update(lab.labId, body) : await labsApi.create(body)
			if (lesson) await labsApi.uploadLesson(saved.labId, lesson)

			if (publishing) {
				router.push('/labs')
				return
			}
			// a new lab now has an address to come back to
			if (!lab) router.replace(`/labs/edit?id=${saved.labId}`)
			setLab((prev) => ({
				...(prev ?? saved),
				labId: saved.labId,
				published: saved.published,
				draft: saved.draft,
				hasLesson: prev?.hasLesson || Boolean(lesson),
				lessonPdfName: lesson?.name ?? prev?.lessonPdfName,
			}))
			setLesson(null)
			setDirty(false)
			setStatus({
				text: saved.published
					? 'Draft saved — members still see the published version'
					: 'Draft saved — members can’t see this lab until it’s published',
			})
		} catch (err) {
			setStatus({ error: true, text: err.message })
		} finally {
			setBusy(false)
		}
	}

	const discard = async () => {
		try {
			if (lab?.draft) await labsApi.update(lab.labId, { discardDraft: true })
		} catch {}
		router.push('/labs')
	}

	const askDiscard = () => {
		if (dirty || lab?.draft) setConfirmDiscard(true)
		else router.push('/labs')
	}

	const bar = (
		<>
			<PublishBar
				busy={busy}
				onPublish={() => save(true)}
				onDraft={() => save(false)}
				onDiscard={askDiscard}
			/>
			<StatusLine status={status} />
		</>
	)

	const lessonName = lesson?.name ?? lab?.lessonPdfName

	const toggle = form && (
		<PreviewToggle on={previewing} onToggle={() => setPreviewing((on) => !on)} />
	)

	// The member page's own frame (see MemberLabView) — the content bleeds over
	// the shell's padding on the top, right and bottom the way it does there.
	if (previewing && form) {
		return (
			<DashboardShell className="
				lg:-mt-8
				lg:-mb-8
				lg:-mr-8
				lg:py-8
				lg:pr-8
			">
				<BackButton before={toggle} />
				<MemberLabContent lab={previewLab(form, { id, lesson, lab })} />
			</DashboardShell>
		)
	}

	return (
		<DashboardShell className="
			lg:-mt-8
			lg:-mb-8
			lg:-mr-8
			lg:overflow-hidden!
		">
			<BackButton before={toggle} />
			{!form ? (
				<p className="
					mt-20
					font-vietnam
					text-[15px]
					text-black/[0.53]
					text-center
				">
					{status?.text ?? 'loading…'}
				</p>
			) : (
				<div
					className="
						lg:h-full
						flex
						flex-col
						lg:flex-row
						gap-10
						lg:gap-0
					"
					style={{ zoom }}
				>
					<div className="lg:hidden">{bar}</div>

					{/* ---- middle: the lab's details ---------------------------- */}
					<div
						className="
							w-full
							lg:w-[291px]
							shrink-0
							lg:ml-[27px]
							px-[36px]
							lg:pl-0
							lg:pr-[6px]
							lg:h-full
							lg:overflow-y-auto
							lg:[scrollbar-width:none]
							lg:pb-[24px]
						"
						// the image sits 11.3px under the top of the sidebar, which
						// is the shell's padding down — a real 32px at any zoom.
						// The 6px on the right is room for the image's x, which
						// hangs off its corner and the scroll box would clip.
						// Stacked, it runs the full width with the same 36px in
						// from each side as the column under it, so every box on
						// the page lines up with materials and equipment and the
						// whole thing sits in the middle.
						style={wide ? { paddingTop: SHELL_PAD / zoom + 11.3 } : undefined}
					>
						<Cover image={form.image} onRemove={() => update({ image: null })} />

						<div className="
							mt-[16.1px]
							flex
							justify-center
						">
							<EditorButton
								className="w-[209px] h-[30.4px]"
								onClick={() => coverInput.current?.click()}
							>
								<IconLabel icon={<UploadIcon className="w-[19px] h-[19px]" />}>
									upload cover image
								</IconLabel>
							</EditorButton>
							<input
								ref={coverInput}
								type="file"
								accept="image/*"
								onChange={pickCover}
								className="hidden"
							/>
						</div>

						<InlineField id="lab-when" label="date" required className="mt-[17.6px]">
							<DateTimeField
								id="lab-when"
								value={form.when}
								onChange={(when) => update({ when })}
								zoom={zoom}
								className={`
									${fieldClass('orange', flagged.has('when'))}
									h-[27.3px]
									px-[6px]
									text-[13px]
									${form.when ? '' : 'text-black/40'}
								`}
							/>
						</InlineField>

						<InlineField id="lab-location" label="location" required className="mt-[15.2px]">
							<input
								type="text"
								{...field('location')}
								aria-invalid={flagged.has('location')}
								className={`
									${fieldClass('orange', flagged.has('location'))}
									h-[26.5px]
									px-[8px]
									text-[13px]
								`}
							/>
						</InlineField>

						<InlineField id="lab-seats" label="seats available" className="mt-[14.4px]">
							<input
								type="number"
								min="1"
								step="1"
								inputMode="numeric"
								placeholder="don’t add if unlimited"
								{...field('seats')}
								aria-invalid={flagged.has('seats')}
								className={`
									${fieldClass('orange', flagged.has('seats'))}
									h-[26.4px]
									px-[8px]
									text-[13px]
									placeholder:italic
									placeholder:text-[11.5px]
									[appearance:textfield]
									[&::-webkit-inner-spin-button]:appearance-none
								`}
							/>
						</InlineField>

						<FieldLabel htmlFor="lab-title" required className="mt-[6.1px]">title</FieldLabel>
						<input
							type="text"
							{...field('title')}
							aria-invalid={flagged.has('title')}
							className={`
								${fieldClass('orange', flagged.has('title'))}
								mt-[5.6px]
								h-[48.8px]
								px-[12px]
							`}
						/>

						<FieldLabel htmlFor="lab-description" required className="mt-[7px]">description</FieldLabel>
						<textarea
							{...field('description')}
							aria-invalid={flagged.has('description')}
							className={`
								${fieldClass('orange', flagged.has('description'))}
								block
								mt-[7.1px]
								h-[179.5px]
								resize-none
								px-[12px]
								py-[10px]
								text-[13px]
								leading-[17px]
							`}
						/>

						<div className="
							mt-[17.6px]
							flex
							flex-col
							items-center
						">
							<EditorButton
								className={`
									w-[175px]
									h-[30.5px]
									${flagged.has('lesson') ? 'ring-2 ring-red/60' : ''}
								`}
								onClick={() => lessonInput.current?.click()}
							>
								<IconLabel icon={<UploadIcon className="w-[19px] h-[19px]" />}>
									upload lesson<Asterisk />
								</IconLabel>
							</EditorButton>
							<input
								ref={lessonInput}
								type="file"
								accept="application/pdf,.pdf"
								onChange={pickLesson}
								className="hidden"
							/>
							{lessonName && (
								<p className="
									mt-[8px]
									max-w-full
									truncate
									font-vietnam
									text-[12px]
									text-black/[0.53]
								">
									{lesson ? 'to upload: ' : 'current: '}{lessonName}
								</p>
							)}
						</div>
					</div>

					{/* ---- right: materials and instructions --------------------
					    The 36px on its left is room for the sections' red minus,
					    which hangs out past the boxes and the scroll box would
					    otherwise clip. Stacked, the right gets the same so the
					    page stays centred; side by side, the right edge is set
					    from the window's (the style below). */}
					<div
						className="
							flex-1
							min-w-0
							lg:ml-[20.5px]
							px-[36px]
							lg:h-full
							lg:overflow-y-auto
							pb-[29.6px]
						"
						style={wide ? {
							paddingTop: SHELL_PAD / zoom - 5.6,
							paddingRight: SHELL_PAD / zoom + 27.6,
						} : undefined}
					>
						<div className="hidden lg:block">{bar}</div>

						<FieldLabel htmlFor="lab-materials" required className="mt-[23.8px]">materials</FieldLabel>
						<textarea
							{...field('materials')}
							placeholder={MATERIALS_HINT}
							aria-invalid={flagged.has('materials')}
							className={`
								${fieldClass('pink', flagged.has('materials'))}
								block
								mt-[5.6px]
								h-[206px]
								resize-y
								px-[14px]
								py-[11px]
								text-[13px]
								leading-[16px]
							`}
						/>

						<FieldLabel htmlFor="lab-equipment" required className="mt-[27px]">equipment</FieldLabel>
						<textarea
							{...field('equipment')}
							aria-invalid={flagged.has('equipment')}
							className={`
								${fieldClass('pink', flagged.has('equipment'))}
								block
								mt-[2.4px]
								h-[206px]
								resize-y
								px-[14px]
								py-[11px]
								text-[13px]
								leading-[16px]
							`}
						/>

						<h2 className="
							mt-[22px]
							font-beachday
							text-[28px]
							leading-[34px]
							text-black
							text-center
						">
							INSTRUCTIONS
						</h2>

						{form.sections.map((section, i) => {
							const first = i === 0
							return (
								<div
									key={i}
									className={`
										relative
										${first ? 'mt-[3.9px]' : 'mt-[23.7px]'}
									`}
								>
									{/* the first section is the required one and
									    stays; any after it can go */}
									{!first && (
										<RemoveButton
											label={`Remove section ${i + 1}`}
											onClick={() => update({ sections: form.sections.filter((_, j) => j !== i) })}
											className="top-[-0.5px]"
										/>
									)}
									<FieldLabel htmlFor={`lab-section-${i}`} required={first}>
										section title
									</FieldLabel>
									<input
										id={`lab-section-${i}`}
										type="text"
										value={section.title}
										onChange={(event) => setSection(i, { title: event.target.value })}
										aria-invalid={first && flagged.has('section-title')}
										className={`
											${fieldClass('green', first && flagged.has('section-title'))}
											mt-[4.7px]
											h-[46.5px]
											px-[14px]
										`}
									/>
									<FieldLabel htmlFor={`lab-steps-${i}`} required={first} className="mt-[8.5px]">
										instructions
									</FieldLabel>
									<div className="mt-[4.8px]">
										<StepsBox
											id={`lab-steps-${i}`}
											value={section.steps}
											onChange={(steps, extra) => setSection(i, { steps, ...extra })}
											title={section.title}
											invalid={first && flagged.has('section-steps')}
										/>
									</div>
								</div>
							)
						})}

						<div className="
							mt-[24px]
							flex
							justify-center
						">
							<EditorButton
								className="w-[173px] h-[33.7px]"
								onClick={() => update({ sections: [...form.sections, emptySection()] })}
							>
								add new section
							</EditorButton>
						</div>
					</div>
				</div>
			)}

			{confirmDiscard && (
				<DiscardPopup
					onCancel={() => setConfirmDiscard(false)}
					onConfirm={discard}
				/>
			)}
		</DashboardShell>
	)
}
