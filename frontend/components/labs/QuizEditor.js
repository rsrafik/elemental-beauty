'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardShell from '@/components/dashboards/DashboardShell'
import { BackButton, Scaled } from '@/components/labs/LabViewParts'
import { INSET, RemoveButton, DiscardPopup, StatusLine, PublishBar, fieldClass } from '@/components/labs/EditorParts'
import { labs as labsApi } from '@/lib/api'

// /labs/quiz?id=N — the officer's editor for a lab's quiz. One column: the
// lab's name, then each question with its four answer boxes, the tick beside
// the right one, and "add question" under the last.
//
// Members pick one answer per question and need every one right, so each
// question has exactly one ticked answer — ticking another moves the tick.
// Blank answer boxes are just unused; a question needs two filled in to be
// published.
//
// Save draft keeps the questions without members seeing them; publish swaps
// them in for the live quiz; discard throws the draft away. See
// PUT /api/labs/:id/quiz.

const ANSWERS = 4

function blankQuestion() {
	return {
		question: '',
		options: Array.from({ length: ANSWERS }, () => ({ answerText: '', isCorrect: false })),
	}
}

// pads a saved question back out to the four boxes the editor always shows
function toEditable(question) {
	const options = question.options.slice(0, Math.max(ANSWERS, question.options.length))
	while (options.length < ANSWERS) options.push({ answerText: '', isCorrect: false })
	return { question: question.question, options }
}

// The hand-drawn blue tick that sits in (and a little out of) the box.
function Tick({ className }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="#1C03ED" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
			<path d="M4.5 12.8l5 5.2L21.5 4.5" />
		</svg>
	)
}

function Checkbox({ checked, onChange, label }) {
	return (
		<button
			type="button"
			role="checkbox"
			aria-checked={checked}
			aria-label={label}
			onClick={onChange}
			className={`
				relative
				w-[23.3px]
				h-[23.3px]
				shrink-0
				rounded-[2px]
				bg-transparent
				${INSET}
			`}
		>
			{checked && (
				<Tick className="
					absolute
					left-[1px]
					-top-[3px]
					w-[25px]
					h-[25px]
				" />
			)}
		</button>
	)
}

function Question({ index, value, onChange, onRemove, invalid }) {
	const n = index + 1
	const setOption = (i, patch) =>
		onChange({ ...value, options: value.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) })
	// one right answer: ticking a box unticks the others, ticking it again clears it
	const tick = (i) =>
		onChange({
			...value,
			options: value.options.map((o, j) => ({ ...o, isCorrect: j === i ? !o.isCorrect : false })),
		})

	return (
		<div className="relative">
			<RemoveButton
				label={`Remove question ${n}`}
				onClick={onRemove}
				className="top-[0.4px]"
			/>

			<label
				htmlFor={`question-${index}`}
				className="
					block
					font-vietnam
					font-semibold
					text-[18px]
					leading-[20px]
					text-black
				"
			>
				question {n}
			</label>
			<input
				id={`question-${index}`}
				type="text"
				value={value.question}
				onChange={(event) => onChange({ ...value, question: event.target.value })}
				aria-invalid={invalid}
				className={`
					${fieldClass('orange', invalid)}
					mt-[1.5px]
					h-[41.6px]
					px-[14px]
				`}
			/>

			<p className="
				mt-[11.6px]
				font-vietnam
				font-semibold
				text-[18px]
				leading-[20px]
				text-black
			">
				answer choices
			</p>
			<div className="
				mt-[2.2px]
				flex
				flex-col
				gap-[8.5px]
			">
				{value.options.map((option, i) => (
					<div
						key={i}
						className="
							flex
							items-center
						"
					>
						<div className="
							w-[59.1px]
							shrink-0
							flex
							pl-[14.7px]
						">
							<Checkbox
								checked={option.isCorrect}
								onChange={() => tick(i)}
								label={`Answer ${i + 1} is the right one`}
							/>
						</div>
						<input
							type="text"
							value={option.answerText}
							onChange={(event) => setOption(i, { answerText: event.target.value })}
							aria-label={`Question ${n}, answer ${i + 1}`}
							className={`
								${fieldClass('orange')}
								h-[41.5px]
								px-[14px]
							`}
						/>
					</div>
				))}
			</div>
		</div>
	)
}

// What stops a question being published, or null. Mirrors the server's check
// so the page can point at the question rather than just repeat a message.
function problemWith(question) {
	const filled = question.options.filter((o) => o.answerText.trim())
	if (!question.question.trim()) return 'needs wording'
	if (filled.length < 2) return 'needs at least two answers'
	if (filled.filter((o) => o.isCorrect).length !== 1) return 'needs its right answer ticked'
	return null
}

