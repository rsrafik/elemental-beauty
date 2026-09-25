'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import DashboardShell from '@/components/dashboards/DashboardShell'
import { BackButton, useDesignZoom } from '@/components/labs/LabViewParts'
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
import { parseSections } from '@/lib/labContent'

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

// Cover photos are shrunk before they're sent: they travel inside the lab's
// JSON as a data URL (there's no file store yet), and a phone photo is
// megabytes.
const COVER_MAX = 1600

const BULLET = '• '

const INSTRUCTION_HINT = ['instruction 1 [CAUTION: ]', 'instruction 2', 'instruction 3']

const MATERIALS_HINT = '# Oils & Fats\n- Coconut oil - 230g\n- Olive oil - 200g'

function subscribe(onChange) {
	window.addEventListener('resize', onChange)
	return () => window.removeEventListener('resize', onChange)
}

function useWide() {
	return useSyncExternalStore(subscribe, () => window.innerWidth >= LG, () => true)
}

// ---- form <-> lab ----------------------------------------------------------

// A section's steps are typed one per line, each shown with a bullet in front.
const toSteps = (items) => items.map((item) => BULLET + item).join('\n')
const fromSteps = (text) =>
	text
		.split('\n')
		.map((line) => line.replace(/^\s*•\s?/, '').trim())
		.filter(Boolean)

function emptySection() {
	return { title: '', steps: '' }
}

// The lab (or its parked draft, laid over it) as the form holds it.
function toForm(lab) {
	const source = { ...lab, ...(lab.draft ?? {}) }
	const sections = parseSections(source.instructions).map((part) => ({
		title: part.heading ?? '',
		steps: toSteps(part.items),
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
			...section.steps.map((step) => `- ${step}`),
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

function shrinkImage(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onerror = () => reject(new Error('Could not read that image'))
		reader.onload = () => {
			const img = new Image()
			img.onerror = () => reject(new Error('That file isn’t an image'))
			img.onload = () => {
				const scale = Math.min(1, COVER_MAX / Math.max(img.width, img.height))
				if (scale === 1 && file.size < 600_000) return resolve(reader.result)
				const canvas = document.createElement('canvas')
				canvas.width = Math.round(img.width * scale)
				canvas.height = Math.round(img.height * scale)
				canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
				resolve(canvas.toDataURL('image/jpeg', 0.85))
			}
			img.src = reader.result
		}
		reader.readAsDataURL(file)
	})
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
function StepsBox({ id, value, onChange, invalid }) {
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
			.map((line) => (line.startsWith(BULLET) || line === '' ? line : BULLET + line.replace(/^\s*•\s?/, '')))
			.join('\n')

	const onKeyDown = (event) => {
		const el = event.target
		const { selectionStart: start, selectionEnd: end } = el
		if (event.key === 'Enter') {
			event.preventDefault()
			const next = value.slice(0, start) + '\n' + BULLET + value.slice(end)
			caret.current = start + 1 + BULLET.length
			onChange(next)
		} else if (event.key === 'Backspace' && start === end) {
			const lineStart = value.lastIndexOf('\n', start - 1) + 1
			if (value.slice(lineStart, start) === BULLET) {
				event.preventDefault()
				// the bullet and the line break before it
				const from = Math.max(0, lineStart - 1)
				caret.current = from
				onChange(value.slice(0, from) + value.slice(start))
			}
		}
	}

	return (
		<div className="relative">
			<textarea
				ref={ref}
				id={id}
				value={value}
				onChange={(event) => onChange(normalise(event.target.value))}
				onKeyDown={onKeyDown}
				className={`
					${fieldClass('green', invalid)}
					block
					h-[133.8px]
					resize-y
					px-[14px]
					py-[11px]
					text-[13px]
					leading-[14.5px]
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
						leading-[14.5px]
						text-[#A6A6A6]
					"
				>
					{INSTRUCTION_HINT.map((line) => (
						<li
							key={line}
							className="
								relative
								pl-[14px]
							"
						>
							<span className="
								absolute
								left-[1px]
							">
								•
							</span>
							{line}
						</li>
					))}
				</ul>
			)}
		</div>
	)
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

	return (
		<DashboardShell className="
			lg:-mt-8
			lg:-mb-8
			lg:-mr-8
			lg:overflow-hidden!
		">
			<BackButton />
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
							max-w-[291px]
							mx-auto
							lg:mx-0
							lg:w-[291px]
							shrink-0
							lg:ml-[27px]
							pr-[6px]
							lg:h-full
							lg:overflow-y-auto
							lg:[scrollbar-width:none]
							lg:pb-[24px]
						"
						// the image sits 11.3px under the top of the sidebar, which
						// is the shell's padding down — a real 32px at any zoom.
						// The 6px on the right is room for the image's x, which
						// hangs off its corner and the scroll box would clip.
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
					    otherwise clip. */}
					<div
						className="
							flex-1
							min-w-0
							lg:ml-[20.5px]
							pl-[36px]
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
											onChange={(steps) => setSection(i, { steps })}
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