export default function QuizEditor({ id }) {
	const router = useRouter()
	const [title, setTitle] = useState('')
	const [questions, setQuestions] = useState(null)
	const [hasDraft, setHasDraft] = useState(false)
	const [invalid, setInvalid] = useState(() => new Set())
	const [status, setStatus] = useState(null)
	const [busy, setBusy] = useState(false)
	const [dirty, setDirty] = useState(false)
	const [confirmDiscard, setConfirmDiscard] = useState(false)

	useEffect(() => {
		if (!id) return
		let live = true
		labsApi
			.quizForEdit(id)
			.then((quiz) => {
				if (!live) return
				setTitle(quiz.title)
				setHasDraft(Boolean(quiz.draft))
				// the draft is newer than what's live, so that's what opens
				const source = quiz.draft ?? quiz.questions
				setQuestions(source.length ? source.map(toEditable) : [blankQuestion()])
			})
			.catch((err) => live && setStatus({ error: true, text: err.message }))
		return () => { live = false }
	}, [id])

	const change = (next) => {
		setQuestions(next)
		setDirty(true)
		setStatus(null)
		setInvalid(new Set())
	}

	const setQuestion = (index, value) => change(questions.map((q, i) => (i === index ? value : q)))
	// the last question can't go — it clears instead, so there's always a box
	const removeQuestion = (index) =>
		change(questions.length === 1 ? [blankQuestion()] : questions.filter((_, i) => i !== index))

	const save = async (publish) => {
		if (busy || !questions) return
		if (publish) {
			const bad = questions
				.map((q, i) => [i, problemWith(q)])
				.filter(([, problem]) => problem)
			if (bad.length) {
				setInvalid(new Set(bad.map(([i]) => i)))
				const [i, problem] = bad[0]
				setStatus({ error: true, text: `Question ${i + 1} ${problem}` })
				return
			}
		}
		setBusy(true)
		setStatus(null)
		try {
			await labsApi.saveQuiz(id, questions, publish)
			if (publish) {
				router.push('/labs')
				return
			}
			setHasDraft(true)
			setDirty(false)
			setStatus({ text: 'Draft saved — members still see the published quiz' })
		} catch (err) {
			setStatus({ error: true, text: err.message })
		} finally {
			setBusy(false)
		}
	}

	const discard = async () => {
		try {
			if (hasDraft) await labsApi.discardQuizDraft(id)
		} catch {}
		router.push('/labs')
	}

	return (
		<DashboardShell className="
			lg:-mt-8
			lg:-mb-8
			lg:-mr-8
			lg:py-8
			lg:pr-8
		">
			<BackButton />

			<Scaled className="
				lg:pt-[30.7px]
				pb-[60px]
			">
				<PublishBar
					busy={busy || !questions}
					onPublish={() => save(true)}
					onDraft={() => save(false)}
					onDiscard={() => (dirty || hasDraft ? setConfirmDiscard(true) : router.push('/labs'))}
				/>
				<StatusLine status={status} />

				<h1 className="
					mt-[27.1px]
					font-beachday
					text-[40px]
					sm:text-[54px]
					leading-[1.2]
					text-salmon
					text-center
					break-words
				">
					{title}
				</h1>
				<p className="
					mt-[0.3px]
					font-aalto
					text-[31px]
					leading-[36px]
					text-black
					text-center
				">
					LAB QUIZ
				</p>

				{questions && (
					<div className="
						mt-[26.7px]
						w-full
						max-w-[585.2px]
						mx-auto
						pl-[36px]
						lg:pl-0
					">
						<div className="
							flex
							flex-col
							gap-[40px]
						">
							{questions.map((question, i) => (
								<Question
									key={i}
									index={i}
									value={question}
									onChange={(value) => setQuestion(i, value)}
									onRemove={() => removeQuestion(i)}
									invalid={invalid.has(i)}
								/>
							))}
						</div>

						<button
							type="button"
							onClick={() => change([...questions, blankQuestion()])}
							className="
								mt-[25.4px]
								w-full
								h-[38px]
								rounded-full
								bg-salmon
								font-vietnam
								font-semibold
								text-[18px]
								leading-none
								text-cream
								cursor-pointer
								transition-all
								duration-200
								ease-out
								hover:-translate-y-0.5
								hover:shadow-[0_4px_10px_rgba(0,0,0,0.15)]
								hover:brightness-105
								active:translate-y-0
								active:shadow-none
							"
						>
							add question
						</button>
					</div>
				)}
			</Scaled>

			{confirmDiscard && (
				<DiscardPopup
					onCancel={() => setConfirmDiscard(false)}
					onConfirm={discard}
				/>
			)}
		</DashboardShell>
	)
}
